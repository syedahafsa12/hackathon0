/**
 * News Agent V2 API Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { newsAgentV2 } from "../agents/news";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const DEV_USER_ID = "dev-user-001";

interface SearchQuery {
  q: string;
  category?: "tech" | "ai" | "world";
  date?: string;
}

interface FetchBody {
  forceRefresh?: boolean;
}

export default async function newsRoutesV2(fastify: FastifyInstance) {
  const injectDevUserId = async (req: FastifyRequest) => {
    if (process.env.NODE_ENV !== "production") {
      (req as AuthenticatedRequest).userId = DEV_USER_ID;
    }
  };

  /**
   * Standard News Endpoint (GET /api/news)
   * Returns top headlines summarized for the frontend
   */
  fastify.get(
    "/api/news",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const result = await newsAgentV2.fetchTodaysNews(userId);

        if (result.success && result.digest) {
          return res.send({
            success: true,
            data: {
              news: [
                ...(result.digest.tech || []),
                ...(result.digest.ai || []),
                ...(result.digest.world || []),
              ].map((n: any, idx) => ({
                id: `news-${idx}`,
                source: n.source || "NewsAgent",
                content: n.title || n.summary,
                url: n.url,
                category: n.category,
                publishedAt: n.publishedAt || new Date(),
              })),
            },
          });
        }

        return res.status(500).send({
          success: false,
          error: result.error || "Failed to fetch news",
        });
      } catch (error: any) {
        console.error("[NewsRoutesV2] Error in /api/news:", error);
        return res.status(500).send({
          success: false,
          error: "Internal server error fetching news",
        });
      }
    },
  );

  /**
   * Today's News Agent Digest (GET /api/news/today)
   * Returns the full categorized digest
   */
  fastify.get(
    "/api/news/today",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const result = await newsAgentV2.fetchTodaysNews(userId);

        if (result.success) {
          return res.send({
            success: true,
            fromCache: result.fromCache,
            digest: result.digest,
            data: {
              categories: {
                Tech: result.digest?.tech || [],
                AI: result.digest?.ai || [],
                "World-Impacting": result.digest?.world || [],
              },
              fetchedAt: result.digest?.fetchedAt || new Date().toISOString(),
              totalArticles:
                (result.digest?.tech?.length || 0) +
                (result.digest?.ai?.length || 0) +
                (result.digest?.world?.length || 0),
            },
          });
        } else {
          return res.status(500).send({
            success: false,
            error: result.error,
          });
        }
      } catch (error: any) {
        console.error("[NewsRoutesV2] Error in /api/news/today:", error);
        return res.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  /**
   * Fetch/Force Refresh News (POST /api/news/fetch)
   */
  fastify.post<{ Body: FetchBody | null }>(
    "/api/news/fetch",
    { preHandler: injectDevUserId },
    async (request, reply) => {
      try {
        const userId = (request as any).userId || DEV_USER_ID;
        const forceRefresh = request.body?.forceRefresh ?? false;

        if (forceRefresh) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          await prisma.newsCache.deleteMany({
            where: { userId, date: today },
          });
        }

        const result = await newsAgentV2.fetchTodaysNews(userId);

        if (result.success) {
          return {
            success: true,
            fromCache: result.fromCache,
            digest: result.digest,
            data: {
              categories: {
                Tech: result.digest?.tech || [],
                AI: result.digest?.ai || [],
                "World-Impacting": result.digest?.world || [],
              },
              fetchedAt: result.digest?.fetchedAt || new Date().toISOString(),
              totalArticles:
                (result.digest?.tech?.length || 0) +
                (result.digest?.ai?.length || 0) +
                (result.digest?.world?.length || 0),
            },
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
    },
  );

  /**
   * Search past news digests
   */
  fastify.get<{ Querystring: SearchQuery }>(
    "/api/news/search",
    { preHandler: injectDevUserId },
    async (request, reply) => {
      try {
        const userId = (request as any).userId || DEV_USER_ID;
        const { q, category, date } = request.query;

        if (!q) {
          reply.code(400);
          return {
            success: false,
            error: "Missing required query parameter: q",
          };
        }

        const dateObj = date ? new Date(date) : undefined;
        const results = await newsAgentV2.searchNews(
          userId,
          q,
          category,
          dateObj,
        );

        return {
          success: true,
          query: q,
          category,
          date,
          resultCount: results.length,
          results,
        };
      } catch (error) {
        reply.code(500);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );
}
