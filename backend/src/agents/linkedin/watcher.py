"""
LinkedIn Watcher - handles LinkedIn-related tasks.

Capabilities:
- Fetch LinkedIn notifications
- Process connection requests
- Monitor profile views
- Fetch messages
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


class LinkedInWatcher(BaseWatcher):
    """
    Watcher for LinkedIn integration tasks.

    Delegates to existing TypeScript LinkedIn agent via HTTP.
    """

    _name = "LinkedInWatcher"
    _version = "1.0.0"
    _description = "Monitors LinkedIn notifications, connections, and messages"
    _author = "Mini Hafsa Team"

    def __init__(self, ts_agent_url: str = "http://localhost:3001", log_path: str | None = None):
        """
        Initialize LinkedIn Watcher.

        Args:
            ts_agent_url: URL of TypeScript agent API
            log_path: Path for structured logs
        """
        super().__init__(log_path)
        self.ts_agent_url = ts_agent_url

    def _get_capabilities(self) -> tuple[AgentCapability, ...]:
        """Return LinkedIn-specific capabilities."""
        return (
            AgentCapability(
                name="linkedin:notifications",
                description="Fetch and process LinkedIn notifications",
                input_schema={"type": "object", "properties": {"limit": {"type": "integer"}}},
                output_schema={"type": "array", "items": {"type": "object"}},
                requires_approval=False,
            ),
            AgentCapability(
                name="linkedin:connections",
                description="Process LinkedIn connection requests",
                input_schema={"type": "object", "properties": {"action": {"type": "string"}}},
                output_schema={"type": "object"},
                requires_approval=True,
            ),
            AgentCapability(
                name="linkedin:messages",
                description="Fetch LinkedIn messages",
                input_schema={"type": "object", "properties": {"limit": {"type": "integer"}}},
                output_schema={"type": "array", "items": {"type": "object"}},
                requires_approval=False,
            ),
            AgentCapability(
                name="linkedin:profile_views",
                description="Get profile view statistics",
                input_schema={"type": "object", "properties": {}},
                output_schema={"type": "object"},
                requires_approval=False,
            ),
        )

    async def execute(self, task: AgentTask) -> AgentResult:
        """
        Execute a LinkedIn task.

        Delegates to TypeScript agent via HTTP.

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
            # Route to appropriate handler
            if task.type == "linkedin:notifications":
                return await self._fetch_notifications(task)
            elif task.type == "linkedin:connections":
                return await self._process_connections(task)
            elif task.type == "linkedin:messages":
                return await self._fetch_messages(task)
            elif task.type == "linkedin:profile_views":
                return await self._get_profile_views(task)
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

    async def _fetch_notifications(self, task: AgentTask) -> AgentResult:
        """Fetch LinkedIn notifications via TypeScript agent."""
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    f"{self.ts_agent_url}/api/agents/linkedin/notifications",
                    json=task.payload,
                    timeout=aiohttp.ClientTimeout(total=task.timeout / 1000),
                ) as response:
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
            except aiohttp.ClientError as e:
                return AgentResult(
                    success=False,
                    error=AgentError(
                        code="HTTP_ERROR",
                        message=str(e),
                        recoverable=True,
                    ),
                )

    async def _process_connections(self, task: AgentTask) -> AgentResult:
        """Process LinkedIn connection requests."""
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    f"{self.ts_agent_url}/api/agents/linkedin/connections",
                    json=task.payload,
                    timeout=aiohttp.ClientTimeout(total=task.timeout / 1000),
                ) as response:
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
            except aiohttp.ClientError as e:
                return AgentResult(
                    success=False,
                    error=AgentError(
                        code="HTTP_ERROR",
                        message=str(e),
                        recoverable=True,
                    ),
                )

    async def _fetch_messages(self, task: AgentTask) -> AgentResult:
        """Fetch LinkedIn messages."""
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    f"{self.ts_agent_url}/api/agents/linkedin/messages",
                    json=task.payload,
                    timeout=aiohttp.ClientTimeout(total=task.timeout / 1000),
                ) as response:
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
            except aiohttp.ClientError as e:
                return AgentResult(
                    success=False,
                    error=AgentError(
                        code="HTTP_ERROR",
                        message=str(e),
                        recoverable=True,
                    ),
                )

    async def _get_profile_views(self, task: AgentTask) -> AgentResult:
        """Get LinkedIn profile view statistics."""
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(
                    f"{self.ts_agent_url}/api/agents/linkedin/profile-views",
                    timeout=aiohttp.ClientTimeout(total=task.timeout / 1000),
                ) as response:
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
            except aiohttp.ClientError as e:
                return AgentResult(
                    success=False,
                    error=AgentError(
                        code="HTTP_ERROR",
                        message=str(e),
                        recoverable=True,
                    ),
                )
