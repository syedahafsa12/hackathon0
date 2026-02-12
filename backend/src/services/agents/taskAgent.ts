import { PrismaClient } from '@prisma/client';
import taskService from '../taskService';
import taskParser from '../../utils/taskParser';
import approvalAgent from './approvalAgent';

const prisma = new PrismaClient();

export class TaskAgent {
  async processTaskCommand(userId: string, command: string) {
    try {
      // Parse the command to determine intent
      const intent = this.identifyIntent(command);

      switch (intent) {
        case 'create_task':
          return await this.handleCreateTask(userId, command);
        case 'list_tasks':
          return await this.handleListTasks(userId);
        case 'complete_task':
          return await this.handleCompleteTask(userId, command);
        case 'update_task':
          return await this.handleUpdateTask(userId, command);
        default:
          return {
            success: false,
            message: 'Unable to understand the task command. Try phrases like "create a task to buy groceries" or "show me my tasks"'
          };
      }
    } catch (error) {
      console.error('Error processing task command:', error);
      throw error;
    }
  }

  private identifyIntent(command: string): string {
    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes('create') || lowerCommand.includes('add') || lowerCommand.includes('new task') ||
        lowerCommand.includes('remind me') || lowerCommand.includes('todo') || lowerCommand.includes('to do')) {
      return 'create_task';
    } else if (lowerCommand.includes('show') || lowerCommand.includes('list') || lowerCommand.includes('my tasks') ||
               lowerCommand.includes('what') && lowerCommand.includes('tasks')) {
      return 'list_tasks';
    } else if (lowerCommand.includes('complete') || lowerCommand.includes('done') || lowerCommand.includes('finish') ||
               lowerCommand.includes('mark as')) {
      return 'complete_task';
    } else if (lowerCommand.includes('update') || lowerCommand.includes('change') || lowerCommand.includes('modify')) {
      return 'update_task';
    } else {
      // Default to create task for commands that might be natural language
      return 'create_task';
    }
  }

  private async handleCreateTask(userId: string, command: string) {
    // Parse the natural language command to extract task details
    const taskDetails = await taskParser.parseNaturalLanguageTask(command);

    // For high priority tasks, create an approval request
    if (taskDetails.priority === 'critical' || taskDetails.priority === 'high') {
      const approval = await approvalAgent.processApprovalRequest(userId, 'task_create', {
        title: taskDetails.title,
        description: taskDetails.description,
        priority: taskDetails.priority,
        dueDate: taskDetails.dueDate
      });

      return {
        success: true,
        message: `High priority task "${taskDetails.title}" requires your approval before creation.`,
        requiresApproval: true,
        approval: approval.approval
      };
    } else {
      // Create the task directly for medium/low priority tasks
      const task = await taskService.createTask(userId, {
        title: taskDetails.title,
        description: taskDetails.description,
        priority: taskDetails.priority,
        dueDate: taskDetails.dueDate
      });

      return {
        success: true,
        message: `Task "${task.title}" has been created successfully!`,
        task: task
      };
    }
  }

  private async handleListTasks(userId: string) {
    // Get all tasks for the user
    const tasks = await taskService.getTasksByUserId(userId);

    if (tasks.length === 0) {
      return {
        success: true,
        message: 'You have no tasks at the moment. You can create one by saying something like "create a task to buy groceries"',
        tasks: []
      };
    }

    return {
      success: true,
      message: `You have ${tasks.length} tasks.`,
      tasks: tasks
    };
  }

  private async handleCompleteTask(userId: string, command: string) {
    // Extract task ID or title from command
    // This is a simplified implementation - in reality, you'd need more sophisticated NLP
    const tasks = await taskService.getTasksByUserId(userId);

    // Try to find a task that matches words in the command
    const lowerCommand = command.toLowerCase();
    let taskToComplete = null;

    for (const task of tasks) {
      if (lowerCommand.includes(task.title.toLowerCase()) ||
          (task.description && lowerCommand.includes(task.description.toLowerCase()))) {
        if (task.status !== 'completed') {
          taskToComplete = task;
          break;
        }
      }
    }

    // If no specific task found, try to complete the most recent pending task
    if (!taskToComplete) {
      taskToComplete = tasks.find(task => task.status !== 'completed');
    }

    if (taskToComplete) {
      const completedTask = await taskService.completeTask(taskToComplete.id, userId);
      return {
        success: true,
        message: `Task "${completedTask.title}" has been marked as completed!`,
        task: completedTask
      };
    } else {
      return {
        success: false,
        message: 'No task found to complete. Please specify which task you want to complete.'
      };
    }
  }

  private async handleUpdateTask(userId: string, command: string) {
    // This is a simplified implementation
    // In reality, you'd need more sophisticated NLP to understand what needs to be updated

    // For now, we'll just parse the command to extract potential updates
    const taskDetails = await taskParser.parseNaturalLanguageTask(command);

    // Since we don't know which specific task to update from the command alone,
    // we'll need to ask for more information in a real implementation
    // This is a simplified approach
    const tasks = await taskService.getTasksByUserId(userId);

    if (tasks.length === 0) {
      return {
        success: false,
        message: 'You have no tasks to update. Please create a task first.'
      };
    }

    // Update the most recent task with the parsed details (in a real app, you'd be more specific)
    const mostRecentTask = tasks[0]; // Most recent based on our query ordering

    const updatedTask = await taskService.updateTask(mostRecentTask.id, userId, {
      title: taskDetails.title || mostRecentTask.title,
      description: taskDetails.description,
      priority: taskDetails.priority,
      dueDate: taskDetails.dueDate
    });

    return {
      success: true,
      message: `Task "${updatedTask.title}" has been updated!`,
      task: updatedTask
    };
  }

  async createTaskFromText(userId: string, text: string) {
    const taskDetails = await taskParser.parseNaturalLanguageTask(text);

    // For high priority tasks, create an approval request
    if (taskDetails.priority === 'critical' || taskDetails.priority === 'high') {
      const approval = await approvalAgent.processApprovalRequest(userId, 'task_create', {
        title: taskDetails.title,
        description: taskDetails.description,
        priority: taskDetails.priority,
        dueDate: taskDetails.dueDate
      });

      return {
        success: true,
        message: `High priority task "${taskDetails.title}" requires your approval before creation.`,
        requiresApproval: true,
        approval: approval.approval
      };
    } else {
      // Create the task directly for medium/low priority tasks
      const task = await taskService.createTask(userId, {
        title: taskDetails.title,
        description: taskDetails.description,
        priority: taskDetails.priority,
        dueDate: taskDetails.dueDate
      });

      return {
        success: true,
        message: `Task "${task.title}" has been created!`,
        task: task
      };
    }
  }
}

export default new TaskAgent();