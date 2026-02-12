"""
Structured JSON logging with correlation ID tracking.

All logs follow the constitution-defined format with source,
action, correlationId, and structured data fields.
"""

from __future__ import annotations

import json
import os
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable
import asyncio
import aiofiles


class LogLevel(str, Enum):
    """Log levels."""
    DEBUG = "debug"
    INFO = "info"
    WARN = "warn"
    ERROR = "error"


@dataclass(frozen=True)
class LogError:
    """Error details for log entries."""
    code: str
    message: str
    stack: str | None = None


@dataclass(frozen=True)
class LogData:
    """Structured data for log entries."""
    input: dict[str, Any] | None = None
    output: dict[str, Any] | None = None
    duration_ms: int | None = None


@dataclass
class LogEntry:
    """
    Structured log entry following constitution format.

    Attributes:
        timestamp: ISO 8601 timestamp
        level: Log level (debug, info, warn, error)
        source: Log source (e.g., "agent:linkedin", "loop:ralph")
        action: Action being logged (e.g., "execute:GENERATE_POST")
        correlation_id: UUID for tracing
        user_id: User ID if applicable
        data: Structured input/output/duration data
        error: Error details if level is error
    """
    source: str
    action: str
    level: LogLevel = LogLevel.INFO
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    correlation_id: str = ""
    user_id: str | None = None
    data: LogData = field(default_factory=LogData)
    error: LogError | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert log entry to dictionary for JSON serialization."""
        result: dict[str, Any] = {
            "timestamp": self.timestamp,
            "level": self.level.value,
            "source": self.source,
            "action": self.action,
            "correlationId": self.correlation_id,
        }

        if self.user_id:
            result["userId"] = self.user_id

        result["data"] = {
            "input": self.data.input,
            "output": self.data.output,
            "duration_ms": self.data.duration_ms,
        }

        if self.error:
            result["error"] = {
                "code": self.error.code,
                "message": self.error.message,
                "stack": self.error.stack,
            }

        return result

    def to_json(self) -> str:
        """Convert log entry to JSON string."""
        return json.dumps(self.to_dict())


# Context variables for correlation tracking
_correlation_id: ContextVar[str] = ContextVar("correlation_id", default="")
_user_id: ContextVar[str] = ContextVar("user_id", default="")


class correlation_context:
    """
    Context manager for correlation ID tracking.

    Usage:
        async with correlation_context(correlation_id="abc-123", user_id="user-1"):
            await do_something()  # All logs will have the correlation ID
    """

    def __init__(self, correlation_id: str, user_id: str | None = None):
        self.correlation_id = correlation_id
        self.user_id = user_id
        self._correlation_token = None
        self._user_token = None

    def __enter__(self):
        self._correlation_token = _correlation_id.set(self.correlation_id)
        if self.user_id:
            self._user_token = _user_id.set(self.user_id)
        return self

    def __exit__(self, *args):
        _correlation_id.reset(self._correlation_token)
        if self._user_token:
            _user_id.reset(self._user_token)

    async def __aenter__(self):
        return self.__enter__()

    async def __aexit__(self, *args):
        self.__exit__()


def get_correlation_id() -> str:
    """Get current correlation ID from context."""
    return _correlation_id.get()


def get_user_id() -> str:
    """Get current user ID from context."""
    return _user_id.get()


class StructuredLogger:
    """
    Structured JSON logger with correlation ID support.

    Logs to console and optionally to file in the vault/Logs/ directory.
    """

    def __init__(
        self,
        source: str,
        log_path: str | None = None,
        console_output: bool = True,
    ):
        """
        Initialize the logger.

        Args:
            source: Log source identifier (e.g., "agent:linkedin")
            log_path: Path to log directory (optional)
            console_output: Whether to print to console
        """
        self.source = source
        self.log_path = Path(log_path) if log_path else None
        self.console_output = console_output
        self._timers: dict[str, float] = {}

    def _create_entry(
        self,
        level: LogLevel,
        action: str,
        data: dict[str, Any] | None = None,
        error: Exception | None = None,
        input_data: dict[str, Any] | None = None,
        output_data: dict[str, Any] | None = None,
        duration_ms: int | None = None,
    ) -> LogEntry:
        """Create a log entry with current context."""
        log_data = LogData(
            input=input_data or (data.get("input") if data else None),
            output=output_data or (data.get("output") if data else None),
            duration_ms=duration_ms or (data.get("duration_ms") if data else None),
        )

        log_error = None
        if error:
            import traceback
            log_error = LogError(
                code=error.__class__.__name__,
                message=str(error),
                stack=traceback.format_exc(),
            )

        return LogEntry(
            source=self.source,
            action=action,
            level=level,
            correlation_id=get_correlation_id(),
            user_id=get_user_id() or None,
            data=log_data,
            error=log_error,
        )

    def _log(self, entry: LogEntry) -> None:
        """Output log entry to console and/or file."""
        json_str = entry.to_json()

        if self.console_output:
            # Color-code by level
            colors = {
                LogLevel.DEBUG: "\033[90m",  # Gray
                LogLevel.INFO: "\033[0m",    # Default
                LogLevel.WARN: "\033[93m",   # Yellow
                LogLevel.ERROR: "\033[91m",  # Red
            }
            reset = "\033[0m"
            print(f"{colors[entry.level]}[{entry.level.value.upper()}] {entry.source}: {entry.action}{reset}")

        if self.log_path:
            # Schedule async file write
            asyncio.create_task(self._write_to_file(entry))

    async def _write_to_file(self, entry: LogEntry) -> None:
        """Write log entry to file asynchronously."""
        if not self.log_path:
            return

        # Determine log file based on source
        source_parts = self.source.split(":")
        if len(source_parts) >= 2:
            category = source_parts[0]  # e.g., "agent", "loop", "mcp"
        else:
            category = "system"

        log_dir = self.log_path / category
        log_dir.mkdir(parents=True, exist_ok=True)

        date_str = datetime.now().strftime("%Y-%m-%d")
        log_file = log_dir / f"{date_str}.jsonl"

        try:
            async with aiofiles.open(log_file, mode="a") as f:
                await f.write(entry.to_json() + "\n")
        except Exception as e:
            print(f"[ERROR] Failed to write log: {e}")

    def debug(self, action: str, data: dict[str, Any] | None = None, **kwargs) -> None:
        """Log debug message."""
        entry = self._create_entry(LogLevel.DEBUG, action, data, **kwargs)
        self._log(entry)

    def info(self, action: str, data: dict[str, Any] | None = None, **kwargs) -> None:
        """Log info message."""
        entry = self._create_entry(LogLevel.INFO, action, data, **kwargs)
        self._log(entry)

    def warn(self, action: str, data: dict[str, Any] | None = None, **kwargs) -> None:
        """Log warning message."""
        entry = self._create_entry(LogLevel.WARN, action, data, **kwargs)
        self._log(entry)

    def error(self, action: str, error: Exception, data: dict[str, Any] | None = None, **kwargs) -> None:
        """Log error message."""
        entry = self._create_entry(LogLevel.ERROR, action, data, error=error, **kwargs)
        self._log(entry)

    def start_timer(self, action: str) -> Callable[[], int]:
        """
        Start a timer for an action.

        Returns:
            Function that returns elapsed time in ms when called
        """
        import time
        start_time = time.perf_counter()

        def stop() -> int:
            elapsed = time.perf_counter() - start_time
            return int(elapsed * 1000)

        return stop

    async def flush(self) -> None:
        """Ensure all pending writes are completed."""
        # Give time for async writes to complete
        await asyncio.sleep(0.1)
