import { PrismaClient } from '@prisma/client';
import priorityService from '../priorityService';
import { NotificationService } from '../notificationService';

const prisma = new PrismaClient();
const notificationService = new NotificationService();

export class DailySummaryAgent {
  async generateDailySummary(userId: string) {
    try {
      // Get prioritized items for the day
      const dailyPriorities = await priorityService.getDailyPriorities(userId);

      // Generate a summary message
      const summaryMessage = this.formatDailySummary(dailyPriorities);

      // Send notification to the user
      await notificationService.sendNotification(
        userId,
        'daily_summary',
        summaryMessage,
        { dailyPriorities }
      );

      return {
        success: true,
        message: summaryMessage,
        dailyPriorities
      };
    } catch (error) {
      console.error('Error generating daily summary:', error);
      throw error;
    }
  }

  async generatePriorityRecommendations(userId: string) {
    try {
      // Get prioritized tasks and emails
      const prioritizedTasks = await priorityService.getPrioritizedTasks(userId, 10);
      const prioritizedEmails = await priorityService.getPrioritizedEmails(userId, 5);

      // Generate recommendations
      const recommendations = [];

      // Recommend focusing on critical tasks first
      const criticalTasks = prioritizedTasks.filter(task => task.priorityValue >= 9); // Overdue critical tasks
      if (criticalTasks.length > 0) {
        recommendations.push({
          type: 'focus',
          priority: 'high',
          message: `Focus on ${criticalTasks.length} critical task(s) that are overdue or due soon.`
        });
      }

      // Recommend handling important emails
      const importantEmails = prioritizedEmails.filter(email =>
        email.importance === 'critical' || email.importance === 'high'
      );
      if (importantEmails.length > 0) {
        recommendations.push({
          type: 'action',
          priority: 'medium',
          message: `Address ${importantEmails.length} important email(s) requiring your attention.`
        });
      }

      // Recommend scheduling time for medium-priority tasks
      const mediumTasks = prioritizedTasks.filter(task =>
        task.priorityValue >= 2 && task.priorityValue < 5 && task.priority === 'medium'
      );
      if (mediumTasks.length > 0) {
        recommendations.push({
          type: 'plan',
          priority: 'low',
          message: `Consider scheduling time for ${mediumTasks.length} medium-priority task(s).`
        });
      }

      return {
        success: true,
        recommendations,
        summary: {
          criticalItemCount: criticalTasks.length + importantEmails.length,
          mediumItemCount: mediumTasks.length
        }
      };
    } catch (error) {
      console.error('Error generating priority recommendations:', error);
      throw error;
    }
  }

  private formatDailySummary(dailyPriorities: any): string {
    const { items, summary } = dailyPriorities;

    let summaryText = `📅 Good morning! Here's your prioritized daily summary:\n\n`;

    if (summary.totalItems === 0) {
      summaryText += "🎉 You're all caught up! No urgent items on your plate today.\n";
      return summaryText;
    }

    // Group items by priority level
    const criticalItems = items.filter((item: any) => item.priority <= 3);
    const highPriorityItems = items.filter((item: any) => item.priority > 3 && item.priority <= 5);
    const regularItems = items.filter((item: any) => item.priority > 5);

    if (criticalItems.length > 0) {
      summaryText += `🚨 CRITICAL: ${criticalItems.length} urgent item(s)\n`;
      criticalItems.slice(0, 3).forEach((item: any) => {
        summaryText += `  • ${item.title}\n`;
      });
      if (criticalItems.length > 3) {
        summaryText += `  • ... and ${criticalItems.length - 3} more\n`;
      }
      summaryText += `\n`;
    }

    if (highPriorityItems.length > 0) {
      summaryText += `🔥 HIGH PRIORITY: ${highPriorityItems.length} important item(s)\n`;
      highPriorityItems.slice(0, 3).forEach((item: any) => {
        summaryText += `  • ${item.title}\n`;
      });
      if (highPriorityItems.length > 3) {
        summaryText += `  • ... and ${highPriorityItems.length - 3} more\n`;
      }
      summaryText += `\n`;
    }

    if (regularItems.length > 0) {
      summaryText += `📋 REGULAR: ${regularItems.length} item(s) to work on\n`;
      regularItems.slice(0, 3).forEach((item: any) => {
        summaryText += `  • ${item.title}\n`;
      });
      if (regularItems.length > 3) {
        summaryText += `  • ... and ${regularItems.length - 3} more\n`;
      }
      summaryText += `\n`;
    }

    summaryText += `💡 TIP: Focus on critical items first, then high priority, then regular tasks.`;

    return summaryText;
  }

  async scheduleDailySummary(userId: string, time: string = '08:00') {
    try {
      // Parse the time - this is a simplified implementation
      // In a real application, you'd want more robust time parsing
      const [hours, minutes] = time.split(':').map(Number);

      // Calculate time until next occurrence of this time
      const now = new Date();
      const nextOccurrence = new Date();
      nextOccurrence.setHours(hours, minutes, 0, 0);

      // If the time has already passed today, set it for tomorrow
      if (nextOccurrence <= now) {
        nextOccurrence.setDate(nextOccurrence.getDate() + 1);
      }

      const timeUntilSummary = nextOccurrence.getTime() - now.getTime();

      // Schedule the daily summary
      setTimeout(async () => {
        try {
          await this.generateDailySummary(userId);

          // Reschedule for the next day
          await this.scheduleDailySummary(userId, time);
        } catch (error) {
          console.error('Error in scheduled daily summary:', error);
        }
      }, timeUntilSummary);

      return {
        success: true,
        message: `Daily summary scheduled for ${time} daily`,
        nextRun: nextOccurrence
      };
    } catch (error) {
      console.error('Error scheduling daily summary:', error);
      throw error;
    }
  }
}

export default new DailySummaryAgent();