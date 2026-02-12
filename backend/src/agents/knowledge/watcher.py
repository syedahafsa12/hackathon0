"""
Knowledge Watcher - handles knowledge base and RAG tasks.

Capabilities:
- Search knowledge base
- Add documents
- Update documents
- Query with context
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


class KnowledgeWatcher(BaseWatcher):
    """
    Watcher for knowledge base and RAG operations.

    Delegates to existing TypeScript knowledge agent via HTTP.
    """

    _name = "KnowledgeWatcher"
    _version = "1.0.0"
    _description = "Manages knowledge base, document storage, and RAG queries"
    _author = "Mini Hafsa Team"

    def __init__(self, ts_agent_url: str = "http://localhost:3001", log_path: str | None = None):
        """
        Initialize Knowledge Watcher.

        Args:
            ts_agent_url: URL of TypeScript agent API
            log_path: Path for structured logs
        """
        super().__init__(log_path)
        self.ts_agent_url = ts_agent_url

    def _get_capabilities(self) -> tuple[AgentCapability, ...]:
        """Return knowledge-specific capabilities."""
        return (
            AgentCapability(
                name="knowledge:search",
                description="Search the knowledge base",
                input_schema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "limit": {"type": "integer", "default": 10},
                        "filters": {"type": "object"},
                    },
                    "required": ["query"],
                },
                output_schema={"type": "array", "items": {"type": "object"}},
                requires_approval=False,
            ),
            AgentCapability(
                name="knowledge:add",
                description="Add a document to the knowledge base",
                input_schema={
                    "type": "object",
                    "properties": {
                        "content": {"type": "string"},
                        "metadata": {"type": "object"},
                        "source": {"type": "string"},
                    },
                    "required": ["content"],
                },
                output_schema={"type": "object"},
                requires_approval=False,
            ),
            AgentCapability(
                name="knowledge:update",
                description="Update a document in the knowledge base",
                input_schema={
                    "type": "object",
                    "properties": {
                        "document_id": {"type": "string"},
                        "content": {"type": "string"},
                        "metadata": {"type": "object"},
                    },
                    "required": ["document_id"],
                },
                output_schema={"type": "object"},
                requires_approval=False,
            ),
            AgentCapability(
                name="knowledge:query",
                description="Query knowledge base with RAG context",
                input_schema={
                    "type": "object",
                    "properties": {
                        "question": {"type": "string"},
                        "context_limit": {"type": "integer", "default": 5},
                    },
                    "required": ["question"],
                },
                output_schema={"type": "object"},
                requires_approval=False,
            ),
            AgentCapability(
                name="knowledge:delete",
                description="Delete a document from the knowledge base",
                input_schema={
                    "type": "object",
                    "properties": {"document_id": {"type": "string"}},
                    "required": ["document_id"],
                },
                output_schema={"type": "object"},
                requires_approval=True,
            ),
        )

    async def execute(self, task: AgentTask) -> AgentResult:
        """
        Execute a knowledge base operation.

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
            if task.type == "knowledge:search":
                return await self._search(task)
            elif task.type == "knowledge:add":
                return await self._add_document(task)
            elif task.type == "knowledge:update":
                return await self._update_document(task)
            elif task.type == "knowledge:query":
                return await self._query(task)
            elif task.type == "knowledge:delete":
                return await self._delete_document(task)
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
                url = f"{self.ts_agent_url}/api/agents/knowledge{endpoint}"
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

    async def _search(self, task: AgentTask) -> AgentResult:
        """Search the knowledge base."""
        return await self._make_request("POST", "/search", task, task.payload)

    async def _add_document(self, task: AgentTask) -> AgentResult:
        """Add a document to the knowledge base."""
        return await self._make_request("POST", "/documents", task, task.payload)

    async def _update_document(self, task: AgentTask) -> AgentResult:
        """Update a document in the knowledge base."""
        doc_id = task.payload.get("document_id")
        return await self._make_request("PUT", f"/documents/{doc_id}", task, task.payload)

    async def _query(self, task: AgentTask) -> AgentResult:
        """Query knowledge base with RAG context."""
        return await self._make_request("POST", "/query", task, task.payload)

    async def _delete_document(self, task: AgentTask) -> AgentResult:
        """Delete a document from the knowledge base."""
        doc_id = task.payload.get("document_id")
        return await self._make_request("DELETE", f"/documents/{doc_id}", task)
