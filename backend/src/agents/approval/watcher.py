"""
Approval Watcher - handles HITL approval workflow.

Capabilities:
- Create approval requests
- Process approval decisions
- List pending approvals
- Manage approval history
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from ...core.interfaces.agent import (
    AgentCapability,
    AgentError,
    AgentResult,
    AgentTask,
)
from ...core.mcp.vault import VaultFolder, VaultManager
from ...core.mcp.events import EventBus, WebSocketEventType, get_event_bus
from ..base.watcher import BaseWatcher


class ApprovalWatcher(BaseWatcher):
    """
    Watcher for HITL approval workflow.

    Manages approval requests using vault folders:
    - Pending_Approval: New approval requests
    - Approved: Approved requests
    - Rejected: Rejected requests
    """

    _name = "ApprovalWatcher"
    _version = "1.0.0"
    _description = "Manages human-in-the-loop approval workflow"
    _author = "Mini Hafsa Team"

    def __init__(
        self,
        vault_manager: VaultManager,
        event_bus: EventBus | None = None,
        log_path: str | None = None,
    ):
        """
        Initialize Approval Watcher.

        Args:
            vault_manager: Vault manager for file operations
            event_bus: Event bus for notifications
            log_path: Path for structured logs
        """
        super().__init__(log_path)
        self.vault = vault_manager
        self.event_bus = event_bus or get_event_bus()

    def _get_capabilities(self) -> tuple[AgentCapability, ...]:
        """Return approval-specific capabilities."""
        return (
            AgentCapability(
                name="approval:create",
                description="Create an approval request",
                input_schema={
                    "type": "object",
                    "properties": {
                        "action_type": {"type": "string"},
                        "action_data": {"type": "object"},
                        "summary": {"type": "string"},
                        "user_id": {"type": "string"},
                        "agent_name": {"type": "string"},
                        "risk_level": {"type": "string", "enum": ["low", "medium", "high"]},
                    },
                    "required": ["action_type", "action_data", "summary"],
                },
                output_schema={"type": "object"},
                requires_approval=False,
            ),
            AgentCapability(
                name="approval:approve",
                description="Approve a pending request",
                input_schema={
                    "type": "object",
                    "properties": {
                        "approval_id": {"type": "string"},
                        "approver_id": {"type": "string"},
                        "notes": {"type": "string"},
                    },
                    "required": ["approval_id"],
                },
                output_schema={"type": "object"},
                requires_approval=False,
            ),
            AgentCapability(
                name="approval:reject",
                description="Reject a pending request",
                input_schema={
                    "type": "object",
                    "properties": {
                        "approval_id": {"type": "string"},
                        "rejector_id": {"type": "string"},
                        "reason": {"type": "string"},
                    },
                    "required": ["approval_id", "reason"],
                },
                output_schema={"type": "object"},
                requires_approval=False,
            ),
            AgentCapability(
                name="approval:list",
                description="List pending approval requests",
                input_schema={
                    "type": "object",
                    "properties": {
                        "status": {"type": "string", "enum": ["pending", "approved", "rejected"]},
                        "user_id": {"type": "string"},
                        "limit": {"type": "integer", "default": 20},
                    },
                },
                output_schema={"type": "array", "items": {"type": "object"}},
                requires_approval=False,
            ),
            AgentCapability(
                name="approval:get",
                description="Get details of an approval request",
                input_schema={
                    "type": "object",
                    "properties": {"approval_id": {"type": "string"}},
                    "required": ["approval_id"],
                },
                output_schema={"type": "object"},
                requires_approval=False,
            ),
        )

    async def execute(self, task: AgentTask) -> AgentResult:
        """
        Execute an approval operation.

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
            if task.type == "approval:create":
                return await self._create_approval(task)
            elif task.type == "approval:approve":
                return await self._approve(task)
            elif task.type == "approval:reject":
                return await self._reject(task)
            elif task.type == "approval:list":
                return await self._list_approvals(task)
            elif task.type == "approval:get":
                return await self._get_approval(task)
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

    async def _create_approval(self, task: AgentTask) -> AgentResult:
        """Create an approval request in Pending_Approval folder."""
        import uuid

        approval_id = str(uuid.uuid4())
        now = datetime.now()

        approval_data = {
            "id": approval_id,
            "action_type": task.payload.get("action_type"),
            "action_data": task.payload.get("action_data", {}),
            "summary": task.payload.get("summary"),
            "user_id": task.payload.get("user_id", task.user_id),
            "agent_name": task.payload.get("agent_name"),
            "risk_level": task.payload.get("risk_level", "medium"),
            "status": "pending",
            "created_at": now.isoformat(),
            "correlation_id": task.correlation_id,
        }

        vault_file = await self.vault.create_file(
            VaultFolder.PENDING_APPROVAL,
            approval_id,
            approval_data,
        )

        # Emit approval pending event
        self.event_bus.emit(
            WebSocketEventType.APPROVAL_PENDING.value,
            {
                "id": approval_id,
                "actionType": approval_data["action_type"],
                "summary": approval_data["summary"],
                "riskLevel": approval_data["risk_level"],
            },
        )

        self.logger.info(
            "create_approval",
            output_data={"approvalId": approval_id, "actionType": approval_data["action_type"]},
        )

        return AgentResult(
            success=True,
            data={
                "approval_id": approval_id,
                "status": "pending",
                "path": vault_file.path,
            },
        )

    async def _approve(self, task: AgentTask) -> AgentResult:
        """Approve a pending request - move from Pending_Approval to Approved."""
        approval_id = task.payload.get("approval_id")
        now = datetime.now()

        update_content = {
            "status": "approved",
            "approved_at": now.isoformat(),
            "approver_id": task.payload.get("approver_id", task.user_id),
            "approval_notes": task.payload.get("notes"),
        }

        vault_file = await self.vault.move_file(
            approval_id,
            VaultFolder.PENDING_APPROVAL,
            VaultFolder.APPROVED,
            update_content,
        )

        if not vault_file:
            return AgentResult(
                success=False,
                error=AgentError(
                    code="NOT_FOUND",
                    message=f"Approval request not found: {approval_id}",
                    recoverable=False,
                ),
            )

        # Emit approval resolved event
        self.event_bus.emit(
            WebSocketEventType.APPROVAL_RESOLVED.value,
            {
                "id": approval_id,
                "status": "approved",
                "approverId": update_content["approver_id"],
            },
        )

        self.logger.info(
            "approve",
            output_data={"approvalId": approval_id},
        )

        return AgentResult(
            success=True,
            data={
                "approval_id": approval_id,
                "status": "approved",
                "approved_at": update_content["approved_at"],
            },
        )

    async def _reject(self, task: AgentTask) -> AgentResult:
        """Reject a pending request - move from Pending_Approval to Rejected."""
        approval_id = task.payload.get("approval_id")
        now = datetime.now()

        update_content = {
            "status": "rejected",
            "rejected_at": now.isoformat(),
            "rejector_id": task.payload.get("rejector_id", task.user_id),
            "rejection_reason": task.payload.get("reason"),
        }

        vault_file = await self.vault.move_file(
            approval_id,
            VaultFolder.PENDING_APPROVAL,
            VaultFolder.REJECTED,
            update_content,
        )

        if not vault_file:
            return AgentResult(
                success=False,
                error=AgentError(
                    code="NOT_FOUND",
                    message=f"Approval request not found: {approval_id}",
                    recoverable=False,
                ),
            )

        # Emit approval resolved event
        self.event_bus.emit(
            WebSocketEventType.APPROVAL_RESOLVED.value,
            {
                "id": approval_id,
                "status": "rejected",
                "rejectorId": update_content["rejector_id"],
                "reason": update_content["rejection_reason"],
            },
        )

        self.logger.info(
            "reject",
            output_data={"approvalId": approval_id, "reason": update_content["rejection_reason"]},
        )

        return AgentResult(
            success=True,
            data={
                "approval_id": approval_id,
                "status": "rejected",
                "rejected_at": update_content["rejected_at"],
                "reason": update_content["rejection_reason"],
            },
        )

    async def _list_approvals(self, task: AgentTask) -> AgentResult:
        """List approval requests from vault folders."""
        status = task.payload.get("status", "pending")
        limit = task.payload.get("limit", 20)
        user_id = task.payload.get("user_id")

        # Map status to folder
        folder_map = {
            "pending": VaultFolder.PENDING_APPROVAL,
            "approved": VaultFolder.APPROVED,
            "rejected": VaultFolder.REJECTED,
        }

        folder = folder_map.get(status, VaultFolder.PENDING_APPROVAL)
        files = await self.vault.list_folder(folder)

        approvals = []
        for filename in files[:limit]:
            vault_file = await self.vault.read_file(folder, filename)
            if vault_file:
                content = vault_file.content
                # Filter by user_id if provided
                if user_id and content.get("user_id") != user_id:
                    continue
                approvals.append(content)

        return AgentResult(
            success=True,
            data={"approvals": approvals, "count": len(approvals)},
        )

    async def _get_approval(self, task: AgentTask) -> AgentResult:
        """Get details of an approval request."""
        approval_id = task.payload.get("approval_id")

        # Check all folders
        for folder in [VaultFolder.PENDING_APPROVAL, VaultFolder.APPROVED, VaultFolder.REJECTED]:
            vault_file = await self.vault.read_file(folder, approval_id)
            if vault_file:
                return AgentResult(
                    success=True,
                    data=vault_file.content,
                )

        return AgentResult(
            success=False,
            error=AgentError(
                code="NOT_FOUND",
                message=f"Approval request not found: {approval_id}",
                recoverable=False,
            ),
        )
