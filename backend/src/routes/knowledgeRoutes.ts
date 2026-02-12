import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const DEV_USER_ID = "dev-user-001";

export default async function knowledgeRoutes(fastify: FastifyInstance) {
  const injectDevUserId = async (req: FastifyRequest) => {
    if (process.env.NODE_ENV !== "production") {
      (req as AuthenticatedRequest).userId = DEV_USER_ID;
    }
  };

  // Get all knowledge entries
  fastify.get(
    "/api/knowledge",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        console.log("[KnowledgeRoutes] Fetching entries for user:", userId);

        const entries = await prisma.knowledgeEntry.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" }
        });

        // Map to expected frontend format
        const mappedEntries = entries.map(e => ({
          id: e.id,
          userId: e.userId,
          title: e.title,
          content: e.content,
          category: e.category || "general",
          tags: e.tags ? JSON.parse(e.tags) : [],
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
          lastAccessed: e.updatedAt
        }));

        console.log("[KnowledgeRoutes] Found entries:", mappedEntries.length);

        return res.send({
          success: true,
          data: { entries: mappedEntries }
        });
      } catch (error: any) {
        console.error("[KnowledgeRoutes] Error fetching entries:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to fetch entries" }
        });
      }
    }
  );

  // Search knowledge entries
  fastify.get(
    "/api/knowledge/search",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { query } = req.query as { query?: string };

        console.log("[KnowledgeRoutes] Searching:", query);

        const entries = await prisma.knowledgeEntry.findMany({
          where: {
            userId,
            OR: [
              { title: { contains: query || "" } },
              { content: { contains: query || "" } }
            ]
          },
          orderBy: { accessCount: "desc" }
        });

        const mappedEntries = entries.map(e => ({
          id: e.id,
          userId: e.userId,
          title: e.title,
          content: e.content,
          category: e.category || "general",
          tags: e.tags ? JSON.parse(e.tags) : [],
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
          lastAccessed: e.updatedAt
        }));

        return res.send({
          success: true,
          data: { entries: mappedEntries }
        });
      } catch (error: any) {
        console.error("[KnowledgeRoutes] Error searching:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to search" }
        });
      }
    }
  );

  // Create knowledge entry
  fastify.post(
    "/api/knowledge",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { title, content, category, tags } = req.body as any;

        console.log("[KnowledgeRoutes] Creating entry:", { title, userId });

        const entry = await prisma.knowledgeEntry.create({
          data: {
            userId,
            title: title || `Note - ${new Date().toLocaleDateString()}`,
            content,
            category: category || "general",
            tags: tags ? JSON.stringify(tags) : "[]"
          }
        });

        console.log("[KnowledgeRoutes] Entry created:", entry.id);

        return res.send({
          success: true,
          data: {
            entry: {
              ...entry,
              tags: tags || [],
              lastAccessed: entry.updatedAt
            }
          }
        });
      } catch (error: any) {
        console.error("[KnowledgeRoutes] Error creating entry:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to create entry" }
        });
      }
    }
  );

  // Delete knowledge entry
  fastify.delete(
    "/api/knowledge/:id",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const { id } = req.params as { id: string };

        console.log("[KnowledgeRoutes] Deleting entry:", id);

        await prisma.knowledgeEntry.delete({ where: { id } });

        return res.send({
          success: true,
          data: { deleted: true }
        });
      } catch (error: any) {
        console.error("[KnowledgeRoutes] Error deleting entry:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to delete entry" }
        });
      }
    }
  );
}
