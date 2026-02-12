"""
Dashboard state and Dashboard.md generator.

Auto-updates Dashboard.md with current system state including
agent health, pending approvals, task queue, and recent activity.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any
from jinja2 import Template

from ..logging.structured import StructuredLogger


class LoopStatus(str, Enum):
    """Ralph Wiggum loop status."""
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"


@dataclass
class TaskStats:
    """Task queue statistics."""
    pending: int = 0
    in_progress: int = 0
    completed_today: int = 0
    failed_today: int = 0


@dataclass
class AgentHealthEntry:
    """Agent health status for dashboard."""
    name: str
    status: str  # healthy, unhealthy, unknown
    last_activity: str  # Relative time (e.g., "2m ago")
    tasks_completed: int = 0


@dataclass
class ActivityEntry:
    """Recent activity entry."""
    timestamp: str
    source: str
    action: str
    result: str  # success, failure, pending
    details: str | None = None


@dataclass
class ApprovalSummary:
    """Approval summary for dashboard."""
    id: str
    action_type: str
    requested_at: str
    user_id: str
    summary: str


@dataclass
class DashboardState:
    """
    Current system state for Dashboard.md generation.

    Attributes:
        loop_status: Ralph Wiggum loop status
        active_agents: Number of healthy agents
        total_agents: Total registered agents
        cycle_number: Current loop cycle
        pending_approvals: List of pending approvals
        recent_activity: Recent activity entries
        task_stats: Task queue statistics
        agent_health: Per-agent health status
        last_updated: Dashboard generation time
    """
    loop_status: LoopStatus = LoopStatus.STOPPED
    active_agents: int = 0
    total_agents: int = 0
    cycle_number: int = 0
    pending_approvals: list[ApprovalSummary] = field(default_factory=list)
    recent_activity: list[ActivityEntry] = field(default_factory=list)
    task_stats: TaskStats = field(default_factory=TaskStats)
    agent_health: list[AgentHealthEntry] = field(default_factory=list)
    last_updated: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "loopStatus": self.loop_status.value,
            "activeAgents": self.active_agents,
            "totalAgents": self.total_agents,
            "cycleNumber": self.cycle_number,
            "pendingApprovals": [
                {
                    "id": a.id,
                    "actionType": a.action_type,
                    "requestedAt": a.requested_at,
                    "userId": a.user_id,
                    "summary": a.summary,
                }
                for a in self.pending_approvals
            ],
            "recentActivity": [
                {
                    "timestamp": a.timestamp,
                    "source": a.source,
                    "action": a.action,
                    "result": a.result,
                    "details": a.details,
                }
                for a in self.recent_activity
            ],
            "taskStats": {
                "pending": self.task_stats.pending,
                "inProgress": self.task_stats.in_progress,
                "completedToday": self.task_stats.completed_today,
                "failedToday": self.task_stats.failed_today,
            },
            "agentHealth": [
                {
                    "name": a.name,
                    "status": a.status,
                    "lastActivity": a.last_activity,
                    "tasksCompleted": a.tasks_completed,
                }
                for a in self.agent_health
            ],
            "lastUpdated": self.last_updated.isoformat(),
        }


# Dashboard.md template using Jinja2
DASHBOARD_TEMPLATE = """# Mini Hafsa Dashboard
> Auto-generated at {{ timestamp }}

## System Status
- **Ralph Wiggum Loop**: {{ loop_status }}
- **Active Agents**: {{ active_agents }}/{{ total_agents }}
- **Current Cycle**: #{{ cycle_number }}

## Agent Health
| Agent | Status | Last Activity | Tasks Completed |
|-------|--------|---------------|-----------------|
{% for agent in agent_health -%}
| {{ agent.name }} | {{ agent.status }} | {{ agent.last_activity }} | {{ agent.tasks_completed }} |
{% endfor %}

