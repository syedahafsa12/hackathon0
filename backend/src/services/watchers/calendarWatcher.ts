/**
 * Calendar Watcher - Handles calendar event creation actions
 */

import { Approval } from "../../../../shared/types";
import { BaseWatcher } from "../../core/watchers/BaseWatcher";
import { ExecutionResult, ActionType } from "../../core/actionTypes";
import calendarService from "../calendarService";
import googleCalendarService from "../googleCalendarService";

/**
 * Smart date parsing for natural language time expressions
 * Handles: "now", "in 5 minutes", "5:14pm", "next 5 minutes", etc.
 */
function parseSmartDate(
  input: string | Date | undefined,
  defaultHoursFromNow: number = 1,
): Date {
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

  // Default fallback
  const defaultDate = new Date(
    nowUtc.getTime() + defaultHoursFromNow * 60 * 60 * 1000,
  );

  if (!input) {
    return defaultDate;
  }

  const str = String(input).toLowerCase().trim();

  // Try standard date parsing first (for ISO dates from LLM)
  // Fix: LLM returns ISO "YYYY-MM-DDTHH:mm:ss" which implies Local (PKT) but parsed as UTC
  // We force it to be treated as PKT by appending "+05:00" if missing TZ
  let dateStr = input.toString();
  if (
    /\d{4}-\d{2}-\d{2}T/.test(dateStr) &&
    !/Z|[+-]\d{2}:?\d{2}$/.test(dateStr)
  ) {
    dateStr += "+05:00";
    console.log(`[CalendarWatcher] Appended PKT offset to ISO: ${dateStr}`);
  }

  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime()) && parsed.getTime() > nowUtc.getTime() - 60000) {
    // Allow 1 minute leeway
    return parsed;
  }

  // Handle specific time like "5:14pm", "5:14 pm", "at 5:14pm", "17:14"
  const timeMatch = str.match(/(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const period = timeMatch[3]?.toLowerCase();

    if (period === "pm" && hours < 12) {
      hours += 12;
    } else if (period === "am" && hours === 12) {
      hours = 0;
    }

    // Create date for today in PKT
    const targetDatePkt = new Date(nowPkt);
    targetDatePkt.setHours(hours, minutes, 0, 0);

    // If the time has already passed today in PKT, schedule for tomorrow
    // ONLY if "today" was not explicitly requested
    if (targetDatePkt.getTime() <= nowPkt.getTime() && !str.includes("today")) {
      targetDatePkt.setDate(targetDatePkt.getDate() + 1);
    }

    // Convert back to UTC for storage
    const targetDateUtc = new Date(targetDatePkt.getTime() - PKT_OFFSET);

    console.log(
      `[CalendarWatcher] Parsed time "${str}" (PKT) -> ${targetDateUtc.toISOString()}`,
    );
    return targetDateUtc;
  }

  // Handle "X pm" or "X am" without minutes
  const simpleTimeMatch = str.match(/(?:at\s+)?(\d{1,2})\s*(am|pm)/i);
  if (simpleTimeMatch) {
    let hours = parseInt(simpleTimeMatch[1], 10);
    const period = simpleTimeMatch[2]?.toLowerCase();

    if (period === "pm" && hours < 12) {
      hours += 12;
    } else if (period === "am" && hours === 12) {
      hours = 0;
    }

    // Create date for today in PKT
    const targetDatePkt = new Date(nowPkt);
    targetDatePkt.setHours(hours, 0, 0, 0);

    // If the time has already passed today in PKT, schedule for tomorrow
    // ONLY if "today" was not explicitly requested
    if (targetDatePkt.getTime() <= nowPkt.getTime() && !str.includes("today")) {
      targetDatePkt.setDate(targetDatePkt.getDate() + 1);
    }

    // Convert back to UTC for storage
    const targetDateUtc = new Date(targetDatePkt.getTime() - PKT_OFFSET);

    return targetDateUtc;
  }

  // Handle "in X minutes" - THIS IS THE KEY FIX for "next 5 minutes"
  const inMinutesMatch = str.match(/(?:in|next)\s+(\d+)\s*(min|minute)/i);
  if (inMinutesMatch) {
    const minutes = parseInt(inMinutesMatch[1], 10);
    console.log(
      `[CalendarWatcher] Parsed "${str}" -> ${minutes} minutes from now`,
    );
    return new Date(nowUtc.getTime() + minutes * 60 * 1000);
  }

  // Handle "in X hours"
  const inHoursMatch = str.match(/(?:in|next)\s+(\d+)\s*(hr|hour)/i);
  if (inHoursMatch) {
    const hours = parseInt(inHoursMatch[1], 10);
    return new Date(nowUtc.getTime() + hours * 60 * 60 * 1000);
  }

  // Handle just "in X" or "next X" (assume minutes if small number)
  const genericInMatch = str.match(/(?:in|next)\s+(\d+)/i);
  if (genericInMatch) {
    const num = parseInt(genericInMatch[1], 10);
    // If number is small (< 60), assume minutes; otherwise hours
    const ms = num < 60 ? num * 60 * 1000 : num * 60 * 60 * 1000;
    console.log(
      `[CalendarWatcher] Parsed generic "${str}" -> ${num} ${num < 60 ? "minutes" : "hours"} from now`,
    );
    return new Date(nowUtc.getTime() + ms);
  }

  // Handle "now"
  if (str === "now" || str === "immediately") {
    return new Date(nowUtc.getTime() + 5 * 60 * 1000); // 5 minutes buffer
  }

  // Handle "tomorrow" (10 AM in PKT)
  if (str.includes("tomorrow")) {
    const tomorrowPkt = new Date(nowPkt.getTime() + 24 * 60 * 60 * 1000);
    tomorrowPkt.setHours(10, 0, 0, 0);
    const targetDateUtc = new Date(tomorrowPkt.getTime() - PKT_OFFSET);
    return targetDateUtc;
  }

  console.log(`[CalendarWatcher] Could not parse "${str}", using default`);
  return defaultDate;
}

