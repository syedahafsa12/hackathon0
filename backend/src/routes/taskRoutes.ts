import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const DEV_USER_ID = "dev-user-001";

export default async function taskRoutes(fastify: FastifyInstance) {
  // Development mode middleware
  const injectDevUserId = async (req: FastifyRequest) => {
    if (process.env.NODE_ENV !== "production") {
      (req as AuthenticatedRequest).userId = DEV_USER_ID;
    }
  };

  // Get all tasks
  fastify.get(
    "/api/tasks",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        console.log("[TaskRoutes] Fetching tasks for user:", userId);

        const tasks = await prisma.task.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" }
        });

        console.log("[TaskRoutes] Found tasks:", tasks.length);

        return res.send({
          success: true,
          data: { tasks }
        });
      } catch (error: any) {
        console.error("[TaskRoutes] Error fetching tasks:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to fetch tasks" }
        });
      }
    }
  );

  // Create task
  fastify.post(
    "/api/tasks",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { title, description, priority, dueDate } = req.body as any;

        console.log("[TaskRoutes] Creating task:", { title, userId });

        const task = await prisma.task.create({
          data: {
            userId,
            title,
            description,
            priority,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            status: "pending"
          }
        });

        console.log("[TaskRoutes] Task created:", task.id);

        return res.send({
          success: true,
          data: { task }
        });
      } catch (error: any) {
        console.error("[TaskRoutes] Error creating task:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to create task" }
        });
      }
    }
  );

  // Update task
  fastify.patch(
    "/api/tasks/:id",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { id } = req.params as { id: string };
        const updates = req.body as any;

        console.log("[TaskRoutes] Updating task:", id);

        const task = await prisma.task.update({
          where: { id },
          data: {
            ...updates,
            dueDate: updates.dueDate ? new Date(updates.dueDate) : undefined,
            completedAt: updates.status === "completed" ? new Date() : undefined
          }
        });

        console.log("[TaskRoutes] Task updated:", task.id);

        return res.send({
          success: true,
          data: { task }
        });
      } catch (error: any) {
        console.error("[TaskRoutes] Error updating task:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to update task" }
        });
      }
    }
  );

  // Delete task
  fastify.delete(
    "/api/tasks/:id",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const { id } = req.params as { id: string };

        console.log("[TaskRoutes] Deleting task:", id);

        await prisma.task.delete({ where: { id } });

        return res.send({
          success: true,
          data: { deleted: true }
        });
      } catch (error: any) {
        console.error("[TaskRoutes] Error deleting task:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to delete task" }
        });
      }
    }
  );
}