## Pending Approvals ({{ pending_count }})
{% if pending_approvals %}
{% for approval in pending_approvals %}
### {{ approval.action_type }}
- **ID**: `{{ approval.id }}`
- **Requested**: {{ approval.requested_at }}
- **User**: {{ approval.user_id }}
- **Details**: {{ approval.summary }}

{% endfor %}
{% else %}
*No pending approvals*
{% endif %}

## Recent Activity
{% if recent_activity %}
{% for activity in recent_activity -%}
- [{{ activity.timestamp }}] **{{ activity.source }}**: {{ activity.action }} - {{ activity.result }}{% if activity.details %} ({{ activity.details }}){% endif %}

{% endfor %}
{% else %}
*No recent activity*
{% endif %}

## Task Queue
- **Pending**: {{ task_stats.pending }}
- **In Progress**: {{ task_stats.in_progress }}
- **Completed Today**: {{ task_stats.completed_today }}
- **Failed Today**: {{ task_stats.failed_today }}

---
*Last updated: {{ timestamp }}*
"""


class DashboardUpdater:
    """
    Generates and updates Dashboard.md file.

    Uses Jinja2 templating for markdown generation.
    """

    def __init__(self, dashboard_path: str | Path, log_path: str | None = None):
        """
        Initialize dashboard updater.

        Args:
            dashboard_path: Path to Dashboard.md file
            log_path: Path for structured logs (optional)
        """
        self.dashboard_path = Path(dashboard_path)
        self.logger = StructuredLogger("dashboard:updater", log_path)
        self.template = Template(DASHBOARD_TEMPLATE)

    def generate_dashboard(self, state: DashboardState) -> str:
        """
        Generate Dashboard.md content from state.

        Args:
            state: Current dashboard state

        Returns:
            Markdown content string
        """
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        content = self.template.render(
            timestamp=timestamp,
            loop_status=state.loop_status.value.upper(),
            active_agents=state.active_agents,
            total_agents=state.total_agents,
            cycle_number=state.cycle_number,
            agent_health=state.agent_health,
            pending_count=len(state.pending_approvals),
            pending_approvals=state.pending_approvals,
            recent_activity=state.recent_activity,
            task_stats=state.task_stats,
        )

        return content

    def write_dashboard(self, state: DashboardState) -> None:
        """
        Generate and write Dashboard.md file.

        Args:
            state: Current dashboard state
        """
        content = self.generate_dashboard(state)

        # Ensure parent directory exists
        self.dashboard_path.parent.mkdir(parents=True, exist_ok=True)

        # Write atomically
        temp_path = self.dashboard_path.with_suffix(".tmp")
        try:
            with open(temp_path, "w", encoding="utf-8") as f:
                f.write(content)
            # Atomic rename
            import os
            os.replace(temp_path, self.dashboard_path)

            self.logger.info(
                "write_dashboard",
                output_data={
                    "path": str(self.dashboard_path),
                    "size": len(content),
                },
            )
        except Exception as e:
            if temp_path.exists():
                temp_path.unlink()
            self.logger.error("write_dashboard", e)
            raise

    async def write_dashboard_async(self, state: DashboardState) -> None:
        """
        Async version of write_dashboard.

        Args:
            state: Current dashboard state
        """
        import aiofiles

        content = self.generate_dashboard(state)

        # Ensure parent directory exists
        self.dashboard_path.parent.mkdir(parents=True, exist_ok=True)

        temp_path = self.dashboard_path.with_suffix(".tmp")
        try:
            async with aiofiles.open(temp_path, "w", encoding="utf-8") as f:
                await f.write(content)
            import os
            os.replace(temp_path, self.dashboard_path)

            self.logger.info(
                "write_dashboard_async",
                output_data={
                    "path": str(self.dashboard_path),
                    "size": len(content),
                },
            )
        except Exception as e:
            if temp_path.exists():
                temp_path.unlink()
            self.logger.error("write_dashboard_async", e)
            raise
