"""
IAgent Protocol and related data structures.

All Watchers must implement the IAgent protocol to integrate with
the Ralph Wiggum loop and MCP server.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Protocol, runtime_checkable


class Priority(str, Enum):
    """Task priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskStatus(str, Enum):
    """Task execution status."""
    CREATED = "created"
    QUEUED = "queued"
    DISPATCHED = "dispatched"
    EXECUTING = "executing"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass(frozen=True)
class AgentCapability:
    """
    Describes what an agent can do.

    Attributes:
        name: Capability name (e.g., "GENERATE_POST")
        description: Human-readable description
        requires_approval: Whether HITL is needed for this action
        priority: Default priority for this capability
        timeout: Default timeout in milliseconds
    """
    name: str
    description: str
    requires_approval: bool = False
    priority: Priority = Priority.MEDIUM
    timeout: int = 30000


@dataclass(frozen=True)
class AgentError:
    """
    Represents an error during task execution.

    Attributes:
        code: Error code (e.g., "TIMEOUT", "API_ERROR")
        message: Human-readable message
        recoverable: Whether retry might succeed
        retry_after: Milliseconds to wait before retry (if recoverable)
    """
    code: str
    message: str
    recoverable: bool = True
    retry_after: int | None = None


@dataclass(frozen=True)
class HealthStatus:
    """
    Represents agent health state.

    Attributes:
        healthy: Overall health status
        last_check: When last checked
        details: Agent-specific health data
        error: Error message if unhealthy
    """
    healthy: bool
    last_check: datetime = field(default_factory=datetime.now)
    details: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


@dataclass(frozen=True)
class AgentMetadata:
    """
    Agent metadata for registration and discovery.

    Attributes:
        name: Unique agent name
        version: Semantic version
        description: Human-readable description
        author: Agent author
        capabilities: List of capabilities
    """
    name: str
    version: str
    description: str
    author: str = "Mini Hafsa Team"
    capabilities: tuple[AgentCapability, ...] = field(default_factory=tuple)


@dataclass
class AgentTask:
    """
    Represents a unit of work to be executed by a Watcher.

    Attributes:
        id: UUID v4 identifier
        type: Task type (e.g., "GENERATE_POST", "SEND_EMAIL")
        priority: Task priority level
        payload: Task-specific data
        timeout: Timeout in milliseconds
        requires_approval: Whether HITL is needed
        correlation_id: UUID for log tracing
        user_id: Owner of the task
        created_at: Creation timestamp
        status: Current task status
    """
    type: str
    payload: dict[str, Any]
    user_id: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    priority: Priority = Priority.MEDIUM
    timeout: int = 30000
    requires_approval: bool = False
    correlation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=datetime.now)
    status: TaskStatus = TaskStatus.CREATED

    def to_dict(self) -> dict[str, Any]:
        """Convert task to dictionary for serialization."""
        return {
            "id": self.id,
            "type": self.type,
            "priority": self.priority.value,
            "payload": self.payload,
            "timeout": self.timeout,
            "requires_approval": self.requires_approval,
            "correlation_id": self.correlation_id,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat(),
            "status": self.status.value,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AgentTask:
        """Create task from dictionary."""
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            type=data["type"],
            priority=Priority(data.get("priority", "medium")),
            payload=data.get("payload", {}),
            timeout=data.get("timeout", 30000),
            requires_approval=data.get("requires_approval", False),
            correlation_id=data.get("correlation_id", str(uuid.uuid4())),
            user_id=data["user_id"],
            created_at=datetime.fromisoformat(data["created_at"]) if "created_at" in data else datetime.now(),
            status=TaskStatus(data.get("status", "created")),
        )


@dataclass
class AgentResult:
    """
    Represents the outcome of task execution.

    Attributes:
        success: Whether execution succeeded
        data: Result data if successful
        error: Error details if failed
        approval_id: If task requires approval
        execution_time: Execution time in milliseconds
        logs: Execution log entries
    """
    success: bool
    data: dict[str, Any] | None = None
    error: AgentError | None = None
    approval_id: str | None = None
    execution_time: int = 0
    logs: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert result to dictionary for serialization."""
        return {
            "success": self.success,
            "data": self.data,
            "error": {
                "code": self.error.code,
                "message": self.error.message,
                "recoverable": self.error.recoverable,
                "retry_after": self.error.retry_after,
            } if self.error else None,
            "approval_id": self.approval_id,
            "execution_time": self.execution_time,
            "logs": self.logs,
        }


@runtime_checkable
class IAgent(Protocol):
    """
    Interface that all Watchers must implement.

    This protocol defines the contract for agent implementations
    to integrate with the Ralph Wiggum loop and MCP server.
    """

    @property
    def name(self) -> str:
        """Unique agent name."""
        ...

    @property
    def version(self) -> str:
        """Semantic version string."""
        ...

    @property
    def capabilities(self) -> list[AgentCapability]:
        """List of agent capabilities."""
        ...

    async def initialize(self) -> None:
        """Initialize agent resources."""
        ...

    async def execute(self, task: AgentTask) -> AgentResult:
        """
        Execute a task and return result.

        Args:
            task: The task to execute

        Returns:
            AgentResult with success status and data/error
        """
        ...

    async def shutdown(self) -> None:
        """Release agent resources."""
        ...

    async def health_check(self) -> HealthStatus:
        """Check agent health status."""
        ...

    def can_handle(self, task: AgentTask) -> bool:
        """
        Check if agent can handle this task type.

        Args:
            task: The task to check

        Returns:
            True if agent can handle the task
        """
        ...

    def get_metadata(self) -> AgentMetadata:
        """Return agent metadata for registration."""
        ...
