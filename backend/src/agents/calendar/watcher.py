"""
Calendar Watcher - handles calendar-related tasks.

Capabilities:
- Fetch events
- Create events (requires approval)
- Update events
- Delete events (requires approval)
- Check availability
"""

from __future__ import annotations

import aiohttp
from typing import Any

from ...core.interfaces.agent import (
    AgentCapability,
    AgentError,
    AgentResult,
    AgentTask,
)
from ..base.watcher import BaseWatcher


class CalendarWatcher(BaseWatcher):
    """
    Watcher for calendar integration tasks.

    Delegates to existing TypeScript calendar agent via HTTP.
    """

    _name = "CalendarWatcher"
    _version = "1.0.0"
    _description = "Manages calendar events and availability"
    _author = "Mini Hafsa Team"

    def __init__(self, ts_agent_url: str = "http://localhost:3001", log_path: str | None = None):
        """
        Initialize Calendar Watcher.

        Args:
            ts_agent_url: URL of TypeScript agent API
            log_path: Path for structured logs
        """
        super().__init__(log_path)
        self.ts_agent_url = ts_agent_url

    def _get_capabilities(self) -> tuple[AgentCapability, ...]:
        """Return calendar-specific capabilities."""
        return (
            AgentCapability(
                name="calendar:fetch",
                description="Fetch calendar events",
                input_schema={
                    "type": "object",
                    "properties": {
                        "start_date": {"type": "string", "format": "date-time"},
                        "end_date": {"type": "string", "format": "date-time"},
                        "calendar_id": {"type": "string"},
                    },
                },
                output_schema={"type": "array", "items": {"type": "object"}},
                requires_approval=False,
            ),
            AgentCapability(
                name="calendar:create",
                description="Create a calendar event",
                input_schema={
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "start_time": {"type": "string", "format": "date-time"},
                        "end_time": {"type": "string", "format": "date-time"},
                        "attendees": {"type": "array", "items": {"type": "string"}},
                        "description": {"type": "string"},
                        "location": {"type": "string"},
                    },
                    "required": ["title", "start_time", "end_time"],
                },
                output_schema={"type": "object"},
                requires_approval=True,
            ),
            AgentCapability(
                name="calendar:update",
                description="Update a calendar event",
                input_schema={
                    "type": "object",
                    "properties": {
                        "event_id": {"type": "string"},
                        "title": {"type": "string"},
                        "start_time": {"type": "string"},
                        "end_time": {"type": "string"},
                    },
                    "required": ["event_id"],
                },
                output_schema={"type": "object"},
                requires_approval=False,
            ),
            AgentCapability(
                name="calendar:delete",
                description="Delete a calendar event",
                input_schema={
                    "type": "object",
                    "properties": {"event_id": {"type": "string"}},
                    "required": ["event_id"],
                },
                output_schema={"type": "object"},
                requires_approval=True,
            ),
            AgentCapability(
                name="calendar:availability",
                description="Check availability for a time range",
                input_schema={
                    "type": "object",
                    "properties": {
                        "start_time": {"type": "string", "format": "date-time"},
                        "end_time": {"type": "string", "format": "date-time"},
                    },
                    "required": ["start_time", "end_time"],
                },
                output_schema={"type": "object"},
                requires_approval=False,
            ),
        )

    async def execute(self, task: AgentTask) -> AgentResult:
        """
        Execute a calendar operation.

        Args:
            task: The task to execute

        Returns:
            AgentResult with data or error
        """
        self.logger.info(
            f"execute:{task.type}",
            input_data={"taskId": task.id, "payload": task.payload},
        )

        try:
            if task.type == "calendar:fetch":
                return await self._fetch_events(task)
            elif task.type == "calendar:create":
                return await self._create_event(task)
            elif task.type == "calendar:update":
                return await self._update_event(task)
            elif task.type == "calendar:delete":
                return await self._delete_event(task)
            elif task.type == "calendar:availability":
                return await self._check_availability(task)
            else:
                return AgentResult(
                    success=False,
                    error=AgentError(
                        code="UNKNOWN_TASK_TYPE",
                        message=f"Unknown task type: {task.type}",
                        recoverable=False,
                    ),
                )

        except Exception as e:
            self.logger.error(f"execute:{task.type}", e)
            return AgentResult(
                success=False,
                error=AgentError(
                    code="EXECUTION_ERROR",
                    message=str(e),
                    recoverable=True,
                ),
            )

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        task: AgentTask,
        json_data: dict | None = None,
    ) -> AgentResult:
        """Make HTTP request to TypeScript agent."""
        async with aiohttp.ClientSession() as session:
            try:
                url = f"{self.ts_agent_url}/api/agents/calendar{endpoint}"
                timeout = aiohttp.ClientTimeout(total=task.timeout / 1000)

                if method == "GET":
                    async with session.get(url, params=json_data, timeout=timeout) as response:
                        return await self._handle_response(response)
                elif method == "POST":
                    async with session.post(url, json=json_data, timeout=timeout) as response:
                        return await self._handle_response(response)
                elif method == "PUT":
                    async with session.put(url, json=json_data, timeout=timeout) as response:
                        return await self._handle_response(response)
                elif method == "DELETE":
                    async with session.delete(url, timeout=timeout) as response:
                        return await self._handle_response(response)
                else:
                    return AgentResult(
                        success=False,
                        error=AgentError(
                            code="INVALID_METHOD",
                            message=f"Invalid HTTP method: {method}",
                            recoverable=False,
                        ),
                    )

            except aiohttp.ClientError as e:
                return AgentResult(
                    success=False,
                    error=AgentError(
                        code="HTTP_ERROR",
                        message=str(e),
                        recoverable=True,
                    ),
                )

    async def _handle_response(self, response: aiohttp.ClientResponse) -> AgentResult:
        """Handle HTTP response from TypeScript agent."""
        if response.status == 200 or response.status == 201:
            data = await response.json()
            return AgentResult(success=True, data=data)
        else:
            error_text = await response.text()
            return AgentResult(
                success=False,
                error=AgentError(
                    code=f"HTTP_{response.status}",
                    message=error_text,
                    recoverable=response.status >= 500,
                ),
            )

    async def _fetch_events(self, task: AgentTask) -> AgentResult:
        """Fetch calendar events."""
        return await self._make_request("GET", "/events", task, task.payload)

    async def _create_event(self, task: AgentTask) -> AgentResult:
        """Create a calendar event."""
        return await self._make_request("POST", "/events", task, task.payload)

    async def _update_event(self, task: AgentTask) -> AgentResult:
        """Update a calendar event."""
        event_id = task.payload.get("event_id")
        return await self._make_request("PUT", f"/events/{event_id}", task, task.payload)

    async def _delete_event(self, task: AgentTask) -> AgentResult:
        """Delete a calendar event."""
        event_id = task.payload.get("event_id")
        return await self._make_request("DELETE", f"/events/{event_id}", task)

    async def _check_availability(self, task: AgentTask) -> AgentResult:
        """Check availability for a time range."""
        return await self._make_request("GET", "/availability", task, task.payload)
