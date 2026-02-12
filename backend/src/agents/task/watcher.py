"""
Task Watcher - handles to-do and task management.

Capabilities:
- Create tasks
- Update task status
- List tasks
- Delete tasks
- Prioritize tasks
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


class TaskWatcher(BaseWatcher):
    """
    Watcher for task/to-do management.

    Delegates to existing TypeScript task agent via HTTP.
    """

    _name = "TaskWatcher"
    _version = "1.0.0"
    _description = "Manages to-do items and task lists"
    _author = "Mini Hafsa Team"

    def __init__(self, ts_agent_url: str = "http://localhost:3001", log_path: str | None = None):
        """
        Initialize Task Watcher.

        Args:
            ts_agent_url: URL of TypeScript agent API
            log_path: Path for structured logs
        """
        super().__init__(log_path)
        self.ts_agent_url = ts_agent_url

    def _get_capabilities(self) -> tuple[AgentCapability, ...]:
        """Return task management capabilities."""
        return (
            AgentCapability(
                name="task:create",
                description="Create a new task",
                input_schema={
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "priority": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
                        "due_date": {"type": "string", "format": "date-time"},
                    },
                    "required": ["title"],
                },
                output_schema={"type": "object"},
                requires_approval=False,
            ),
            AgentCapability(
                name="task:update",
                description="Update an existing task",
                input_schema={
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "string"},
                        "status": {"type": "string"},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                    },
                    "required": ["task_id"],
                },
                output_schema={"type": "object"},
                requires_approval=False,
            ),
            AgentCapability(
                name="task:list",
                description="List tasks with optional filters",
                input_schema={
                    "type": "object",
                    "properties": {
                        "status": {"type": "string"},
                        "priority": {"type": "string"},
                        "limit": {"type": "integer"},
                    },
                },
                output_schema={"type": "array", "items": {"type": "object"}},
                requires_approval=False,
            ),
            AgentCapability(
                name="task:delete",
                description="Delete a task",
                input_schema={
                    "type": "object",
                    "properties": {"task_id": {"type": "string"}},
                    "required": ["task_id"],
                },
                output_schema={"type": "object"},
                requires_approval=True,
            ),
            AgentCapability(
                name="task:complete",
                description="Mark a task as complete",
                input_schema={
                    "type": "object",
                    "properties": {"task_id": {"type": "string"}},
                    "required": ["task_id"],
                },
                output_schema={"type": "object"},
                requires_approval=False,
            ),
        )

    async def execute(self, task: AgentTask) -> AgentResult:
        """
        Execute a task management operation.

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
            if task.type == "task:create":
                return await self._create_task(task)
            elif task.type == "task:update":
                return await self._update_task(task)
            elif task.type == "task:list":
                return await self._list_tasks(task)
            elif task.type == "task:delete":
                return await self._delete_task(task)
            elif task.type == "task:complete":
                return await self._complete_task(task)
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
                url = f"{self.ts_agent_url}/api/agents/tasks{endpoint}"
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

    async def _create_task(self, task: AgentTask) -> AgentResult:
        """Create a new task."""
        return await self._make_request("POST", "", task, task.payload)

    async def _update_task(self, task: AgentTask) -> AgentResult:
        """Update an existing task."""
        task_id = task.payload.get("task_id")
        return await self._make_request("PUT", f"/{task_id}", task, task.payload)

    async def _list_tasks(self, task: AgentTask) -> AgentResult:
        """List tasks with filters."""
        return await self._make_request("GET", "", task, task.payload)

    async def _delete_task(self, task: AgentTask) -> AgentResult:
        """Delete a task."""
        task_id = task.payload.get("task_id")
        return await self._make_request("DELETE", f"/{task_id}", task)

    async def _complete_task(self, task: AgentTask) -> AgentResult:
        """Mark a task as complete."""
        task_id = task.payload.get("task_id")
        return await self._make_request("PUT", f"/{task_id}/complete", task, {})
