"""
Daily Summary Watcher - generates daily summary reports.

Capabilities:
- Generate daily summary
- Compile activity reports
- Create briefings
"""

from __future__ import annotations

import aiohttp
from datetime import datetime
from typing import Any

from ...core.interfaces.agent import (
    AgentCapability,
    AgentError,
    AgentResult,
    AgentTask,
)
from ..base.watcher import BaseWatcher


class DailySummaryWatcher(BaseWatcher):
    """
    Watcher for generating daily summary reports.

    Aggregates data from other agents to create comprehensive summaries.
    """

    _name = "DailySummaryWatcher"
    _version = "1.0.0"
    _description = "Generates daily summary reports and briefings"
    _author = "Mini Hafsa Team"

    def __init__(self, ts_agent_url: str = "http://localhost:3001", log_path: str | None = None):
        """
        Initialize Daily Summary Watcher.

        Args:
            ts_agent_url: URL of TypeScript agent API
            log_path: Path for structured logs
        """
        super().__init__(log_path)
        self.ts_agent_url = ts_agent_url

    def _get_capabilities(self) -> tuple[AgentCapability, ...]:
        """Return daily summary capabilities."""
        return (
            AgentCapability(
                name="summary:daily",
                description="Generate a daily summary report",
                input_schema={
                    "type": "object",
                    "properties": {
                        "date": {"type": "string", "format": "date"},
                        "include_sections": {
                            "type": "array",
                            "items": {"type": "string"},
                            "default": ["tasks", "calendar", "email", "news"],
                        },
                    },
                },
                output_schema={"type": "object"},
                requires_approval=False,
            ),
            AgentCapability(
                name="summary:activity",
                description="Generate an activity report for a date range",
                input_schema={
                    "type": "object",
                    "properties": {
                        "start_date": {"type": "string", "format": "date"},
                        "end_date": {"type": "string", "format": "date"},
                        "group_by": {"type": "string", "enum": ["day", "week", "category"]},
                    },
                    "required": ["start_date", "end_date"],
                },
                output_schema={"type": "object"},
                requires_approval=False,
            ),
            AgentCapability(
                name="summary:briefing",
                description="Generate a morning briefing",
                input_schema={
                    "type": "object",
                    "properties": {
                        "timezone": {"type": "string", "default": "UTC"},
                    },
                },
                output_schema={"type": "object"},
                requires_approval=False,
            ),
        )

    async def execute(self, task: AgentTask) -> AgentResult:
        """
        Execute a summary operation.

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
            if task.type == "summary:daily":
                return await self._generate_daily_summary(task)
            elif task.type == "summary:activity":
                return await self._generate_activity_report(task)
            elif task.type == "summary:briefing":
                return await self._generate_briefing(task)
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
                url = f"{self.ts_agent_url}/api/agents/summary{endpoint}"
                timeout = aiohttp.ClientTimeout(total=task.timeout / 1000)

                if method == "GET":
                    async with session.get(url, params=json_data, timeout=timeout) as response:
                        return await self._handle_response(response)
                elif method == "POST":
                    async with session.post(url, json=json_data, timeout=timeout) as response:
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
        if response.status == 200:
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

    async def _generate_daily_summary(self, task: AgentTask) -> AgentResult:
        """Generate a daily summary report."""
        # Use today's date if not provided
        payload = task.payload.copy()
        if "date" not in payload:
            payload["date"] = datetime.now().strftime("%Y-%m-%d")

        return await self._make_request("POST", "/daily", task, payload)

    async def _generate_activity_report(self, task: AgentTask) -> AgentResult:
        """Generate an activity report for a date range."""
        return await self._make_request("POST", "/activity", task, task.payload)

    async def _generate_briefing(self, task: AgentTask) -> AgentResult:
        """Generate a morning briefing."""
        return await self._make_request("POST", "/briefing", task, task.payload)
