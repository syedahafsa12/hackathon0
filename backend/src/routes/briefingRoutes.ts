/**
 * CEO Briefing Agent API Routes
 */

import { FastifyInstance } from "fastify";
import { ceoBriefingAgent } from "../agents/ceoBriefing";

export default async function briefingRoutes(fastify: FastifyInstance) {
  // Generate CEO briefing (manual trigger for testing)
  fastify.post("/api/briefing/generate", async (request, reply) => {
    try {
      const userId = (request as any).userId || "dev-user-001";
      const result = await ceoBriefingAgent.generateBriefing(userId);

      if (result.success && result.briefing) {
        return {
          success: true,
          message: "CEO briefing generated successfully",
          briefing: {
            weekStart: result.briefing.weekStart,
            weekEnd: result.briefing.weekEnd,
            filePath: result.briefing.filePath,
            highlights: result.briefing.highlights,
            metrics: {
              taskCompletionRate: result.briefing.metrics.taskCompletion.rate,
              meetingHours: result.briefing.metrics.calendar.meetingHours,
              deepWorkHours: result.briefing.metrics.calendar.deepWorkHours,
            },
            bottleneckCount: result.briefing.bottlenecks.length,
            suggestionCount: result.briefing.suggestions.length,
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
  });

  // Get latest briefing
  fastify.get("/api/briefing/latest", async (request, reply) => {
    try {
      const userId = (request as any).userId || "dev-user-001";
      const briefing = await ceoBriefingAgent.getLatestBriefing(userId);

      if (briefing) {
        return {
          success: true,
          briefing,
        };
      } else {
        return {
          success: true,
          briefing: null,
          message: "No briefings found. Use POST /api/briefing/generate to create one.",
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

  // Get briefing history
  fastify.get<{ Querystring: { limit?: string } }>(
    "/api/briefing/history",
    async (request, reply) => {
      try {
        const userId = (request as any).userId || "dev-user-001";
        const limit = parseInt(request.query.limit || "10");
        const history = await ceoBriefingAgent.getBriefingHistory(userId, limit);

        return {
          success: true,
          count: history.length,
          briefings: history,
        };
      } catch (error) {
        reply.code(500);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );
}
