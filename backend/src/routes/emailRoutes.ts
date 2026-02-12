import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import emailService from "../services/emailService";
import { AuthenticatedRequest } from "../middleware/auth";

const DEV_USER_ID = "dev-user-001";

export default async function emailRoutes(fastify: FastifyInstance) {
  // Development mode middleware
  const injectDevUserId = async (req: FastifyRequest) => {
    if (process.env.NODE_ENV !== "production") {
      (req as AuthenticatedRequest).userId = DEV_USER_ID;
    }
  };

  // Get email messages
  fastify.get(
    "/api/emails",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { importance, status, limit } = req.query as any;

        const emails = await emailService.getEmailMessagesByUserId(
          userId,
          importance,
          status,
          limit ? parseInt(limit) : 20,
        );

        return res.send({
          success: true,
          data: { emails },
        });
      } catch (error: any) {
        console.error("[EmailRoutes] Error fetching emails:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to fetch emails" },
        });
      }
    },
  );

  // Update email status
  fastify.patch(
    "/api/emails/:id/status",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { id } = req.params as { id: string };
        const { status } = req.body as { status: any };

        const email = await emailService.updateEmailMessageStatus(
          id,
          userId,
          status,
        );

        return res.send({
          success: true,
          data: { email },
        });
      } catch (error: any) {
        console.error("[EmailRoutes] Error updating email status:", error);
        return res.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to update email status",
          },
        });
      }
    },
  );

  // Generate draft reply
  fastify.post(
    "/api/emails/:id/draft",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { id } = req.params as { id: string };

        const email = await emailService.generateDraftReply(id, userId);

        return res.send({
          success: true,
          data: { email },
        });
      } catch (error: any) {
        console.error("[EmailRoutes] Error generating draft:", error);
        return res.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to generate draft",
          },
        });
      }
    },
  );
}
