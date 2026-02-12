/**
 * Reminder Watcher - Handles reminder creation actions
 */

import { PrismaClient } from "@prisma/client";
import { Approval } from "../../../../shared/types";
import { BaseWatcher } from "../../core/watchers/BaseWatcher";
import { ExecutionResult, ActionType } from "../../core/actionTypes";

const prisma = new PrismaClient();

/**
 * Smart date parsing for natural language time expressions
 * Handles: "now", "in 1 hour", "tomorrow", "5 minutes", "5:14pm", "at 5:14 pm today", etc.
 * Assumes local timezone is Asia/Karachi (PKT, UTC+5)
 */
function parseSmartDate(input: string | Date | undefined): Date {
  // If already a valid Date object, return it
  if (input instanceof Date && !isNaN(input.getTime())) {
    return input;
  }

  // Get current time in UTC
  const nowUtc = new Date();

  // Calculate Karachi time (UTC+5)
  // PKT is 5 hours ahead of UTC
  const PKT_OFFSET = 5 * 60 * 60 * 1000;
  const nowPkt = new Date(nowUtc.getTime() + PKT_OFFSET);

  // Default fallback: 1 hour from now
  const defaultDate = new Date(nowUtc.getTime() + 3600000);

  if (!input) {
    return defaultDate;
  }

  // If it's a string, try to parse it
  const str = String(input).toLowerCase().trim();

  // Try standard date parsing first (for ISO dates)
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime()) && parsed.getTime() > nowUtc.getTime()) {
    return parsed;
  }

  // Handle specific time like "5:14pm", "5:14 pm", "at 5:14pm", "17:14"
  const timeMatch = str.match(/(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const period = timeMatch[3]?.toLowerCase();

    // Convert to 24-hour format
    if (period === "pm" && hours < 12) {
      hours += 12;
    } else if (period === "am" && hours === 12) {
      hours = 0;
    }

    // Create date for today in PKT
    const targetDatePkt = new Date(nowPkt);
    targetDatePkt.setHours(hours, minutes, 0, 0);

    // If the time has already passed today in PKT, schedule for tomorrow
    if (targetDatePkt.getTime() <= nowPkt.getTime()) {
      targetDatePkt.setDate(targetDatePkt.getDate() + 1);
    }

    // Convert back to UTC for storage
    const targetDateUtc = new Date(targetDatePkt.getTime() - PKT_OFFSET);

    console.log(
      `[parseSmartDate] Parsed time "${str}" (PKT) -> ${targetDateUtc.toISOString()}`,
    );
    return targetDateUtc;
  }

  // Handle "X pm" or "X am" without minutes (e.g., "5pm", "5 pm")
  const simpleTimeMatch = str.match(/(?:at\s+)?(\d{1,2})\s*(am|pm)/i);
  if (simpleTimeMatch) {
    let hours = parseInt(simpleTimeMatch[1], 10);
    const period = simpleTimeMatch[2]?.toLowerCase();

    // Convert to 24-hour format
    if (period === "pm" && hours < 12) {
      hours += 12;
    } else if (period === "am" && hours === 12) {
      hours = 0;
    }

    // Create date for today in PKT
    const targetDatePkt = new Date(nowPkt);
    targetDatePkt.setHours(hours, 0, 0, 0);

    // If the time has already passed today in PKT, schedule for tomorrow
    if (targetDatePkt.getTime() <= nowPkt.getTime()) {
      targetDatePkt.setDate(targetDatePkt.getDate() + 1);
    }

    // Convert back to UTC for storage
    const targetDateUtc = new Date(targetDatePkt.getTime() - PKT_OFFSET);

    console.log(
      `[parseSmartDate] Parsed simple time "${str}" (PKT) -> ${targetDateUtc.toISOString()}`,
    );
    return targetDateUtc;
  }

  // Handle "now" - set to 5 minutes from now (reasonable buffer)
  if (str === "now" || str === "immediately" || str === "asap") {
    return new Date(nowUtc.getTime() + 5 * 60 * 1000);
  }

  // Handle relative time expressions (remain the same as they are duration-based)
  const minuteMatch = str.match(/(\d+)\s*(min|minute)/i);
  if (minuteMatch) {
    const minutes = parseInt(minuteMatch[1], 10);
    return new Date(nowUtc.getTime() + minutes * 60 * 1000);
  }

  const hourMatch = str.match(/(\d+)\s*(hr|hour)/i);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    return new Date(nowUtc.getTime() + hours * 60 * 60 * 1000);
  }

  const dayMatch = str.match(/(\d+)\s*(day)/i);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    return new Date(nowUtc.getTime() + days * 24 * 60 * 60 * 1000);
  }

  // Handle "tomorrow" (9 AM in PKT)
  if (str.includes("tomorrow")) {
    const tomorrowPkt = new Date(nowPkt.getTime() + 24 * 60 * 60 * 1000);
    tomorrowPkt.setHours(9, 0, 0, 0);
    const targetDateUtc = new Date(tomorrowPkt.getTime() - PKT_OFFSET);
    return targetDateUtc;
  }

  // Handle "tonight" (8 PM in PKT)
  if (str.includes("tonight")) {
    const tonightPkt = new Date(nowPkt);
    tonightPkt.setHours(20, 0, 0, 0);
    if (tonightPkt.getTime() < nowPkt.getTime()) {
      tonightPkt.setDate(tonightPkt.getDate() + 1);
    }
    const targetDateUtc = new Date(tonightPkt.getTime() - PKT_OFFSET);
    return targetDateUtc;
  }

  // Fallback: 1 hour from now
  console.log(
    `[parseSmartDate] Could not parse "${str}", using default 1 hour from now`,
  );
  return defaultDate;
}

