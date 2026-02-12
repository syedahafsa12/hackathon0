"""
Base interfaces and data models for the Hackathon Zero architecture.

Defines the IAgent protocol and related data structures that all
Watchers must implement.
"""

from .agent import (
    IAgent,
    AgentTask,
    AgentResult,
    AgentError,
    AgentCapability,
    AgentMetadata,
    HealthStatus,
    Priority,
    TaskStatus,
)

__all__ = [
    "IAgent",
    "AgentTask",
    "AgentResult",
    "AgentError",
    "AgentCapability",
    "AgentMetadata",
    "HealthStatus",
    "Priority",
    "TaskStatus",
]
