import { PrismaClient } from '@prisma/client';
import { WebSocketService } from './websocket';

const prisma = new PrismaClient();
const websocketService = WebSocketService.getInstance();

export class NotificationService {
  async sendNotification(userId: string, type: string, message: string, data?: any) {
    try {
      // In a real implementation, you might store notifications in a database
      // For now, we'll just send them via WebSocket

      const notification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        type,
        message,
        data,
        timestamp: new Date()
      };

      // Emit notification to the user via WebSocket
      websocketService.emitToRoom(`user_${userId}`, 'notification', notification);

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  async scheduleReminder(userId: string, taskOrEventId: string, reminderTime: Date, message: string) {
    try {
      // Calculate time until reminder
      const timeUntilReminder = reminderTime.getTime() - Date.now();

      if (timeUntilReminder <= 0) {
        // If reminder time has already passed, send immediately
        await this.sendNotification(userId, 'reminder', message, {
          taskId: taskOrEventId,
          time: reminderTime
        });
        return;
      }

      // Schedule the reminder using setTimeout
      setTimeout(async () => {
        try {
          await this.sendNotification(userId, 'reminder', message, {
            taskId: taskOrEventId,
            time: reminderTime
          });
        } catch (error) {
          console.error('Error sending scheduled reminder:', error);
        }
      }, timeUntilReminder);

      // In a real implementation, you might store this reminder in a database
      // to persist across server restarts
      return {
        success: true,
        reminderId: `reminder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        scheduledTime: reminderTime,
        message
      };
    } catch (error) {
      console.error('Error scheduling reminder:', error);
      throw error;
    }
  }

  async sendDailySummary(userId: string) {
    try {
      // Get user's tasks and events for the day
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      // Get tasks for today
      const tasks = await prisma.task.findMany({
        where: {
          userId,
          OR: [
            { dueDate: { gte: startOfDay, lt: endOfDay } },
            { createdAt: { gte: startOfDay, lt: endOfDay } }
          ]
        }
      });

      // Get calendar events for today
      const events = await prisma.calendarEvent.findMany({
        where: {
          userId,
          startDate: { gte: startOfDay, lt: endOfDay }
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

      const taskCount = tasks.length;
      const eventCount = events.length;
      const emailCount = emails.length;

      let summaryMessage = `Good morning! Here's your daily summary:\n`;
      if (taskCount > 0) {
        summaryMessage += `- ${taskCount} task${taskCount !== 1 ? 's' : ''} for today\n`;
      }
      if (eventCount > 0) {
        summaryMessage += `- ${eventCount} event${eventCount !== 1 ? 's' : ''} scheduled\n`;
      }
      if (emailCount > 0) {
        summaryMessage += `- ${emailCount} important email${emailCount !== 1 ? 's' : ''} need attention\n`;
      }

      if (taskCount === 0 && eventCount === 0 && emailCount === 0) {
        summaryMessage += "You're all caught up! Nothing urgent today.";
      }

      await this.sendNotification(userId, 'daily_summary', summaryMessage, {
        tasks,
        events,
        emails,
        date: now
      });

      return {
        success: true,
        message: summaryMessage,
        summary: {
          tasks: tasks.length,
          events: events.length,
          emails: emails.length
        }
      };
    } catch (error) {
      console.error('Error sending daily summary:', error);
      throw error;
    }
  }

  async sendUpcomingDeadlines(userId: string) {
    try {
      const now = new Date();
      const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

      const tasks = await prisma.task.findMany({
        where: {
          userId,
          dueDate: { gte: now, lte: next24Hours },
          status: { not: 'completed' }
        },
        orderBy: { dueDate: 'asc' }
      });

      if (tasks.length > 0) {
        const taskList = tasks.map(task => `- ${task.title} (${new Date(task.dueDate!).toLocaleString()})`).join('\n');
        const message = `Upcoming deadlines in the next 24 hours:\n${taskList}`;

        await this.sendNotification(userId, 'upcoming_deadlines', message, {
          tasks,
          timeframe: '24_hours'
        });
      }

      return {
        success: true,
        taskCount: tasks.length
      };
    } catch (error) {
      console.error('Error sending upcoming deadlines:', error);
      throw error;
    }
  }
}

export default new NotificationService();