import {
  PrismaClient,
  CalendarEvent as PrismaCalendarEvent,
} from "@prisma/client";
import { CalendarEvent } from "../../../shared/types";
import crypto from "crypto";

const uuidv4 = (): string => crypto.randomUUID();

const prisma = new PrismaClient();

export class CalendarService {
  async createCalendarEvent(
    userId: string,
    eventData: {
      title: string;
      description?: string;
      startTime: Date;
      endTime: Date;
      location?: string;
      attendees?: Array<{ name: string; email: string }>;
    },
  ): Promise<CalendarEvent> {
    try {
      const calendarEvent = await prisma.calendarEvent.create({
        data: {
          id: uuidv4(),
          userId,
          title: eventData.title,
          description: eventData.description || null,
          startTime: eventData.startTime,
          endTime: eventData.endTime,
          location: eventData.location || null,
          attendees: eventData.attendees
            ? JSON.stringify(eventData.attendees)
            : null,
          calendarId: `cal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Mock calendar ID
        },
      });

      return this.mapPrismaToCalendarEvent(calendarEvent);
    } catch (error) {
      console.error("Error creating calendar event:", error);
      throw error;
    }
  }

  async getCalendarEventsByUserId(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 50,
  ): Promise<CalendarEvent[]> {
    try {
      const whereClause: any = { userId };

      if (startDate && endDate) {
        whereClause.OR = [
          {
            startTime: { gte: startDate, lt: endDate },
          },
          {
            endTime: { gte: startDate, lt: endDate },
          },
          {
            startTime: { lte: startDate },
            endTime: { gte: endDate },
          },
        ];
      } else if (startDate) {
        whereClause.startTime = { gte: startDate };
      } else if (endDate) {
        whereClause.endTime = { lte: endDate };
      }

      const events = await prisma.calendarEvent.findMany({
        where: whereClause,
        orderBy: { startTime: "asc" },
        take: limit,
      });

      return events.map(this.mapPrismaToCalendarEvent);
    } catch (error) {
      console.error("Error getting calendar events:", error);
      throw error;
    }
  }

  async getCalendarEventById(
    id: string,
    userId: string,
  ): Promise<CalendarEvent | null> {
    try {
      const event = await prisma.calendarEvent.findUnique({
        where: { id },
      });

      if (!event || event.userId !== userId) {
        return null;
      }

      return this.mapPrismaToCalendarEvent(event);
    } catch (error) {
      console.error("Error getting calendar event by id:", error);
      throw error;
    }
  }

  async updateCalendarEvent(
    id: string,
    userId: string,
    updateData: Partial<CalendarEvent>,
  ): Promise<CalendarEvent> {
    try {
      const event = await prisma.calendarEvent.findUnique({
        where: { id },
      });

      if (!event || event.userId !== userId) {
        throw new Error("Calendar event not found or unauthorized");
      }

      const updatedEvent = await prisma.calendarEvent.update({
        where: { id },
        data: {
          title: updateData.title,
          description: updateData.description || undefined,
          startTime: updateData.startTime
            ? new Date(updateData.startTime)
            : undefined,
          endTime: updateData.endTime
            ? new Date(updateData.endTime)
            : undefined,
          location: updateData.location,
          attendees: updateData.attendees
            ? JSON.stringify(updateData.attendees)
            : undefined,
        },
      });

      return this.mapPrismaToCalendarEvent(updatedEvent);
    } catch (error) {
      console.error("Error updating calendar event:", error);
      throw error;
    }
  }

  async deleteCalendarEvent(id: string, userId: string): Promise<boolean> {
    try {
      const event = await prisma.calendarEvent.findUnique({
        where: { id },
      });

      if (!event || event.userId !== userId) {
        throw new Error("Calendar event not found or unauthorized");
      }

      await prisma.calendarEvent.delete({
        where: { id },
      });

      return true;
    } catch (error) {
      console.error("Error deleting calendar event:", error);
      throw error;
    }
  }

  async getTodaysEvents(userId: string): Promise<CalendarEvent[]> {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      return this.getCalendarEventsByUserId(userId, startOfDay, endOfDay);
    } catch (error) {
      console.error("Error getting today's events:", error);
      throw error;
    }
  }

  async getNextWeekEvents(userId: string): Promise<CalendarEvent[]> {
    try {
      const startOfNextWeek = new Date();
      const daysToAdd = (7 - startOfNextWeek.getDay()) % 7;
      startOfNextWeek.setDate(startOfNextWeek.getDate() + daysToAdd);
      startOfNextWeek.setHours(0, 0, 0, 0);

      const endOfNextWeek = new Date(startOfNextWeek);
      endOfNextWeek.setDate(endOfNextWeek.getDate() + 7);
      endOfNextWeek.setHours(23, 59, 59, 999);

      return this.getCalendarEventsByUserId(
        userId,
        startOfNextWeek,
        endOfNextWeek,
      );
    } catch (error) {
      console.error("Error getting next week's events:", error);
      throw error;
    }
  }

  private mapPrismaToCalendarEvent(prismaEvent: any): CalendarEvent {
    return {
      id: prismaEvent.id,
      userId: prismaEvent.userId,
      title: prismaEvent.title,
      description: prismaEvent.description || undefined,
      startTime: prismaEvent.startTime,
      endTime: prismaEvent.endTime,
      location: prismaEvent.location || undefined,
      attendees: prismaEvent.attendees
        ? JSON.parse(prismaEvent.attendees)
        : undefined,
      calendarId: prismaEvent.calendarId || undefined,
      createdAt: prismaEvent.createdAt,
      updatedAt: prismaEvent.updatedAt,
    };
  }
}

export default new CalendarService();
