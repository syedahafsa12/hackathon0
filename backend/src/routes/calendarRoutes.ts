import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const DEV_USER_ID = "dev-user-001";

export default async function calendarRoutes(fastify: FastifyInstance) {
  const injectDevUserId = async (req: FastifyRequest) => {
    if (process.env.NODE_ENV !== "production") {
      (req as AuthenticatedRequest).userId = DEV_USER_ID;
    }
  };

  // Get calendar events (Synced with Google)
  fastify.get(
    "/api/calendar/events",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { default: googleCalendarService } =
          await import("../services/googleCalendarService");

        console.log("[CalendarRoutes] Fetching events for user:", userId);

        // Define range for "all" events (e.g., month range)
        const now = new Date();
        const thirtyDaysAgo = new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        const thirtyDaysAhead = new Date(
          now.getTime() + 30 * 24 * 60 * 60 * 1000,
        );

        let googleEvents: any[] = [];
        // 1. Fetch Google Calendar events
        try {
          googleEvents = await googleCalendarService.getEvents(
            userId,
            thirtyDaysAgo,
            thirtyDaysAhead,
          );
        } catch (error: any) {
          if (error.message === "NO_TOKENS") {
            console.warn(
              "[CalendarRoutes] User needs to connect Google Calendar",
            );
            // Return empty array for google events but don't fail the request
            googleEvents = [];
          } else {
            console.error("[CalendarRoutes] Google Calendar error:", error);
            // If real error, still return local events but log it
            googleEvents = [];
          }
        }

        // 2. Fetch from Local DB
        // Fix: Exclude events that are already synced to Google (have eventId) to prevent duplicates
        const dbEvents = await prisma.calendarEvent.findMany({
          where: {
            userId,
            eventId: null, // Only get local-only events
          },
          orderBy: { startTime: "asc" },
        });

        // Map to unified frontend format
        const mappedDbEvents = dbEvents.map((e) => ({
          id: e.id,
          title: e.title,
          startTime: e.startTime,
          endTime: e.endTime,
          location: e.location,
          isRemote: false,
          calendarId: e.eventId || "local",
        }));

        const mappedGoogleEvents = googleEvents.map((e: any) => ({
          id: e.id,
          title: e.summary,
          startTime: new Date(e.start.dateTime || e.start.date),
          endTime: new Date(e.end.dateTime || e.end.date),
          location: e.location,
          isRemote: true,
          calendarId: "google",
        }));

        const allEvents = [...mappedDbEvents, ...mappedGoogleEvents].sort(
          (a: any, b: any) => a.startTime.getTime() - b.startTime.getTime(),
        );

        return res.send({
          success: true,
          data: { events: allEvents },
        });
      } catch (error: any) {
        console.error("[CalendarRoutes] Error fetching events:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to fetch events" },
        });
      }
    },
  );

  // Get Today's events specifically
  fastify.get(
    "/api/calendar/today",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { default: googleCalendarService } =
          await import("../services/googleCalendarService");

        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));

        const events = await googleCalendarService.getEvents(
          userId,
          startOfDay,
          endOfDay,
        );

        return res.send({
          success: true,
          data: {
            events: events.map((e: any) => ({
              id: e.id,
              title: e.summary,
              startTime: e.start.dateTime || e.start.date,
              endTime: e.end.dateTime || e.end.date,
              location: e.location,
            })),
          },
        });
      } catch (error: any) {
        console.error("[CalendarRoutes] Error fetching today's events:", error);
        return res.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch today's events",
          },
        });
      }
    },
  );

  // Create calendar event
  fastify.post(
    "/api/calendar/events",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { title, description, startDate, endDate, location, attendees } =
          req.body as any;

        console.log("[CalendarRoutes] Creating event:", { title, userId });

        const event = await prisma.calendarEvent.create({
          data: {
            userId,
            title,
            description,
            startTime: new Date(startDate),
            endTime: new Date(endDate),
            location,
            attendees: attendees ? JSON.stringify(attendees) : null,
          },
        });

        console.log("[CalendarRoutes] Event created:", event.id);

        return res.send({
          success: true,
          data: {
            event: {
              ...event,
              startDate: event.startTime,
              endDate: event.endTime,
              attendees: attendees || [],
            },
          },
        });
      } catch (error: any) {
        console.error("[CalendarRoutes] Error creating event:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to create event" },
        });
      }
    },
  );

  // Delete calendar event
  fastify.delete(
    "/api/calendar/events/:id",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const { id } = req.params as { id: string };

        console.log("[CalendarRoutes] Deleting event:", id);

        await prisma.calendarEvent.delete({ where: { id } });

        return res.send({
          success: true,
          data: { deleted: true },
        });
      } catch (error: any) {
        console.error("[CalendarRoutes] Error deleting event:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to delete event" },
        });
      }
    },
  );
}
