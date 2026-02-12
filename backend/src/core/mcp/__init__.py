"""
Master Control Program (MCP) for agent coordination.

Manages agent registration, task routing, approval gateway,
vault operations, and inter-agent communication.
"""

from .server import MCPServer, MCPConfig
from .registry import AgentRegistry
from .vault import VaultManager, VaultPaths, VaultFolder
from .events import EventBus, WebSocketEvent

__all__ = [
    "MCPServer",
    "MCPConfig",
    "AgentRegistry",
    "VaultManager",
    "VaultPaths",
    "VaultFolder",
    "EventBus",
    "WebSocketEvent",
]
