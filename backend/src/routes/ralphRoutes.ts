/**
 * Ralph Loop Executor API Routes
 */

import { FastifyInstance } from "fastify";
import { ralphLoopExecutor } from "../agents/ralphLoop";

interface ExecuteBody {
  prompt: string;
  maxIterations?: number;
}

export default async function ralphRoutes(fastify: FastifyInstance) {
  // Execute a multi-step task
  fastify.post<{ Body: ExecuteBody }>("/api/ralph/execute", async (request, reply) => {
    try {
      const userId = (request as any).userId || "dev-user-001";
      const { prompt, maxIterations } = request.body;

      if (!prompt) {
        reply.code(400);
        return {
          success: false,
          error: "Missing required field: prompt",
        };
      }

      // Check if this looks like a multi-step task
      if (!ralphLoopExecutor.isMultiStepTask(prompt)) {
        return {
          success: false,
          error: "This doesn't appear to be a multi-step task. Use regular execution instead.",
          hint: "Multi-step tasks typically include phrases like 'research and create', 'analyze and report', etc.",
        };
      }

      // Execute the task
      const result = await ralphLoopExecutor.executeWithPersistence(
        userId,
        prompt,
        maxIterations
      );

      return {
        success: result.success,
        taskId: result.taskId,
        iterations: result.iterations,
        status: result.finalStatus,
        output: result.output,
        error: result.error,
        filePath: result.filePath,
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  // Get status of a running task
  fastify.get<{ Params: { taskId: string } }>(
    "/api/ralph/status/:taskId",
    async (request, reply) => {
      try {
        const { taskId } = request.params;
        const status = await ralphLoopExecutor.getStatus(taskId);

        if (status) {
          return {
            success: true,
            status: {
              taskId: status.taskId,
              prompt: status.prompt,
              currentIteration: status.currentIteration,
              maxIterations: status.maxIterations,
              status: status.status,
              startedAt: status.startedAt,
              lastIterationAt: status.lastIterationAt,
              iterationCount: status.iterations.length,
            },
          };
        } else {
          reply.code(404);
          return {
            success: false,
            error: "Task not found",
          };
        }
      } catch (error) {
        reply.code(500);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  // Emergency stop for a running task
  fastify.post<{ Params: { taskId: string } }>(
    "/api/ralph/stop/:taskId",
    async (request, reply) => {
      try {
        const { taskId } = request.params;
        const stopped = await ralphLoopExecutor.stop(taskId);

        if (stopped) {
          return {
            success: true,
            message: `Task ${taskId} has been stopped`,
          };
        } else {
          reply.code(500);
          return {
            success: false,
            error: "Failed to stop task",
          };
        }
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
