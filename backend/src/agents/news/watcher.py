"""
News Watcher - handles news and RSS feed tasks.

Capabilities:
- Fetch news headlines
- Search news articles
- Get topic trends
- Manage RSS feeds
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


class NewsWatcher(BaseWatcher):
    """
    Watcher for news and RSS feed operations.

    Delegates to existing TypeScript news agent via HTTP.
    """

    _name = "NewsWatcher"
    _version = "1.0.0"
    _description = "Fetches and processes news articles and RSS feeds"
    _author = "Mini Hafsa Team"

    def __init__(self, ts_agent_url: str = "http://localhost:3001", log_path: str | None = None):
        """
        Initialize News Watcher.

        Args:
            ts_agent_url: URL of TypeScript agent API
            log_path: Path for structured logs
        """
        super().__init__(log_path)
        self.ts_agent_url = ts_agent_url

    def _get_capabilities(self) -> tuple[AgentCapability, ...]:
        """Return news-specific capabilities."""
        return (
            AgentCapability(
                name="news:headlines",
                description="Fetch top news headlines",
                input_schema={
                    "type": "object",
                    "properties": {
                        "category": {"type": "string"},
                        "country": {"type": "string", "default": "us"},
                        "limit": {"type": "integer", "default": 10},
                    },
                },
                output_schema={"type": "array", "items": {"type": "object"}},
                requires_approval=False,
            ),
            AgentCapability(
                name="news:search",
                description="Search news articles",
                input_schema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "from_date": {"type": "string", "format": "date"},
                        "to_date": {"type": "string", "format": "date"},
                        "sources": {"type": "array", "items": {"type": "string"}},
                        "limit": {"type": "integer", "default": 20},
                    },
                    "required": ["query"],
                },
                output_schema={"type": "array", "items": {"type": "object"}},
                requires_approval=False,
            ),
            AgentCapability(
                name="news:trends",
                description="Get trending topics",
                input_schema={
                    "type": "object",
                    "properties": {
                        "category": {"type": "string"},
                        "limit": {"type": "integer", "default": 10},
                    },
                },
                output_schema={"type": "array", "items": {"type": "object"}},
                requires_approval=False,
            ),
            AgentCapability(
                name="news:rss_fetch",
                description="Fetch articles from RSS feed",
                input_schema={
                    "type": "object",
                    "properties": {
                        "feed_url": {"type": "string"},
                        "limit": {"type": "integer", "default": 20},
                    },
                    "required": ["feed_url"],
                },
                output_schema={"type": "array", "items": {"type": "object"}},
                requires_approval=False,
            ),
        )

    async def execute(self, task: AgentTask) -> AgentResult:
        """
        Execute a news operation.

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
            if task.type == "news:headlines":
                return await self._fetch_headlines(task)
            elif task.type == "news:search":
                return await self._search_news(task)
            elif task.type == "news:trends":
                return await self._get_trends(task)
            elif task.type == "news:rss_fetch":
                return await self._fetch_rss(task)
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
                url = f"{self.ts_agent_url}/api/agents/news{endpoint}"
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

    async def _fetch_headlines(self, task: AgentTask) -> AgentResult:
        """Fetch top news headlines."""
        return await self._make_request("GET", "/headlines", task, task.payload)

    async def _search_news(self, task: AgentTask) -> AgentResult:
        """Search news articles."""
        return await self._make_request("POST", "/search", task, task.payload)

    async def _get_trends(self, task: AgentTask) -> AgentResult:
        """Get trending topics."""
        return await self._make_request("GET", "/trends", task, task.payload)

    async def _fetch_rss(self, task: AgentTask) -> AgentResult:
        """Fetch articles from RSS feed."""
        return await self._make_request("POST", "/rss", task, task.payload)
