"""
Email Watcher - handles email-related tasks.

Capabilities:
- Fetch emails
- Send emails (requires approval)
- Search emails
- Mark as read/unread
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


class EmailWatcher(BaseWatcher):
    """
    Watcher for email integration tasks.

    Delegates to existing TypeScript email agent via HTTP.
    """

    _name = "EmailWatcher"
    _version = "1.0.0"
    _description = "Manages email operations including fetch, send, and search"
    _author = "Mini Hafsa Team"

    def __init__(self, ts_agent_url: str = "http://localhost:3001", log_path: str | None = None):
        """
        Initialize Email Watcher.

        Args:
            ts_agent_url: URL of TypeScript agent API
            log_path: Path for structured logs
        """
        super().__init__(log_path)
        self.ts_agent_url = ts_agent_url

    def _get_capabilities(self) -> tuple[AgentCapability, ...]:
        """Return email-specific capabilities."""
        return (
            AgentCapability(
                name="email:fetch",
                description="Fetch emails from inbox",
                input_schema={
                    "type": "object",
                    "properties": {
                        "folder": {"type": "string", "default": "inbox"},
                        "limit": {"type": "integer", "default": 20},
                        "unread_only": {"type": "boolean", "default": False},
                    },
                },
                output_schema={"type": "array", "items": {"type": "object"}},
                requires_approval=False,
            ),
            AgentCapability(
                name="email:send",
                description="Send an email",
                input_schema={
                    "type": "object",
                    "properties": {
                        "to": {"type": "array", "items": {"type": "string"}},
                        "subject": {"type": "string"},
                        "body": {"type": "string"},
                        "cc": {"type": "array", "items": {"type": "string"}},
                        "bcc": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["to", "subject", "body"],
                },
                output_schema={"type": "object"},
                requires_approval=True,
            ),
            AgentCapability(
                name="email:search",
                description="Search emails",
                input_schema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "folder": {"type": "string"},
                        "limit": {"type": "integer"},
                    },
                    "required": ["query"],
                },
                output_schema={"type": "array", "items": {"type": "object"}},
                requires_approval=False,
            ),
            AgentCapability(
                name="email:mark_read",
                description="Mark email as read or unread",
                input_schema={
                    "type": "object",
                    "properties": {
                        "email_id": {"type": "string"},
                        "read": {"type": "boolean"},
                    },
                    "required": ["email_id", "read"],
                },
                output_schema={"type": "object"},
                requires_approval=False,
            ),
        )

    async def execute(self, task: AgentTask) -> AgentResult:
        """
        Execute an email operation.

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
            if task.type == "email:fetch":
                return await self._fetch_emails(task)
            elif task.type == "email:send":
                return await self._send_email(task)
            elif task.type == "email:search":
                return await self._search_emails(task)
            elif task.type == "email:mark_read":
                return await self._mark_read(task)
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
                url = f"{self.ts_agent_url}/api/agents/email{endpoint}"
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

    async def _fetch_emails(self, task: AgentTask) -> AgentResult:
        """Fetch emails from inbox."""
        return await self._make_request("GET", "/fetch", task, task.payload)

    async def _send_email(self, task: AgentTask) -> AgentResult:
        """Send an email."""
        return await self._make_request("POST", "/send", task, task.payload)

    async def _search_emails(self, task: AgentTask) -> AgentResult:
        """Search emails."""
        return await self._make_request("GET", "/search", task, task.payload)

    async def _mark_read(self, task: AgentTask) -> AgentResult:
        """Mark email as read or unread."""
        email_id = task.payload.get("email_id")
        return await self._make_request("PUT", f"/{email_id}/read", task, task.payload)
