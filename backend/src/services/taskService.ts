import { PrismaClient } from '@prisma/client';
import { Task } from '../../../shared/types/index.ts';
import crypto from 'crypto';

const uuidv4 = (): string => crypto.randomUUID();

const prisma = new PrismaClient();

export class TaskService {
  async createTask(userId: string, taskData: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    dueDate?: Date;
  }): Promise<Task> {
    try {
      const task = await prisma.task.create({
        data: {
          id: uuidv4(),
          userId,
          title: taskData.title,
          description: taskData.description,
          status: 'pending',
          priority: taskData.priority || 'medium',
          dueDate: taskData.dueDate || null
        }
      });

      return this.mapPrismaToTask(task);
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  async getTasksByUserId(userId: string, status?: string, priority?: string, limit: number = 50): Promise<Task[]> {
    try {
      const whereClause: any = { userId };

      if (status) {
        whereClause.status = status;
      }

      if (priority) {
        whereClause.priority = priority;
      }

      const tasks = await prisma.task.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return tasks.map(this.mapPrismaToTask);
    } catch (error) {
      console.error('Error getting tasks:', error);
      throw error;
    }
  }

  async getTaskById(id: string, userId: string): Promise<Task | null> {
    try {
      const task = await prisma.task.findUnique({
        where: { id }
      });

      if (!task || task.userId !== userId) {
        return null;
      }

      return this.mapPrismaToTask(task);
    } catch (error) {
      console.error('Error getting task by id:', error);
      throw error;
    }
  }

  async updateTask(id: string, userId: string, updateData: Partial<Task>): Promise<Task> {
    try {
      const task = await prisma.task.findUnique({
        where: { id }
      });

      if (!task || task.userId !== userId) {
        throw new Error('Task not found or unauthorized');
      }

      const updatedTask = await prisma.task.update({
        where: { id },
        data: {
          title: updateData.title,
          description: updateData.description,
          status: updateData.status,
          priority: updateData.priority,
          dueDate: updateData.dueDate ? new Date(updateData.dueDate) : undefined
        }
      });

      return this.mapPrismaToTask(updatedTask);
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  async deleteTask(id: string, userId: string): Promise<boolean> {
    try {
      const task = await prisma.task.findUnique({
        where: { id }
      });

      if (!task || task.userId !== userId) {
        throw new Error('Task not found or unauthorized');
      }

      await prisma.task.delete({
        where: { id }
      });

      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  async completeTask(id: string, userId: string): Promise<Task> {
    try {
      const task = await prisma.task.findUnique({
        where: { id }
      });

      if (!task || task.userId !== userId) {
        throw new Error('Task not found or unauthorized');
      }

      const completedTask = await prisma.task.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      });

      return this.mapPrismaToTask(completedTask);
    } catch (error) {
      console.error('Error completing task:', error);
      throw error;
    }
  }

  private mapPrismaToTask(prismaTask: any): Task {
    return {
      id: prismaTask.id,
      userId: prismaTask.userId,
      title: prismaTask.title,
      description: prismaTask.description || undefined,
      status: prismaTask.status as 'pending' | 'in-progress' | 'completed' | 'cancelled',
      priority: prismaTask.priority as 'low' | 'medium' | 'high' | 'critical',
      dueDate: prismaTask.dueDate || undefined,
      createdAt: prismaTask.createdAt,
      updatedAt: prismaTask.updatedAt,
      completedAt: prismaTask.completedAt || undefined
    };
  }
}

export default new TaskService();