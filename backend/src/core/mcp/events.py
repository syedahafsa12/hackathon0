"""
Event bus and WebSocket event types for inter-component communication.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable
import asyncio


class WebSocketEventType(str, Enum):
    """WebSocket event types for frontend communication."""
    AGENT_STATUS = "agent:status"
    TASK_QUEUED = "task:queued"
    TASK_STARTED = "task:started"
    TASK_COMPLETED = "task:completed"
    TASK_FAILED = "task:failed"
    APPROVAL_PENDING = "approval:pending"
    APPROVAL_RESOLVED = "approval:resolved"
    LOG_ENTRY = "log:entry"
    DASHBOARD_UPDATE = "dashboard:update"
    LOOP_CYCLE = "loop:cycle"


@dataclass
class WebSocketEvent:
    """
    Event sent from Python MCP to TypeScript server for frontend broadcast.

    Attributes:
        type: Event type
        data: Event payload
        timestamp: ISO 8601 timestamp
        correlation_id: For tracing (optional)
    """
    type: WebSocketEventType
    data: dict[str, Any]
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    correlation_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "type": self.type.value,
            "data": self.data,
            "timestamp": self.timestamp,
            "correlationId": self.correlation_id,
        }


# Type alias for event handlers
EventHandler = Callable[[str, Any], None]
AsyncEventHandler = Callable[[str, Any], Any]  # Coroutine


class EventBus:
    """
    Simple event bus for inter-component communication.

    Supports both sync and async event handlers.
    """

    def __init__(self):
        self._handlers: dict[str, list[EventHandler | AsyncEventHandler]] = {}
        self._async_handlers: dict[str, list[AsyncEventHandler]] = {}

    def on(self, event: str, handler: EventHandler | AsyncEventHandler) -> None:
        """
        Register event handler.

        Args:
            event: Event name (can use wildcards like "task:*")
            handler: Handler function (sync or async)
        """
        if asyncio.iscoroutinefunction(handler):
            if event not in self._async_handlers:
                self._async_handlers[event] = []
            self._async_handlers[event].append(handler)
        else:
            if event not in self._handlers:
                self._handlers[event] = []
            self._handlers[event].append(handler)

    def off(self, event: str, handler: EventHandler | AsyncEventHandler) -> None:
        """
        Unregister event handler.

        Args:
            event: Event name
            handler: Handler function to remove
        """
        if event in self._handlers and handler in self._handlers[event]:
            self._handlers[event].remove(handler)
        if event in self._async_handlers and handler in self._async_handlers[event]:
            self._async_handlers[event].remove(handler)

    def emit(self, event: str, data: Any = None) -> None:
        """
        Emit event synchronously.

        Args:
            event: Event name
            data: Event data
        """
        # Call exact match handlers
        if event in self._handlers:
            for handler in self._handlers[event]:
                try:
                    handler(event, data)
                except Exception as e:
                    print(f"[EventBus] Handler error for {event}: {e}")

        # Call wildcard handlers
        for pattern, handlers in self._handlers.items():
            if pattern.endswith("*") and event.startswith(pattern[:-1]):
                for handler in handlers:
                    try:
                        handler(event, data)
                    except Exception as e:
                        print(f"[EventBus] Wildcard handler error for {event}: {e}")

    async def emit_async(self, event: str, data: Any = None) -> None:
        """
        Emit event asynchronously.

        Args:
            event: Event name
            data: Event data
        """
        # Call sync handlers
        self.emit(event, data)

        # Call async handlers
        tasks = []

        # Exact match async handlers
        if event in self._async_handlers:
            for handler in self._async_handlers[event]:
                tasks.append(asyncio.create_task(self._safe_call_async(handler, event, data)))

        # Wildcard async handlers
        for pattern, handlers in self._async_handlers.items():
            if pattern.endswith("*") and event.startswith(pattern[:-1]):
                for handler in handlers:
                    tasks.append(asyncio.create_task(self._safe_call_async(handler, event, data)))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _safe_call_async(self, handler: AsyncEventHandler, event: str, data: Any) -> None:
        """Safely call async handler with error handling."""
        try:
            await handler(event, data)
        except Exception as e:
            print(f"[EventBus] Async handler error for {event}: {e}")

    def clear(self) -> None:
        """Clear all handlers."""
        self._handlers.clear()
        self._async_handlers.clear()


# Global event bus instance
_global_event_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    """Get or create global event bus instance."""
    global _global_event_bus
    if _global_event_bus is None:
        _global_event_bus = EventBus()
    return _global_event_bus
