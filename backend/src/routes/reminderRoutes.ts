import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middleware/auth";
import reminderScheduler from "../services/reminderScheduler";

const prisma = new PrismaClient();
const DEV_USER_ID = "dev-user-001";

export default async function reminderRoutes(fastify: FastifyInstance) {
  const injectDevUserId = async (req: FastifyRequest) => {
    if (process.env.NODE_ENV !== "production") {
      (req as AuthenticatedRequest).userId = DEV_USER_ID;
    }
  };

  // Get all reminders
  fastify.get(
    "/api/reminders",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        console.log("[ReminderRoutes] Fetching reminders for user:", userId);

        const reminders = await prisma.reminder.findMany({
          where: { userId },
          orderBy: { remindAt: "asc" },
        });

        console.log("[ReminderRoutes] Found reminders:", reminders.length);

        return res.send({
          success: true,
          data: { reminders },
        });
      } catch (error: any) {
        console.error("[ReminderRoutes] Error fetching reminders:", error);
        return res.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch reminders",
          },
        });
      }
    },
  );

  // Create reminder
  fastify.post(
    "/api/reminders",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { title, description, remindAt } = req.body as any;

        if (!title || !remindAt) {
          return res.status(400).send({
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Title and remindAt are required",
            },
          });
        }

        console.log("[ReminderRoutes] Creating reminder:", {
          title,
          userId,
          remindAt,
        });

        const reminder = await prisma.reminder.create({
          data: {
            userId,
            title,
            description,
            remindAt: new Date(remindAt),
            status: "pending",
          },
        });

        // Schedule the reminder to fire autonomously
        reminderScheduler.scheduleReminder(
          reminder.id,
          reminder.remindAt,
          () => {
            console.log(
              `[ReminderScheduler] Reminder fired: ${reminder.id} - ${reminder.title}`,
            );
          },
        );

        console.log(
          "[ReminderRoutes] Reminder created and scheduled:",
          reminder.id,
        );

        return res.send({
          success: true,
          data: { reminder },
        });
      } catch (error: any) {
        console.error("[ReminderRoutes] Error creating reminder:", error);
        return res.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to create reminder",
          },
        });
      }
    },
  );

  // Update reminder
  fastify.patch(
    "/api/reminders/:id",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const { id } = req.params as { id: string };
        const updates = req.body as any;

        console.log("[ReminderRoutes] Updating reminder:", id);

        // If remindAt is being updated, reschedule
        if (updates.remindAt) {
          reminderScheduler.cancelReminder(id);

          const reminder = await prisma.reminder.update({
            where: { id },
            data: {
              ...updates,
              remindAt: updates.remindAt
                ? new Date(updates.remindAt)
                : undefined,
            },
          });

          // Reschedule if still pending
          if (reminder.status === "pending") {
            reminderScheduler.scheduleReminder(
              reminder.id,
              reminder.remindAt,
              () => {
                console.log(
                  `[ReminderScheduler] Reminder fired: ${reminder.id} - ${reminder.title}`,
                );
              },
            );
          }

          return res.send({
            success: true,
            data: { reminder },
          });
        }

        const reminder = await prisma.reminder.update({
          where: { id },
          data: updates,
        });

        console.log("[ReminderRoutes] Reminder updated:", reminder.id);

        return res.send({
          success: true,
          data: { reminder },
        });
      } catch (error: any) {
        console.error("[ReminderRoutes] Error updating reminder:", error);
        return res.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to update reminder",
          },
        });
      }
    },
  );

  // Delete reminder
  fastify.delete(
    "/api/reminders/:id",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const { id } = req.params as { id: string };

        console.log("[ReminderRoutes] Deleting reminder:", id);

        // Cancel scheduled reminder
        reminderScheduler.cancelReminder(id);

        // Delete from database
        await prisma.reminder.delete({ where: { id } });

        return res.send({
          success: true,
          data: { deleted: true },
        });
      } catch (error: any) {
        console.error("[ReminderRoutes] Error deleting reminder:", error);
        return res.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to delete reminder",
          },
        });
      }
    },
  );
}
