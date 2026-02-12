import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../middleware/auth';
import taskService from '../services/taskService';
import taskAgent from '../services/agents/taskAgent';

export class TaskController {
  async createTask(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { title, description, priority, dueDate } = req.body as {
        title: string;
        description?: string;
        priority?: 'low' | 'medium' | 'high' | 'critical';
        dueDate?: string;
      };

      const userId = req.userId;

      if (!title) {
        return res.status(400).send({
          success: false,
          error: { code: 'MISSING_TITLE', message: 'Task title is required' }
        });
      }

      const task = await taskService.createTask(userId, {
        title,
        description,
        priority,
        dueDate: dueDate ? new Date(dueDate) : undefined
      });

      return res.status(201).send({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Error creating task:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create task' }
      });
    }
  }

  async getTasks(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { status, priority, limit } = req.query as {
        status?: string;
        priority?: string;
        limit?: string;
      };

      const userId = req.userId;
      const limitNum = limit ? parseInt(limit) : 50;

      const tasks = await taskService.getTasksByUserId(userId, status, priority, limitNum);

      return res.send({
        success: true,
        data: { tasks }
      });
    } catch (error) {
      console.error('Error getting tasks:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get tasks' }
      });
    }
  }

  async getTask(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const userId = req.userId;

      const task = await taskService.getTaskById(id, userId);

      if (!task) {
        return res.status(404).send({
          success: false,
          error: { code: 'TASK_NOT_FOUND', message: 'Task not found' }
        });
      }

      return res.send({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Error getting task:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get task' }
      });
    }
  }

  async updateTask(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const { title, description, status, priority, dueDate } = req.body as {
        title?: string;
        description?: string;
        status?: 'pending' | 'in-progress' | 'completed' | 'cancelled';
        priority?: 'low' | 'medium' | 'high' | 'critical';
        dueDate?: string;
      };

      const userId = req.userId;

      const updatedTask = await taskService.updateTask(id, userId, {
        title,
        description,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate) : undefined
      });

      return res.send({
        success: true,
        data: updatedTask
      });
    } catch (error) {
      console.error('Error updating task:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update task' }
      });
    }
  }

  async deleteTask(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const userId = req.userId;

      const success = await taskService.deleteTask(id, userId);

      if (!success) {
        return res.status(404).send({
          success: false,
          error: { code: 'TASK_NOT_FOUND', message: 'Task not found' }
        });
      }

      return res.send({
        success: true,
        data: { message: 'Task deleted successfully' }
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete task' }
      });
    }
  }

  async completeTask(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const userId = req.userId;

      const task = await taskService.completeTask(id, userId);

      return res.send({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Error completing task:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to complete task' }
      });
    }
  }

  async processTaskCommand(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { command } = req.body as { command: string };
      const userId = req.userId;

      if (!command) {
        return res.status(400).send({
          success: false,
          error: { code: 'MISSING_COMMAND', message: 'Task command is required' }
        });
      }

      const result = await taskAgent.processTaskCommand(userId, command);

      return res.send({
        success: result.success,
        message: result.message,
        data: result.task || result.tasks
      });
    } catch (error) {
      console.error('Error processing task command:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process task command' }
      });
    }
  }
}

export default new TaskController();