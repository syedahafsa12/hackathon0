"""
BaseWatcher abstract class for all agent implementations.

All Watchers should extend this class and implement the required methods.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from ...core.interfaces.agent import (
    AgentCapability,
    AgentError,
    AgentMetadata,
    AgentResult,
    AgentTask,
    HealthStatus,
    IAgent,
)
from ...core.logging.structured import StructuredLogger, correlation_context


class BaseWatcher(ABC):
    """
    Abstract base class for all Watchers.

    Provides common functionality for logging, health tracking,
    and implements the IAgent protocol.

    Subclasses must implement:
        - execute(task): Execute a task and return result
        - _get_capabilities(): Return list of capabilities
    """

    # Class-level metadata (override in subclass)
    _name: str = "BaseWatcher"
    _version: str = "1.0.0"
    _description: str = "Base watcher class"
    _author: str = "Mini Hafsa Team"

    def __init__(self, log_path: str | None = None):
        """
        Initialize the watcher.

        Args:
            log_path: Path for structured logs (optional)
        """
        self.logger = StructuredLogger(f"agent:{self._name.lower()}", log_path)
        self._initialized = False
        self._healthy = True
        self._last_health_check = datetime.now()
        self._tasks_completed = 0
        self._last_activity = datetime.now()

    @property
    def name(self) -> str:
        """Unique agent name."""
        return self._name

    @property
    def version(self) -> str:
        """Semantic version string."""
        return self._version

    @property
    def capabilities(self) -> list[AgentCapability]:
        """List of agent capabilities."""
        return list(self._get_capabilities())

    @abstractmethod
    def _get_capabilities(self) -> tuple[AgentCapability, ...]:
        """
        Return tuple of capabilities.

        Override in subclass to define what this agent can do.

        Returns:
            Tuple of AgentCapability instances
        """
        ...

    async def initialize(self) -> None:
        """
        Initialize agent resources.

        Override in subclass if initialization is needed.
        """
        self.logger.info("initialize")
        self._initialized = True
        self._healthy = True

    @abstractmethod
    async def execute(self, task: AgentTask) -> AgentResult:
        """
        Execute a task and return result.

        Must be implemented by subclass.

        Args:
            task: The task to execute

        Returns:
            AgentResult with success status and data/error
        """
        ...

    async def shutdown(self) -> None:
        """
        Release agent resources.

        Override in subclass if cleanup is needed.
        """
        self.logger.info("shutdown")
        self._initialized = False

    async def health_check(self) -> HealthStatus:
        """
        Check agent health status.

        Override in subclass for custom health checks.

        Returns:
            HealthStatus with current health state
        """
        self._last_health_check = datetime.now()

        return HealthStatus(
            healthy=self._healthy and self._initialized,
            last_check=self._last_health_check,
            details={
                "initialized": self._initialized,
                "tasks_completed": self._tasks_completed,
                "last_activity": self._last_activity.isoformat(),
            },
            error=None if self._healthy else "Agent unhealthy",
        )

    def can_handle(self, task: AgentTask) -> bool:
        """
        Check if agent can handle this task type.

        Default implementation checks if task type matches any capability.

        Args:
            task: The task to check

        Returns:
            True if agent can handle the task
        """
        capability_names = [cap.name for cap in self.capabilities]
        return task.type in capability_names

    def get_metadata(self) -> AgentMetadata:
        """
        Return agent metadata for registration.

        Returns:
            AgentMetadata with agent info
        """
        return AgentMetadata(
            name=self._name,
            version=self._version,
            description=self._description,
            author=self._author,
            capabilities=tuple(self.capabilities),
        )

    async def safe_execute(self, task: AgentTask) -> AgentResult:
        """
        Execute task with error handling and logging.

        Wraps the execute method with:
        - Correlation ID context
        - Timing
        - Error handling
        - Logging

        Args:
            task: The task to execute

        Returns:
            AgentResult with success status and data/error
        """
        timer = self.logger.start_timer("execute")

        async with correlation_context(task.correlation_id, task.user_id):
            self.logger.info(
                f"execute:{task.type}",
                input_data={"task_id": task.id, "payload": task.payload},
            )

            try:
                result = await self.execute(task)

                execution_time = timer()
                result.execution_time = execution_time

                if result.success:
                    self._tasks_completed += 1
                    self._last_activity = datetime.now()
                    self.logger.info(
                        f"execute:{task.type}:complete",
                        output_data={"task_id": task.id, "success": True},
                        duration_ms=execution_time,
                    )
                else:
                    self.logger.warn(
                        f"execute:{task.type}:failed",
                        output_data={
                            "task_id": task.id,
                            "error": result.error.code if result.error else "unknown",
                        },
                        duration_ms=execution_time,
                    )

                return result

            except Exception as e:
                execution_time = timer()
                self.logger.error(f"execute:{task.type}:error", e, input_data={"task_id": task.id})

                return AgentResult(
                    success=False,
                    error=AgentError(
                        code=e.__class__.__name__,
                        message=str(e),
                        recoverable=True,
                    ),
                    execution_time=execution_time,
                )

    def set_healthy(self, healthy: bool, error: str | None = None) -> None:
        """
        Set agent health status.

        Args:
            healthy: Whether agent is healthy
            error: Error message if unhealthy
        """
        self._healthy = healthy
        if not healthy and error:
            self.logger.warn("health:unhealthy", output_data={"error": error})

    def get_last_activity_relative(self) -> str:
        """
        Get last activity as relative time string.

        Returns:
            Relative time string (e.g., "2m ago")
        """
        delta = datetime.now() - self._last_activity
        seconds = delta.total_seconds()

        if seconds < 60:
            return f"{int(seconds)}s ago"
        elif seconds < 3600:
            return f"{int(seconds / 60)}m ago"
        elif seconds < 86400:
            return f"{int(seconds / 3600)}h ago"
        else:
            return f"{int(seconds / 86400)}d ago"
