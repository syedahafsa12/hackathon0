import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { chatController } from "../controllers/chatController";
import { AuthenticatedRequest } from "../middleware/auth";

// Development user ID for unauthenticated requests
const DEV_USER_ID = "dev-user-001";

export default async function chatRoutes(fastify: FastifyInstance) {
  // Development mode middleware to inject userId
  const injectDevUserId = async (req: FastifyRequest) => {
    if (process.env.NODE_ENV !== "production") {
      (req as AuthenticatedRequest).userId = DEV_USER_ID;
    }
  };

  // Chat message endpoint
  fastify.post(
    "/api/chat/message",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      await chatController.sendMessage(req as AuthenticatedRequest, res);
    },
  );

  // Streaming chat endpoint (SSE)
  fastify.post(
    "/api/chat/stream",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      const { message } = req.body as { message: string };
      const userId = (req as AuthenticatedRequest).userId || DEV_USER_ID;

      // Set SSE headers
      res.raw.setHeader("Content-Type", "text/event-stream");
      res.raw.setHeader("Cache-Control", "no-cache");
      res.raw.setHeader("Connection", "keep-alive");
      res.raw.setHeader("Access-Control-Allow-Origin", "*");

      try {
        // Send initial "thinking" event
        res.raw.write(
          `data: ${JSON.stringify({ type: "thinking", content: "..." })}\n\n`,
        );

        // Get streaming response from controller
        await chatController.sendStreamingMessage(
          userId,
          message,
          (chunk: string) => {
            // Stream each chunk to client
            res.raw.write(
              `data: ${JSON.stringify({ type: "content", content: chunk })}\n\n`,
            );
          },
          (done: boolean) => {
            // Send completion event
            if (done) {
              res.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
              res.raw.end();
            }
          },
        );
      } catch (error) {
        console.error("[ChatRoutes] Streaming error:", error);
        res.raw.write(
          `data: ${JSON.stringify({ type: "error", content: "Failed to process message" })}\n\n`,
        );
        res.raw.end();
      }
    },
  );

  // Get chat history endpoint
  fastify.get(
    "/api/chat/history",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      await chatController.getChatHistory(req as AuthenticatedRequest, res);
    },
  );

  // Update message status endpoint
  fastify.post(
    "/api/chat/status",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      await chatController.updateMessageStatus(
        req as AuthenticatedRequest,
        res,
      );
    },
  );
}
