import { PrismaClient } from '@prisma/client';
import { Task, CalendarEvent, EmailMessage } from '../../../shared/types';

const prisma = new PrismaClient();

export class PriorityService {
  async getDailyPriorities(userId: string) {
    try {
      // Get today's date range
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // Get tasks for today that are not completed
      const tasks = await prisma.task.findMany({
        where: {
          userId,
          status: { not: 'completed' },
          OR: [
            { dueDate: { gte: startOfDay, lte: endOfDay } },
            { createdAt: { gte: startOfDay, lte: endOfDay } },
            { status: 'in-progress' } // In-progress tasks take priority
          ]
        }
      });

      // Get calendar events for today
      const events = await prisma.calendarEvent.findMany({
        where: {
          userId,
          startDate: { gte: startOfDay, lte: endOfDay }
        }
      });

      // Get important emails requiring action
      const emails = await prisma.emailMessage.findMany({
        where: {
          userId,
          importance: { in: ['critical', 'high'] },
          status: 'action-required'
        }
      });

      // Combine and sort by priority
      const prioritizedItems = [
        // Critical tasks
        ...tasks
          .filter(task => task.priority === 'critical')
          .map(task => ({
            id: task.id,
            type: 'task',
            priority: 1,
            title: task.title,
            description: task.description || '',
            dueDate: task.dueDate,
            item: task
          })),

        // High priority tasks
        ...tasks
          .filter(task => task.priority === 'high')
          .map(task => ({
            id: task.id,
            type: 'task',
            priority: 2,
            title: task.title,
            description: task.description || '',
            dueDate: task.dueDate,
            item: task
          })),

        // Critical emails
        ...emails
          .filter(email => email.importance === 'critical')
          .map(email => ({
            id: email.id,
            type: 'email',
            priority: 3,
            title: email.subject,
            description: `From: ${email.sender}`,
            dueDate: null,
            item: email
          })),

        // High priority emails
        ...emails
          .filter(email => email.importance === 'high')
          .map(email => ({
            id: email.id,
            type: 'email',
            priority: 4,
            title: email.subject,
            description: `From: ${email.sender}`,
            dueDate: null,
            item: email
          })),

        // Events happening soon (within 2 hours)
        ...events
          .filter(event => {
            const timeToEvent = event.startDate.getTime() - new Date().getTime();
            return timeToEvent <= 2 * 60 * 60 * 1000 && timeToEvent > 0;
          })
          .map(event => ({
            id: event.id,
            type: 'event',
            priority: 5,
            title: event.title,
            description: `At: ${event.startDate.toLocaleTimeString()}`,
            dueDate: event.startDate,
            item: event
          })),

        // Regular tasks
        ...tasks
          .filter(task => task.priority === 'medium')
          .map(task => ({
            id: task.id,
            type: 'task',
            priority: 6,
            title: task.title,
            description: task.description || '',
            dueDate: task.dueDate,
            item: task
          })),

        // Low priority tasks
        ...tasks
          .filter(task => task.priority === 'low')
          .map(task => ({
            id: task.id,
            type: 'task',
            priority: 7,
            title: task.title,
            description: task.description || '',
            dueDate: task.dueDate,
            item: task
          }))
      ].sort((a, b) => a.priority - b.priority);

      return {
        date: new Date(),
        items: prioritizedItems,
        summary: {
          totalItems: prioritizedItems.length,
          tasks: tasks.length,
          events: events.length,
          emails: emails.length
        }
      };
    } catch (error) {
      console.error('Error getting daily priorities:', error);
      throw error;
    }
  }

  async getPrioritizedTasks(userId: string, limit: number = 20) {
    try {
      const tasks = await prisma.task.findMany({
        where: {
          userId,
          status: { not: 'completed' }
        },
        orderBy: [
          {
            priority: 'desc' // critical, high, medium, low
          },
          {
            dueDate: 'asc' // Sooner due dates first
          }
        ],
        take: limit
      });

      // Assign numeric priority values for sorting
      const prioritizedTasks = tasks.map(task => {
        let priorityValue = 0;
        switch(task.priority) {
          case 'critical': priorityValue = 4; break;
          case 'high': priorityValue = 3; break;
          case 'medium': priorityValue = 2; break;
          case 'low': priorityValue = 1; break;
        }

        // Boost priority for overdue tasks
        if (task.dueDate && new Date(task.dueDate) < new Date()) {
          priorityValue += 5;
        }

        return {
          ...task,
          priorityValue
        };
      }).sort((a, b) => b.priorityValue - a.priorityValue);

      return prioritizedTasks;
    } catch (error) {
      console.error('Error getting prioritized tasks:', error);
      throw error;
    }
  }

  async getPrioritizedEmails(userId: string, limit: number = 20) {
    try {
      const emails = await prisma.emailMessage.findMany({
        where: {
          userId,
          status: 'action-required'
        },
        orderBy: [
          {
            importance: 'desc' // critical, high, medium, low, spam
          }
        ],
        take: limit
      });

      // Assign numeric priority values for sorting
      const prioritizedEmails = emails.map(email => {
        let priorityValue = 0;
        switch(email.importance) {
          case 'critical': priorityValue = 4; break;
          case 'high': priorityValue = 3; break;
          case 'medium': priorityValue = 2; break;
          case 'low': priorityValue = 1; break;
          case 'spam': priorityValue = 0; break;
        }

        return {
          ...email,
          priorityValue
        };
      }).sort((a, b) => b.priorityValue - a.priorityValue);

      return prioritizedEmails;
    } catch (error) {
      console.error('Error getting prioritized emails:', error);
      throw error;
    }
  }
}

export default new PriorityService();