/**
 * Reminder Scheduler Service
 * Manages background jobs for firing reminders at scheduled times
 * Proves autonomy over time by executing actions without human intervention
 */

import { PrismaClient } from "@prisma/client";
import { StructuredLogger } from "../core/logging/structuredLogger";

const prisma = new PrismaClient();
const logger = new StructuredLogger("reminderScheduler");

interface ScheduledReminder {
  reminderId: string;
  timeoutId: NodeJS.Timeout;
  remindAt: Date;
}

class ReminderScheduler {
  private scheduledReminders: Map<string, ScheduledReminder> = new Map();

  /**
   * Schedule a reminder to fire at a specific time
   */
  scheduleReminder(
    reminderId: string,
    remindAt: Date,
    callback: () => void,
  ): void {
    // Cancel existing reminder if it exists
    this.cancelReminder(reminderId);

    const now = Date.now();
    const remindAtTime = new Date(remindAt).getTime();
    const delay = remindAtTime - now;

    if (delay <= 0) {
      // Reminder is in the past, fire immediately
      logger.warn("schedule:past_reminder", {
        reminderId,
        remindAt,
        delay,
      });
      callback();
      return;
    }

    logger.info("schedule:reminder", {
      reminderId,
      remindAt,
      delayMs: delay,
    });

    // Schedule the reminder
    const timeoutId = setTimeout(() => {
      logger.info("reminder:fired", {
        reminderId,
        remindAt,
        firedAt: new Date(),
      });

      // Execute callback
      callback();

      // Remove from scheduled reminders
      this.scheduledReminders.delete(reminderId);
    }, delay);

    // Store the scheduled reminder
    this.scheduledReminders.set(reminderId, {
      reminderId,
      timeoutId,
      remindAt,
    });
  }

  /**
   * Cancel a scheduled reminder
   */
  cancelReminder(reminderId: string): void {
    const scheduled = this.scheduledReminders.get(reminderId);
    if (scheduled) {
      clearTimeout(scheduled.timeoutId);
      this.scheduledReminders.delete(reminderId);
      logger.info("cancel:reminder", { reminderId });
    }
  }

  /**
   * Re-schedule all pending reminders from the database
   * Called on server restart to restore scheduled reminders
   */
  async restorePendingReminders(): Promise<void> {
    try {
      // Find all reminders that are pending (have remindAt in the future)
      const now = new Date();
      const pendingReminders = await prisma.reminder.findMany({
        where: {
          status: "pending",
          remindAt: {
            gte: now,
          },
        },
      });

      logger.info("restore:pending_reminders", {
        count: pendingReminders.length,
      });

      // Schedule each reminder
      for (const reminder of pendingReminders) {
        this.scheduleReminder(reminder.id, reminder.remindAt, () => {
          this.handleReminderFired(reminder.id, reminder.title);
        });
      }
    } catch (error) {
      logger.error("restore:error", error as Error);
    }
  }

  /**
   * Handle a reminder firing
   */
  private async handleReminderFired(
    reminderId: string,
    title: string,
  ): Promise<void> {
    try {
      logger.info("reminder:triggered", {
        reminderId,
        title,
        triggeredAt: new Date(),
      });

      // Update reminder status to fired
      await prisma.reminder.update({
        where: { id: reminderId },
        data: {
          status: "fired",
          firedAt: new Date(),
        },
      });

      // In a real system, this would send a notification to the user
      // For now, we just log it to prove autonomy
      console.log(
        `\n🔔 REMINDER FIRED: ${title}\n   Time: ${new Date().toISOString()}\n   Reminder ID: ${reminderId}\n`,
      );
    } catch (error) {
      logger.error("reminder:fire_error", error as Error, {
        reminderId,
      });
    }
  }

  /**
   * Get status of scheduled reminders
   */
  getStatus(): {
    scheduledCount: number;
    reminders: Array<{ reminderId: string; remindAt: Date }>;
  } {
    const reminders = Array.from(this.scheduledReminders.values()).map((r) => ({
      reminderId: r.reminderId,
      remindAt: r.remindAt,
    }));

    return {
      scheduledCount: this.scheduledReminders.size,
      reminders,
    };
  }
}

// Singleton instance
export const reminderScheduler = new ReminderScheduler();
export default reminderScheduler;
