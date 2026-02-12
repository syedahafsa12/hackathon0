"""
Structured JSON logging with correlation ID tracking.

All logs follow the constitution-defined format with source,
action, correlationId, and structured data fields.
"""

from .structured import StructuredLogger, LogEntry, LogData, LogError, correlation_context

__all__ = [
    "StructuredLogger",
    "LogEntry",
    "LogData",
    "LogError",
    "correlation_context",
]
