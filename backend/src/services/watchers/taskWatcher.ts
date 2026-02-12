/**
 * Task Watcher - Handles task creation actions
 */

import { Approval } from "../../../../shared/types";
import { BaseWatcher } from "../../core/watchers/BaseWatcher";
import { ExecutionResult, ActionType } from "../../core/actionTypes";
import taskService from "../taskService";

export class TaskWatcher extends BaseWatcher {
  constructor() {
    super("taskWatcher");
  }

  canHandle(approval: Approval): boolean {
    return approval.actionType === ActionType.TASK_CREATE;
  }

  async execute(approval: Approval): Promise<ExecutionResult> {
    try {
      const { entities, rawMessage } = approval.actionData;

      // Extract task details
      const taskData = {
        title: entities?.title || entities?.task || rawMessage,
        description: entities?.description,
        priority: entities?.priority || "medium",
        dueDate: entities?.dueDate || entities?.when,
      };

      this.logger.info("execute:creating_task", {
        approvalId: approval.id,
        data: { title: taskData.title, priority: taskData.priority },
      });

      // Create task
      const task = await taskService.createTask(approval.userId, taskData);

      return {
        success: true,
        data: {
          taskId: task.id,
          title: task.title,
          priority: task.priority,
          status: task.status,
          createdAt: task.createdAt,
          dueDate: task.dueDate,
          verification: "Task persisted and queryable in database",
        },
        executedAt: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error("execute:failed", error as Error, {
        approvalId: approval.id,
      });

      return {
        success: false,
        error: errorMessage,
        executedAt: new Date(),
      };
    }
  }
}

export default new TaskWatcher();
