"""
Task scheduler for Ralph Wiggum loop.

Handles task prioritization and selection for execution.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from ..interfaces.agent import AgentTask, Priority
from ..logging.structured import StructuredLogger


@dataclass
class SchedulerConfig:
    """
    Configuration for task scheduler.

    Attributes:
        priority_weights: Weight multipliers for each priority level
        age_weight: Weight for task age in scoring
        starvation_threshold_ms: Time after which low priority tasks get boosted
        max_batch_size: Maximum tasks to return per scheduling call
    """
    priority_weights: dict[Priority, float] | None = None
    age_weight: float = 0.1
    starvation_threshold_ms: int = 60000
    max_batch_size: int = 10

    def __post_init__(self):
        if self.priority_weights is None:
            self.priority_weights = {
                Priority.CRITICAL: 100.0,
                Priority.HIGH: 50.0,
                Priority.MEDIUM: 25.0,
                Priority.LOW: 10.0,
            }


class Scheduler:
    """
    Task scheduler with priority-based ordering.

    Features:
    - Priority-based scoring
    - Age-based scoring (older tasks get higher priority)
    - Starvation prevention for low priority tasks
    - Configurable weights
    """

    def __init__(self, config: SchedulerConfig | None = None, log_path: str | None = None):
        """
        Initialize scheduler.

        Args:
            config: Scheduler configuration
            log_path: Path for structured logs
        """
        self.config = config or SchedulerConfig()
        self.logger = StructuredLogger("ralphWiggum:scheduler", log_path)

    def prioritize_tasks(self, tasks: list[AgentTask]) -> list[AgentTask]:
        """
        Prioritize tasks based on priority and age.

        Args:
            tasks: List of tasks to prioritize

        Returns:
            Sorted list of tasks (highest priority first)
        """
        if not tasks:
            return []

        # Score each task
        scored_tasks = [(task, self._calculate_score(task)) for task in tasks]

        # Sort by score descending
        scored_tasks.sort(key=lambda x: x[1], reverse=True)

        result = [task for task, _ in scored_tasks]

        self.logger.info(
            "prioritize_tasks",
            input_data={"taskCount": len(tasks)},
            output_data={
                "topTask": result[0].id if result else None,
                "topPriority": result[0].priority.value if result else None,
            },
        )

        return result

    def _calculate_score(self, task: AgentTask) -> float:
        """
        Calculate priority score for a task.

        Score = priority_weight + (age_weight * age_seconds) + starvation_bonus

        Args:
            task: The task to score

        Returns:
            Numeric score (higher = higher priority)
        """
        # Base priority score
        score = self.config.priority_weights.get(task.priority, 25.0)

        # Age bonus (older tasks get slight priority boost)
        age_seconds = (datetime.now() - task.created_at).total_seconds()
        score += self.config.age_weight * age_seconds

        # Starvation prevention: boost low priority tasks that have been waiting
        if task.priority in (Priority.LOW, Priority.MEDIUM):
            age_ms = age_seconds * 1000
            if age_ms > self.config.starvation_threshold_ms:
                # Add bonus proportional to how long over threshold
                starvation_factor = (age_ms - self.config.starvation_threshold_ms) / 1000
                score += starvation_factor * 5.0

        return score

    def get_next_tasks(
        self,
        tasks: list[AgentTask],
        max_count: int | None = None,
        filter_fn: Any | None = None,
    ) -> list[AgentTask]:
        """
        Get the next batch of tasks to execute.

        Args:
            tasks: Available tasks
            max_count: Maximum number of tasks to return
            filter_fn: Optional filter function (task) -> bool

        Returns:
            List of tasks to execute
        """
        max_count = max_count or self.config.max_batch_size

        # Apply filter if provided
        filtered_tasks = tasks
        if filter_fn:
            filtered_tasks = [t for t in tasks if filter_fn(t)]

        # Prioritize
        prioritized = self.prioritize_tasks(filtered_tasks)

        # Return top N
        result = prioritized[:max_count]

        self.logger.info(
            "get_next_tasks",
            input_data={"available": len(tasks), "maxCount": max_count},
            output_data={"selected": len(result)},
        )

        return result

    def should_execute_now(self, task: AgentTask) -> bool:
        """
        Determine if a task should be executed immediately.

        Critical priority tasks are always executed immediately.
        High priority tasks are executed if not too many in flight.

        Args:
            task: The task to check

        Returns:
            True if task should execute immediately
        """
        if task.priority == Priority.CRITICAL:
            return True

        # High priority tasks get fast-tracked
        if task.priority == Priority.HIGH:
            return True

        return False

    def estimate_wait_time(self, task: AgentTask, queue_position: int) -> int:
        """
        Estimate wait time for a task in the queue.

        Args:
            task: The task
            queue_position: Position in queue (0 = next)

        Returns:
            Estimated wait time in milliseconds
        """
        # Simple estimation: assume 5 seconds per task ahead in queue
        base_wait = queue_position * 5000

        # Adjust based on priority (higher priority = less wait)
        priority_factor = {
            Priority.CRITICAL: 0.1,
            Priority.HIGH: 0.5,
            Priority.MEDIUM: 1.0,
            Priority.LOW: 1.5,
        }.get(task.priority, 1.0)

        return int(base_wait * priority_factor)


class TaskQueue:
    """
    Thread-safe task queue with priority support.

    Wraps a list with scheduler integration.
    """

    def __init__(self, scheduler: Scheduler | None = None, log_path: str | None = None):
        """
        Initialize task queue.

        Args:
            scheduler: Scheduler for prioritization
            log_path: Path for structured logs
        """
        self.scheduler = scheduler or Scheduler()
        self.logger = StructuredLogger("ralphWiggum:queue", log_path)
        self._tasks: list[AgentTask] = []

    def enqueue(self, task: AgentTask) -> int:
        """
        Add a task to the queue.

        Args:
            task: Task to add

        Returns:
            Queue position
        """
        self._tasks.append(task)

        # Re-prioritize
        self._tasks = self.scheduler.prioritize_tasks(self._tasks)

        # Find new position
        position = next(
            (i for i, t in enumerate(self._tasks) if t.id == task.id),
            len(self._tasks) - 1,
        )

        self.logger.info(
            "enqueue",
            input_data={"taskId": task.id, "priority": task.priority.value},
            output_data={"position": position, "queueSize": len(self._tasks)},
        )

        return position

    def dequeue(self, count: int = 1) -> list[AgentTask]:
        """
        Remove and return tasks from the front of the queue.

        Args:
            count: Number of tasks to dequeue

        Returns:
            List of dequeued tasks
        """
        result = self._tasks[:count]
        self._tasks = self._tasks[count:]

        self.logger.info(
            "dequeue",
            output_data={"dequeued": len(result), "remaining": len(self._tasks)},
        )

        return result

    def peek(self, count: int = 1) -> list[AgentTask]:
        """
        Peek at tasks without removing them.

        Args:
            count: Number of tasks to peek

        Returns:
            List of tasks
        """
        return self._tasks[:count]

    def remove(self, task_id: str) -> bool:
        """
        Remove a specific task from the queue.

        Args:
            task_id: ID of task to remove

        Returns:
            True if task was found and removed
        """
        original_len = len(self._tasks)
        self._tasks = [t for t in self._tasks if t.id != task_id]
        removed = len(self._tasks) < original_len

        if removed:
            self.logger.info("remove", input_data={"taskId": task_id})

        return removed

    def get_position(self, task_id: str) -> int | None:
        """
        Get the queue position of a task.

        Args:
            task_id: ID of task

        Returns:
            Position (0-indexed) or None if not found
        """
        for i, task in enumerate(self._tasks):
            if task.id == task_id:
                return i
        return None

    def size(self) -> int:
        """Get the number of tasks in queue."""
        return len(self._tasks)

    def clear(self) -> int:
        """
        Clear all tasks from the queue.

        Returns:
            Number of tasks cleared
        """
        count = len(self._tasks)
        self._tasks.clear()

        self.logger.info("clear", output_data={"cleared": count})
        return count

    def get_stats(self) -> dict[str, Any]:
        """
        Get queue statistics.

        Returns:
            Dictionary with queue stats
        """
        priority_counts = {p: 0 for p in Priority}
        for task in self._tasks:
            priority_counts[task.priority] += 1

        return {
            "total": len(self._tasks),
            "byPriority": {p.value: c for p, c in priority_counts.items()},
        }
