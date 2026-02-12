"""
Ralph Wiggum autonomous loop implementation.

The main orchestration loop that:
- Monitors vault folders for new tasks
- Dispatches tasks to appropriate Watchers
- Handles task results and errors
- Manages pause/resume/stop lifecycle
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable

from ..interfaces.agent import AgentResult, AgentTask, Priority, TaskStatus
from ..logging.structured import StructuredLogger, correlation_context
from ..mcp.events import EventBus, WebSocketEvent, WebSocketEventType, get_event_bus
from ..mcp.vault import VaultFolder, VaultManager
from .dashboard import DashboardState, DashboardUpdater, LoopStatus, TaskStats


@dataclass
class RalphWiggumConfig:
    """
    Configuration for Ralph Wiggum loop.

    Attributes:
        cycle_interval_ms: Time between loop cycles in milliseconds
        max_concurrent_tasks: Maximum tasks to execute concurrently
        task_timeout_ms: Default task timeout in milliseconds
        retry_attempts: Number of retry attempts for failed tasks
        retry_backoff_ms: Initial backoff time for retries
        vault_path: Path to vault folder
        dashboard_path: Path to Dashboard.md file
        log_path: Path for structured logs
    """
    cycle_interval_ms: int = 5000
    max_concurrent_tasks: int = 3
    task_timeout_ms: int = 30000
    retry_attempts: int = 3
    retry_backoff_ms: int = 1000
    vault_path: str = "./vault"
    dashboard_path: str = "./Dashboard.md"
    log_path: str | None = None


class LoopPhase(str, Enum):
    """Current phase of the loop cycle."""
    IDLE = "idle"
    SCANNING = "scanning"
    DISPATCHING = "dispatching"
    EXECUTING = "executing"
    UPDATING = "updating"


@dataclass
class LoopState:
    """
    Current state of the Ralph Wiggum loop.

    Attributes:
        status: Current loop status (running/paused/stopped)
        phase: Current phase within a cycle
        cycle_number: Current cycle count
        last_cycle_time: Timestamp of last cycle completion
        tasks_in_flight: Number of currently executing tasks
        pending_tasks: Tasks waiting to be dispatched
        completed_tasks: Count of completed tasks in current session
        failed_tasks: Count of failed tasks in current session
        error: Last error message if any
    """
    status: LoopStatus = LoopStatus.STOPPED
    phase: LoopPhase = LoopPhase.IDLE
    cycle_number: int = 0
    last_cycle_time: datetime | None = None
    tasks_in_flight: int = 0
    pending_tasks: list[AgentTask] = field(default_factory=list)
    completed_tasks: int = 0
    failed_tasks: int = 0
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "status": self.status.value,
            "phase": self.phase.value,
            "cycleNumber": self.cycle_number,
            "lastCycleTime": self.last_cycle_time.isoformat() if self.last_cycle_time else None,
            "tasksInFlight": self.tasks_in_flight,
            "pendingTasks": len(self.pending_tasks),
            "completedTasks": self.completed_tasks,
            "failedTasks": self.failed_tasks,
            "error": self.error,
        }


class RalphWiggumLoop:
    """
    Main orchestration loop for agent coordination.

    Implements the autonomous loop pattern:
    1. Scan vault folders for tasks
    2. Prioritize and schedule tasks
    3. Dispatch to appropriate Watchers
    4. Handle results and update state
    5. Update Dashboard.md
    """

    def __init__(
        self,
        config: RalphWiggumConfig,
        vault_manager: VaultManager,
        event_bus: EventBus | None = None,
    ):
        """
        Initialize Ralph Wiggum loop.

        Args:
            config: Loop configuration
            vault_manager: Vault folder manager
            event_bus: Event bus for notifications (optional)
        """
        self.config = config
        self.vault = vault_manager
        self.event_bus = event_bus or get_event_bus()
        self.logger = StructuredLogger("ralphWiggum:loop", config.log_path)
        self.dashboard = DashboardUpdater(config.dashboard_path, config.log_path)

        self.state = LoopState()
        self._loop_task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()
        self._pause_event = asyncio.Event()
        self._pause_event.set()  # Not paused initially

        # Agent registry and dispatcher (injected later)
        self._agents: dict[str, Any] = {}
        self._scheduler: Any = None
        self._dispatcher: Any = None

    def set_scheduler(self, scheduler: Any) -> None:
        """Set the task scheduler."""
        self._scheduler = scheduler

    def set_dispatcher(self, dispatcher: Any) -> None:
        """Set the task dispatcher."""
        self._dispatcher = dispatcher

    def register_agent(self, name: str, agent: Any) -> None:
        """Register an agent/watcher with the loop."""
        self._agents[name] = agent
        self.logger.info("register_agent", input_data={"name": name})

    def unregister_agent(self, name: str) -> None:
        """Unregister an agent/watcher from the loop."""
        if name in self._agents:
            del self._agents[name]
            self.logger.info("unregister_agent", input_data={"name": name})

    async def start(self) -> None:
        """
        Start the autonomous loop.

        Creates an async task that runs the main loop.
        """
        if self.state.status == LoopStatus.RUNNING:
            self.logger.warn("start", output_data={"error": "Loop already running"})
            return

        self.logger.info("start")
        self.state.status = LoopStatus.RUNNING
        self.state.error = None
        self._stop_event.clear()
        self._pause_event.set()

        # Initialize vault folders
        await self.vault.initialize()

        # Start the main loop task
        self._loop_task = asyncio.create_task(self._run_loop())

        # Emit start event
        self.event_bus.emit(
            WebSocketEventType.LOOP_CYCLE.value,
            {"action": "started", "cycleNumber": self.state.cycle_number},
        )

    async def stop(self) -> None:
        """
        Stop the autonomous loop.

        Signals the loop to stop and waits for current cycle to complete.
        """
        if self.state.status == LoopStatus.STOPPED:
            self.logger.warn("stop", output_data={"error": "Loop not running"})
            return

        self.logger.info("stop")
        self._stop_event.set()

        # Wait for loop task to complete
        if self._loop_task:
            try:
                await asyncio.wait_for(self._loop_task, timeout=10.0)
            except asyncio.TimeoutError:
                self.logger.warn("stop", output_data={"error": "Loop stop timed out"})
                self._loop_task.cancel()

        self.state.status = LoopStatus.STOPPED
        self.state.phase = LoopPhase.IDLE

        # Emit stop event
        self.event_bus.emit(
            WebSocketEventType.LOOP_CYCLE.value,
            {"action": "stopped", "cycleNumber": self.state.cycle_number},
        )

    async def pause(self) -> None:
        """
        Pause the autonomous loop.

        Current cycle completes, then loop waits for resume.
        """
        if self.state.status != LoopStatus.RUNNING:
            return

        self.logger.info("pause")
        self._pause_event.clear()
        self.state.status = LoopStatus.PAUSED

        self.event_bus.emit(
            WebSocketEventType.LOOP_CYCLE.value,
            {"action": "paused", "cycleNumber": self.state.cycle_number},
        )

    async def resume(self) -> None:
        """
        Resume a paused loop.
        """
        if self.state.status != LoopStatus.PAUSED:
            return

        self.logger.info("resume")
        self._pause_event.set()
        self.state.status = LoopStatus.RUNNING

        self.event_bus.emit(
            WebSocketEventType.LOOP_CYCLE.value,
            {"action": "resumed", "cycleNumber": self.state.cycle_number},
        )

    async def _run_loop(self) -> None:
        """
        Main loop execution.

        Runs cycles until stop is requested.
        """
        while not self._stop_event.is_set():
            # Wait if paused
            await self._pause_event.wait()

            if self._stop_event.is_set():
                break

            try:
                await self._run_cycle()
            except Exception as e:
                self.state.error = str(e)
                self.logger.error("run_loop", e)

            # Wait for next cycle
            try:
                await asyncio.wait_for(
                    self._stop_event.wait(),
                    timeout=self.config.cycle_interval_ms / 1000,
                )
            except asyncio.TimeoutError:
                pass  # Normal timeout, continue to next cycle

    async def _run_cycle(self) -> None:
        """
        Execute a single loop cycle.

        1. Scan vault folders for tasks
        2. Prioritize tasks
        3. Dispatch up to max_concurrent_tasks
        4. Wait for completion
        5. Update dashboard
        """
        self.state.cycle_number += 1
        timer = self.logger.start_timer("cycle")

        self.logger.info(
            "cycle:start",
            input_data={"cycleNumber": self.state.cycle_number},
        )

        try:
            # Phase 1: Scan for tasks
            self.state.phase = LoopPhase.SCANNING
            tasks = await self._scan_for_tasks()

            # Phase 2: Prioritize and schedule
            self.state.phase = LoopPhase.DISPATCHING
            if self._scheduler:
                tasks = self._scheduler.prioritize_tasks(tasks)

            # Limit to max concurrent
            tasks_to_execute = tasks[: self.config.max_concurrent_tasks]
            self.state.pending_tasks = tasks[self.config.max_concurrent_tasks :]

            # Phase 3: Execute tasks concurrently
            self.state.phase = LoopPhase.EXECUTING
            self.state.tasks_in_flight = len(tasks_to_execute)

            if tasks_to_execute:
                async with asyncio.TaskGroup() as tg:
                    for task in tasks_to_execute:
                        tg.create_task(self._execute_task(task))

            # Phase 4: Update dashboard
            self.state.phase = LoopPhase.UPDATING
            await self._update_dashboard()

            self.state.last_cycle_time = datetime.now()
            self.state.phase = LoopPhase.IDLE

            execution_time = timer()
            self.logger.info(
                "cycle:complete",
                output_data={
                    "cycleNumber": self.state.cycle_number,
                    "tasksExecuted": len(tasks_to_execute),
                },
                duration_ms=execution_time,
            )

            # Emit cycle event
            self.event_bus.emit(
                WebSocketEventType.LOOP_CYCLE.value,
                {
                    "action": "cycleComplete",
                    "cycleNumber": self.state.cycle_number,
                    "tasksExecuted": len(tasks_to_execute),
                    "durationMs": execution_time,
                },
            )

        except Exception as e:
            self.state.error = str(e)
            self.logger.error("cycle:error", e, input_data={"cycleNumber": self.state.cycle_number})
            raise

    async def _scan_for_tasks(self) -> list[AgentTask]:
        """
        Scan vault folders for tasks to execute.

        Looks in Needs_Action folder for pending tasks.

        Returns:
            List of tasks to execute
        """
        tasks: list[AgentTask] = []

        try:
            files = await self.vault.list_folder(VaultFolder.NEEDS_ACTION)

            for filename in files:
                vault_file = await self.vault.read_file(VaultFolder.NEEDS_ACTION, filename)
                if vault_file and vault_file.content:
                    task = self._parse_task_from_file(vault_file.content, filename)
                    if task:
                        tasks.append(task)

            self.logger.info(
                "scan:complete",
                output_data={"tasksFound": len(tasks)},
            )

        except Exception as e:
            self.logger.error("scan:error", e)

        return tasks

    def _parse_task_from_file(self, content: dict[str, Any], filename: str) -> AgentTask | None:
        """Parse a task from vault file content."""
        try:
            return AgentTask(
                id=content.get("id", filename.replace(".json", "")),
                type=content.get("type", "unknown"),
                payload=content.get("payload", {}),
                user_id=content.get("user_id", "system"),
                priority=Priority(content.get("priority", "medium")),
                timeout=content.get("timeout", self.config.task_timeout_ms),
                requires_approval=content.get("requires_approval", False),
                correlation_id=content.get("correlation_id"),
            )
        except Exception as e:
            self.logger.error("parse_task:error", e, input_data={"filename": filename})
            return None

    async def _execute_task(self, task: AgentTask) -> AgentResult:
        """
        Execute a single task with retry logic.

        Args:
            task: The task to execute

        Returns:
            AgentResult from the agent
        """
        async with correlation_context(task.correlation_id, task.user_id):
            self.logger.info(
                "execute:start",
                input_data={"taskId": task.id, "type": task.type},
            )

            # Emit task started event
            self.event_bus.emit(
                WebSocketEventType.TASK_STARTED.value,
                {"taskId": task.id, "type": task.type},
            )

            try:
                # Find appropriate agent
                agent = self._find_agent_for_task(task)
                if not agent:
                    raise ValueError(f"No agent found for task type: {task.type}")

                # Execute with retry
                result = await self._execute_with_retry(agent, task)

                # Move task file based on result
                if result.success:
                    await self.vault.move_file(
                        f"{task.id}.json",
                        VaultFolder.NEEDS_ACTION,
                        VaultFolder.DONE,
                        {"result": result.data, "completed_at": datetime.now().isoformat()},
                    )
                    self.state.completed_tasks += 1

                    self.event_bus.emit(
                        WebSocketEventType.TASK_COMPLETED.value,
                        {"taskId": task.id, "success": True, "data": result.data},
                    )
                else:
                    self.state.failed_tasks += 1

                    self.event_bus.emit(
                        WebSocketEventType.TASK_FAILED.value,
                        {
                            "taskId": task.id,
                            "error": result.error.code if result.error else "unknown",
                        },
                    )

                return result

            except Exception as e:
                self.logger.error("execute:error", e, input_data={"taskId": task.id})
                self.state.failed_tasks += 1

                self.event_bus.emit(
                    WebSocketEventType.TASK_FAILED.value,
                    {"taskId": task.id, "error": str(e)},
                )

                from ..interfaces.agent import AgentError

                return AgentResult(
                    success=False,
                    error=AgentError(code="EXECUTION_ERROR", message=str(e), recoverable=True),
                )

            finally:
                self.state.tasks_in_flight -= 1

    def _find_agent_for_task(self, task: AgentTask) -> Any | None:
        """Find an agent that can handle this task."""
        if self._dispatcher:
            return self._dispatcher.find_agent(task)

        # Fallback: check all registered agents
        for agent in self._agents.values():
            if hasattr(agent, "can_handle") and agent.can_handle(task):
                return agent

        return None

    async def _execute_with_retry(self, agent: Any, task: AgentTask) -> AgentResult:
        """
        Execute task with exponential backoff retry.

        Args:
            agent: The agent to execute the task
            task: The task to execute

        Returns:
            AgentResult from the agent
        """
        last_error: Exception | None = None
        backoff_ms = self.config.retry_backoff_ms

        for attempt in range(self.config.retry_attempts):
            try:
                # Use safe_execute if available (from BaseWatcher)
                if hasattr(agent, "safe_execute"):
                    result = await asyncio.wait_for(
                        agent.safe_execute(task),
                        timeout=task.timeout / 1000,
                    )
                else:
                    result = await asyncio.wait_for(
                        agent.execute(task),
                        timeout=task.timeout / 1000,
                    )

                # Check if result indicates we should retry
                if result.success or (result.error and not result.error.recoverable):
                    return result

                # Recoverable error, retry
                last_error = Exception(result.error.message if result.error else "Unknown error")

            except asyncio.TimeoutError:
                last_error = asyncio.TimeoutError(f"Task timed out after {task.timeout}ms")
            except Exception as e:
                last_error = e

            # Log retry attempt
            if attempt < self.config.retry_attempts - 1:
                self.logger.warn(
                    "execute:retry",
                    output_data={
                        "taskId": task.id,
                        "attempt": attempt + 1,
                        "backoffMs": backoff_ms,
                        "error": str(last_error),
                    },
                )
                await asyncio.sleep(backoff_ms / 1000)
                backoff_ms *= 2  # Exponential backoff

        # All retries exhausted
        from ..interfaces.agent import AgentError

        return AgentResult(
            success=False,
            error=AgentError(
                code="RETRY_EXHAUSTED",
                message=f"Failed after {self.config.retry_attempts} attempts: {last_error}",
                recoverable=False,
            ),
        )

    async def _update_dashboard(self) -> None:
        """Update Dashboard.md with current state."""
        try:
            # Collect agent health
            agent_health = []
            for name, agent in self._agents.items():
                if hasattr(agent, "health_check"):
                    health = await agent.health_check()
                    agent_health.append({
                        "name": name,
                        "status": "healthy" if health.healthy else "unhealthy",
                        "last_activity": agent.get_last_activity_relative() if hasattr(agent, "get_last_activity_relative") else "unknown",
                        "tasks_completed": agent._tasks_completed if hasattr(agent, "_tasks_completed") else 0,
                    })

            # Get pending approvals
            pending_files = await self.vault.list_folder(VaultFolder.PENDING_APPROVAL)

            dashboard_state = DashboardState(
                loop_status=self.state.status,
                active_agents=len([a for a in agent_health if a["status"] == "healthy"]),
                total_agents=len(self._agents),
                cycle_number=self.state.cycle_number,
                pending_approvals=[],  # Would populate from pending_files
                task_stats=TaskStats(
                    pending=len(self.state.pending_tasks),
                    in_progress=self.state.tasks_in_flight,
                    completed_today=self.state.completed_tasks,
                    failed_today=self.state.failed_tasks,
                ),
            )

            await self.dashboard.write_dashboard_async(dashboard_state)

            # Emit dashboard update event
            self.event_bus.emit(
                WebSocketEventType.DASHBOARD_UPDATE.value,
                dashboard_state.to_dict(),
            )

        except Exception as e:
            self.logger.error("update_dashboard:error", e)

    def get_state(self) -> LoopState:
        """Get current loop state."""
        return self.state

    def enqueue_task(self, task: AgentTask) -> None:
        """
        Enqueue a task for execution.

        Args:
            task: The task to enqueue
        """
        self.state.pending_tasks.append(task)
        self.logger.info("enqueue_task", input_data={"taskId": task.id, "type": task.type})

        self.event_bus.emit(
            WebSocketEventType.TASK_QUEUED.value,
            {"taskId": task.id, "type": task.type, "priority": task.priority.value},
        )