export class CalendarWatcher extends BaseWatcher {
  constructor() {
    super("calendarWatcher");
  }

  canHandle(approval: Approval): boolean {
    return approval.actionType === ActionType.CALENDAR_CREATE;
  }

  async execute(approval: Approval): Promise<ExecutionResult> {
    try {
      const { entities, rawMessage } = approval.actionData;

      // Extract calendar event details
      const eventData = {
        title: entities?.title || entities?.event || rawMessage,
        startTime: entities?.startTime || entities?.when || new Date(),
        endTime: entities?.endTime,
        description: entities?.description || rawMessage,
        location: entities?.location,
      };

      this.logger.info("execute:creating_event", {
        approvalId: approval.id,
        data: { title: eventData.title, startTime: eventData.startTime },
      });

      // Parse dates with smart date parsing
      this.logger.info("execute:parsing_dates", {
        approvalId: approval.id,
        data: {
          rawStartTime: eventData.startTime,
          rawEndTime: eventData.endTime,
        },
      });

      // Use smart parsing for startTime
      const startTime = parseSmartDate(eventData.startTime, 0.5); // Default 30 min from now

      // Use smart parsing for endTime, or default to 1 hour after start
      let endTime: Date;
      if (eventData.endTime) {
        endTime = parseSmartDate(eventData.endTime, 1);
        // Ensure endTime is after startTime
        if (endTime.getTime() <= startTime.getTime()) {
          endTime = new Date(startTime.getTime() + 3600000); // 1 hour after start
        }
      } else {
        endTime = new Date(startTime.getTime() + 3600000); // 1 hour after start
      }

      this.logger.info("execute:parsed_dates", {
        approvalId: approval.id,
        data: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      });

      // Create calendar event in local database
      const event = await calendarService.createCalendarEvent(approval.userId, {
        title: eventData.title,
        description: eventData.description,
        startTime,
        endTime,
        location: eventData.location,
      });

      // Also create in Google Calendar if OAuth is set up
      try {
        const googleEvent = await googleCalendarService.createEvent(
          approval.userId,
          {
            title: eventData.title,
            description: eventData.description,
            startTime,
            endTime,
            location: eventData.location,
          },
        );

        // Link local event to Google event to prevent duplicates
        const { PrismaClient } = await import("@prisma/client");
        const prisma = new PrismaClient();
        await prisma.calendarEvent.update({
          where: { id: event.id },
          data: { eventId: googleEvent.id },
        });

        this.logger.info("execute:google_calendar_synced", {
          approvalId: approval.id,
          googleEventId: googleEvent.id,
        });
      } catch (googleError) {
        // Log but don't fail if Google Calendar sync fails
        this.logger.warn("execute:google_calendar_sync_failed", {
          approvalId: approval.id,
          error:
            googleError instanceof Error
              ? googleError.message
              : String(googleError),
        });
      }

      return {
        success: true,
        data: {
          eventId: event.id,
          title: event.title,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          createdAt: event.createdAt,
          verification: "Event persisted and queryable in database",
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

export default new CalendarWatcher();
