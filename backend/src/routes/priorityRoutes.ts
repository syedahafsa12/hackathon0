/**
 * Priority Sorter Agent API Routes
 */

import { FastifyInstance } from "fastify";
import { prioritySorterAgent } from "../agents/prioritySorter";

export default async function priorityRoutes(fastify: FastifyInstance) {
  // Generate today's priority plan
  fastify.post("/api/priority/generate", async (request, reply) => {
    try {
      const userId = (request as any).userId || "dev-user-001";
      const result = await prioritySorterAgent.generateDailyPriorities(userId);

      if (result.success) {
        return {
          success: true,
          message: "Priority plan generated successfully",
          filePath: result.filePath,
          priorities: {
            doNow: result.priorities?.doNow.length || 0,
            doNext: result.priorities?.doNext.length || 0,
            canWait: result.priorities?.canWait.length || 0,
          },
          conflicts: result.conflicts,
        };
      } else {
        reply.code(500);
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  // Get today's priority plan
  fastify.get("/api/priority/today", async (request, reply) => {
    try {
      const userId = (request as any).userId || "dev-user-001";
      const plan = await prioritySorterAgent.getTodaysPlan(userId);

      if (plan) {
        return {
          success: true,
          plan,
        };
      } else {
        // No plan exists, suggest generating one
        return {
          success: true,
          plan: null,
          message:
            "No priority plan for today. Use POST /api/priority/generate to create one.",
        };
      }
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  // Re-sort priorities (manual trigger)
  fastify.post("/api/priority/resort", async (request, reply) => {
    try {
      const userId = (request as any).userId || "dev-user-001";
      const result = await prioritySorterAgent.resort(userId);

      if (result.success) {
        return {
          success: true,
          message: "Priorities re-sorted successfully",
          filePath: result.filePath,
          priorities: result.priorities,
        };
      } else {
        reply.code(500);
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });
  // Get unified priorities (Calendar + Tasks + Reminders)
  fastify.get("/api/priorities", async (request, reply) => {
    try {
      const userId = (request as any).userId || "dev-user-001";
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      const { default: googleCalendarService } =
        await import("../services/googleCalendarService");

      // Define today's range in UTC
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // 1. Fetch Google Calendar events
      let googleEvents: any[] = [];
      try {
        googleEvents = await googleCalendarService.getEvents(
          userId,
          startOfDay,
          endOfDay,
        );
      } catch (error: any) {
        if (error.message === "NO_TOKENS") {
          console.warn(
            "[PriorityRoutes] User needs to connect Google Calendar",
          );
          googleEvents = [];
        } else {
          console.error("[PriorityRoutes] Google Calendar error:", error);
          // Don't fail the whole priority fetch just because calendar failed
          googleEvents = [];
        }
      }

      // 2. Fetch pending tasks
      const allTasks = await prisma.task.findMany({
        where: {
          userId,
          status: { in: ["pending", "in_progress"] },
        },
        orderBy: { dueDate: "asc" },
      });

      // 3. Fetch pending reminders
      const reminders = await prisma.reminder.findMany({
        where: {
          userId,
          status: "pending",
          remindAt: { lte: endOfDay },
        },
        orderBy: { remindAt: "asc" },
      });

      // Categorization Logic
      const doNow: any[] = [];
      const doNext: any[] = [];
      const canWait: any[] = [];

      // Events are always Do Now
      googleEvents.forEach((e: any) => {
        doNow.push({
          id: e.id,
          text: `📅 ${e.summary} (${new Date(e.start.dateTime || e.start.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`,
          type: "event",
          startTime: e.start.dateTime || e.start.date,
        });
      });

      // Reminders are Do Now
      reminders.forEach((r) => {
        doNow.push({
          id: r.id,
          text: `🔔 ${r.title}`,
          type: "reminder",
          remindAt: r.remindAt,
        });
      });

      // Tasks: High priority or due today -> Do Now. Medium/Low -> Do Next/Can Wait.
      allTasks.forEach((t) => {
        const item = {
          id: t.id,
          text: `📝 ${t.title}`,
          type: "task",
          priority: t.priority,
          dueDate: t.dueDate,
        };

        if (t.priority === "high" || (t.dueDate && t.dueDate <= endOfDay)) {
          doNow.push(item);
        } else if (t.priority === "medium") {
          doNext.push(item);
        } else {
          canWait.push(item);
        }
      });

      return {
        success: true,
        data: {
          sections: {
            doNow,
            doNext,
            canWait,
          },
          raw: {
            todayEvents: googleEvents,
            pendingTasks: allTasks,
            reminders: reminders,
          },
          lastUpdated: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(
        "[PriorityRoutes] Error fetching unified priorities:",
        error,
      );
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });
}