export class ReminderWatcher extends BaseWatcher {
  constructor() {
    super("reminderWatcher");
  }

  canHandle(approval: Approval): boolean {
    return approval.actionType === ActionType.REMINDER_CREATE;
  }

  async execute(approval: Approval): Promise<ExecutionResult> {
    try {
      const { entities, rawMessage } = approval.actionData;

      // Extract reminder details
      const reminderData = {
        title: entities?.title || entities?.reminder || rawMessage,
        description: entities?.description,
        remindAt:
          entities?.remindAt ||
          entities?.when ||
          new Date(Date.now() + 3600000), // Default: 1 hour from now
      };

      this.logger.info("execute:creating_reminder", {
        approvalId: approval.id,
        data: { title: reminderData.title, remindAt: reminderData.remindAt },
      });

      // Parse the reminder time with smart date handling
      const parsedRemindAt = parseSmartDate(reminderData.remindAt);

      this.logger.info("execute:parsed_reminder_time", {
        approvalId: approval.id,
        original: reminderData.remindAt,
        parsed: parsedRemindAt.toISOString(),
      });

      // Create reminder as a dedicated Reminder record
      const reminder = await prisma.reminder.create({
        data: {
          userId: approval.userId,
          title: reminderData.title,
          description: reminderData.description,
          remindAt: parsedRemindAt,
          status: "pending",
        },
      });

      // Schedule the reminder to fire autonomously
      const reminderScheduler = require("../reminderScheduler").default;
      reminderScheduler.scheduleReminder(reminder.id, reminder.remindAt, () => {
        this.logger.info("reminder:autonomous_trigger", {
          reminderId: reminder.id,
          title: reminder.title,
        });

        // NOTIFICATION FIX: Emit event to frontend
        const websocketService = require("../websocket").default;
        websocketService.emitToUser(approval.userId, "new_message", {
          id: `remind-${Date.now()}`,
          text: `🔔 **REMINDER:** ${reminder.title}\n${reminder.description || ""}`,
          sender: "Mini Hafsa",
          timestamp: new Date().toISOString(),
          isUser: false,
        });
      });

      this.logger.info("execute:reminder_scheduled", {
        approvalId: approval.id,
        reminderId: reminder.id,
        remindAt: reminder.remindAt,
      });

      return {
        success: true,
        data: {
          reminderId: reminder.id,
          title: reminder.title,
          remindAt: reminder.remindAt,
          status: reminder.status,
          verification: "Reminder persisted and scheduled to fire autonomously",
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

export default new ReminderWatcher();
