"""
Task dispatcher for Ralph Wiggum loop.

Routes tasks to appropriate agents/Watchers based on task type and agent capabilities.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol

from ..interfaces.agent import (
    AgentCapability,
    AgentError,
    AgentResult,
    AgentTask,
    HealthStatus,
    IAgent,
)
from ..logging.structured import StructuredLogger
from ..mcp.events import EventBus, WebSocketEventType, get_event_bus


@dataclass
class DispatcherConfig:
    """
    Configuration for task dispatcher.

    Attributes:
        prefer_healthy_agents: Prefer agents with healthy status
        load_balance: Distribute tasks across capable agents
        max_agent_load: Maximum concurrent tasks per agent
    """
    prefer_healthy_agents: bool = True
    load_balance: bool = True
    max_agent_load: int = 3


@dataclass
class AgentStats:
    """
    Runtime statistics for an agent.

    Attributes:
        tasks_dispatched: Total tasks dispatched to this agent
        tasks_completed: Successful task completions
        tasks_failed: Failed task executions
        current_load: Currently executing tasks
        last_dispatch: Time of last dispatch
        avg_execution_time_ms: Average execution time
    """
    tasks_dispatched: int = 0
    tasks_completed: int = 0
    tasks_failed: int = 0
    current_load: int = 0
    last_dispatch: datetime | None = None
    avg_execution_time_ms: float = 0.0


class Dispatcher:
    """
    Routes tasks to appropriate agents based on capabilities.

    Features:
    - Capability-based routing
    - Health-aware dispatch
    - Load balancing
    - Statistics tracking
    """

    def __init__(
        self,
        config: DispatcherConfig | None = None,
        event_bus: EventBus | None = None,
        log_path: str | None = None,
    ):
        """
        Initialize dispatcher.

        Args:
            config: Dispatcher configuration
            event_bus: Event bus for notifications
            log_path: Path for structured logs
        """
        self.config = config or DispatcherConfig()
        self.event_bus = event_bus or get_event_bus()
        self.logger = StructuredLogger("ralphWiggum:dispatcher", log_path)

        self._agents: dict[str, IAgent] = {}
        self._agent_stats: dict[str, AgentStats] = {}
        self._agent_health: dict[str, HealthStatus] = {}

    def register_agent(self, agent: IAgent) -> None:
        """
        Register an agent with the dispatcher.

        Args:
            agent: Agent implementing IAgent protocol
        """
        name = agent.name
        self._agents[name] = agent
        self._agent_stats[name] = AgentStats()

        self.logger.info(
            "register_agent",
            input_data={
                "name": name,
                "version": agent.version,
                "capabilities": [c.name for c in agent.capabilities],
            },
        )

        self.event_bus.emit(
            WebSocketEventType.AGENT_STATUS.value,
            {
                "action": "registered",
                "name": name,
                "capabilities": [c.name for c in agent.capabilities],
            },
        )

    def unregister_agent(self, name: str) -> bool:
        """
        Unregister an agent from the dispatcher.

        Args:
            name: Agent name

        Returns:
            True if agent was found and removed
        """
        if name not in self._agents:
            return False

        del self._agents[name]
        if name in self._agent_stats:
            del self._agent_stats[name]
        if name in self._agent_health:
            del self._agent_health[name]

        self.logger.info("unregister_agent", input_data={"name": name})

        self.event_bus.emit(
            WebSocketEventType.AGENT_STATUS.value,
            {"action": "unregistered", "name": name},
        )

        return True

    def find_agent(self, task: AgentTask) -> IAgent | None:
        """
        Find an appropriate agent for a task.

        Selection criteria:
        1. Agent can handle task type
        2. Agent is healthy (if prefer_healthy_agents)
        3. Agent has capacity (if load_balance)

        Args:
            task: The task to dispatch

        Returns:
            Agent that can handle the task, or None
        """
        candidates: list[tuple[IAgent, float]] = []

        for name, agent in self._agents.items():
            # Check if agent can handle this task type
            if not agent.can_handle(task):
                continue

            # Calculate score for this agent
            score = self._calculate_agent_score(name, agent, task)
            if score > 0:
                candidates.append((agent, score))

        if not candidates:
            self.logger.warn(
                "find_agent:no_candidates",
                input_data={"taskType": task.type},
            )
            return None

        # Sort by score descending and return best match
        candidates.sort(key=lambda x: x[1], reverse=True)
        selected = candidates[0][0]

        self.logger.info(
            "find_agent",
            input_data={"taskType": task.type, "taskId": task.id},
            output_data={"selected": selected.name, "candidates": len(candidates)},
        )

        return selected

    def _calculate_agent_score(self, name: str, agent: IAgent, task: AgentTask) -> float:
        """
        Calculate a score for an agent's suitability for a task.

        Higher score = better choice.

        Args:
            name: Agent name
            agent: Agent instance
            task: Task to execute

        Returns:
            Score (0 = cannot use, higher = better)
        """
        score = 100.0  # Base score

        stats = self._agent_stats.get(name, AgentStats())
        health = self._agent_health.get(name)

        # Health check penalty
        if self.config.prefer_healthy_agents and health:
            if not health.healthy:
                score -= 50.0

        # Load balancing penalty
        if self.config.load_balance:
            if stats.current_load >= self.config.max_agent_load:
                return 0.0  # Cannot use, at capacity

            # Penalize based on current load
            score -= stats.current_load * 10.0

        # Success rate bonus
        if stats.tasks_dispatched > 0:
            success_rate = stats.tasks_completed / stats.tasks_dispatched
            score += success_rate * 20.0

        # Fast execution bonus
        if stats.avg_execution_time_ms > 0:
            # Faster agents get higher scores (up to +10)
            speed_bonus = max(0, 10 - (stats.avg_execution_time_ms / 1000))
            score += speed_bonus

        return max(0, score)

    async def dispatch_task(self, task: AgentTask) -> AgentResult:
        """
        Dispatch a task to an appropriate agent.

        Args:
            task: Task to dispatch

        Returns:
            Result from the agent
        """
        agent = self.find_agent(task)

        if not agent:
            self.logger.error(
                "dispatch_task:no_agent",
                ValueError(f"No agent for task type: {task.type}"),
                input_data={"taskId": task.id, "type": task.type},
            )
            return AgentResult(
                success=False,
                error=AgentError(
                    code="NO_AGENT_AVAILABLE",
                    message=f"No agent available for task type: {task.type}",
                    recoverable=True,
                ),
            )

        name = agent.name
        stats = self._agent_stats.get(name, AgentStats())

        # Update stats
        stats.tasks_dispatched += 1
        stats.current_load += 1
        stats.last_dispatch = datetime.now()
        self._agent_stats[name] = stats

        self.logger.info(
            "dispatch_task",
            input_data={"taskId": task.id, "type": task.type, "agent": name},
        )

        try:
            # Execute via agent's safe_execute if available
            start_time = datetime.now()

            if hasattr(agent, "safe_execute"):
                result = await agent.safe_execute(task)
            else:
                result = await agent.execute(task)

            # Update execution time stats
            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            self._update_execution_stats(name, execution_time, result.success)

            return result

        except Exception as e:
            self.logger.error(
                "dispatch_task:error",
                e,
                input_data={"taskId": task.id, "agent": name},
            )
            stats.tasks_failed += 1
            return AgentResult(
                success=False,
                error=AgentError(
                    code="DISPATCH_ERROR",
                    message=str(e),
                    recoverable=True,
                ),
            )

        finally:
            stats.current_load -= 1

    def _update_execution_stats(self, name: str, execution_time_ms: float, success: bool) -> None:
        """Update agent execution statistics."""
        stats = self._agent_stats.get(name, AgentStats())

        if success:
            stats.tasks_completed += 1
        else:
            stats.tasks_failed += 1

        # Update rolling average execution time
        total_tasks = stats.tasks_completed + stats.tasks_failed
        if total_tasks > 0:
            # Weighted moving average
            stats.avg_execution_time_ms = (
                stats.avg_execution_time_ms * (total_tasks - 1) + execution_time_ms
            ) / total_tasks

        self._agent_stats[name] = stats

    async def refresh_health(self) -> None:
        """Refresh health status for all agents."""
        for name, agent in self._agents.items():
            try:
                health = await agent.health_check()
                self._agent_health[name] = health

                self.event_bus.emit(
                    WebSocketEventType.AGENT_STATUS.value,
                    {
                        "action": "health",
                        "name": name,
                        "healthy": health.healthy,
                        "details": health.details,
                    },
                )

            except Exception as e:
                self.logger.error(
                    "refresh_health:error",
                    e,
                    input_data={"agent": name},
                )
                self._agent_health[name] = HealthStatus(
                    healthy=False,
                    error=str(e),
                )

    def get_agent_stats(self, name: str) -> AgentStats | None:
        """Get statistics for an agent."""
        return self._agent_stats.get(name)

    def get_all_stats(self) -> dict[str, AgentStats]:
        """Get statistics for all agents."""
        return self._agent_stats.copy()

    def get_capable_agents(self, task_type: str) -> list[str]:
        """
        Get names of agents capable of handling a task type.

        Args:
            task_type: Task type to check

        Returns:
            List of agent names
        """
        capable = []
        for name, agent in self._agents.items():
            capabilities = [c.name for c in agent.capabilities]
            if task_type in capabilities:
                capable.append(name)
        return capable

    def get_registered_agents(self) -> list[dict[str, Any]]:
        """
        Get information about all registered agents.

        Returns:
            List of agent info dictionaries
        """
        agents = []
        for name, agent in self._agents.items():
            stats = self._agent_stats.get(name, AgentStats())
            health = self._agent_health.get(name)

            agents.append({
                "name": name,
                "version": agent.version,
                "capabilities": [c.name for c in agent.capabilities],
                "healthy": health.healthy if health else None,
                "currentLoad": stats.current_load,
                "tasksCompleted": stats.tasks_completed,
                "tasksFailed": stats.tasks_failed,
            })

        return agents
