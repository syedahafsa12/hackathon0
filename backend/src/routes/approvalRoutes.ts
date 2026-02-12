import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import approvalService from "../services/approval/approvalService";
import { AuthenticatedRequest } from "../middleware/auth";

// Development user ID for unauthenticated requests
const DEV_USER_ID = "dev-user-001";

export default async function approvalRoutes(fastify: FastifyInstance) {
  // Development mode middleware to inject userId
  const injectDevUserId = async (req: FastifyRequest) => {
    if (process.env.NODE_ENV !== "production") {
      (req as AuthenticatedRequest).userId = DEV_USER_ID;
    }
  };

  // Create a new approval (for Ralph Loop and other direct requests)
  fastify.post(
    "/api/approvals",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const body = req.body as {
          actionType: string;
          actionData: any;
        };

        console.log(`[ApprovalRoutes] POST /api/approvals`);
        console.log(`[ApprovalRoutes] actionType: ${body.actionType}`);
        console.log(`[ApprovalRoutes] actionData:`, body.actionData);

        if (!body.actionType) {
          return res.status(400).send({
            success: false,
            error: { code: "BAD_REQUEST", message: "Missing actionType" },
          });
        }

        const approval = await approvalService.createApproval(userId, {
          actionType: body.actionType,
          actionData: body.actionData || {},
        });

        console.log(`[ApprovalRoutes] Approval created: ${approval.id}`);

        return res.send({
          success: true,
          data: approval,
        });
      } catch (error: any) {
        console.error("[ApprovalRoutes] Error creating approval:", error);
        return res.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: error.message || "Failed to create approval",
          },
        });
      }
    },
  );

  // Get pending approvals
  fastify.get(
    "/api/approvals/pending",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const approvals = await approvalService.getPendingApprovals(userId);
        return res.send({
          success: true,
          data: { approvals },
        });
      } catch (error: any) {
        console.error("Error getting pending approvals:", error);
        return res.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to get pending approvals",
          },
        });
      }
    },
  );

  // Get approval by ID
  fastify.get(
    "/api/approvals/:id",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { id } = req.params as { id: string };
        const approval = await approvalService.getApprovalById(id, userId);

        if (!approval) {
          return res.status(404).send({
            success: false,
            error: { code: "NOT_FOUND", message: "Approval not found" },
          });
        }

        return res.send({
          success: true,
          data: { approval },
        });
      } catch (error: any) {
        console.error("Error getting approval:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to get approval" },
        });
      }
    },
  );

  // Approve an action - POST /api/approvals/:id/approve
  fastify.post(
    "/api/approvals/:id/approve",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { id } = req.params as { id: string };

        console.log(`[ApprovalRoutes] POST /api/approvals/${id}/approve`);
        console.log(`[ApprovalRoutes] req.params:`, req.params);
        console.log(`[ApprovalRoutes] req.body:`, req.body);
        console.log(`[ApprovalRoutes] userId: ${userId}`);

        if (!id) {
          return res.status(400).send({
            success: false,
            error: { code: "BAD_REQUEST", message: "Missing approval ID" },
          });
        }

        console.log(
          `[ApprovalRoutes] Calling approveAction with id=${id}, userId=${userId}`,
        );
        const approval = await approvalService.approveAction(id, userId);

        console.log(`[ApprovalRoutes] Approval ${id} approved successfully`);

        // CRITICAL FIX: Trigger execution immediately via orchestrator
        console.log(`[ApprovalRoutes] Triggering execution via orchestrator`);
        const { default: orchestrator } = await import("../core/orchestrator");
        const executionResult = await orchestrator.executeApproval(approval);

        console.log(`[ApprovalRoutes] Execution complete:`, executionResult);

        return res.send({
          success: true,
          data: {
            approval,
            execution: executionResult,
          },
        });
      } catch (error: any) {
        console.error("[ApprovalRoutes] Error approving action:", error);
        return res.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: error.message || "Failed to approve action",
          },
        });
      }
    },
  );

  // Reject an action - POST /api/approvals/:id/reject
  fastify.post(
    "/api/approvals/:id/reject",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { id } = req.params as { id: string };
        const body = req.body as { reason?: string } | null;
        const reason = body?.reason;

        console.log(`[ApprovalRoutes] POST /api/approvals/${id}/reject`);
        console.log(`[ApprovalRoutes] req.params:`, req.params);
        console.log(`[ApprovalRoutes] req.body:`, req.body);
        console.log(`[ApprovalRoutes] userId: ${userId}, reason: ${reason}`);

        if (!id) {
          return res.status(400).send({
            success: false,
            error: { code: "BAD_REQUEST", message: "Missing approval ID" },
          });
        }

        console.log(
          `[ApprovalRoutes] Calling rejectAction with id=${id}, userId=${userId}`,
        );
        const approval = await approvalService.rejectAction(
          id,
          userId,
          undefined,
          reason,
        );

        console.log(`[ApprovalRoutes] Approval ${id} rejected successfully`);

        return res.send({
          success: true,
          data: { approval },
        });
      } catch (error: any) {
        console.error("[ApprovalRoutes] Error rejecting action:", error);
        return res.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: error.message || "Failed to reject action",
          },
        });
      }
    },
  );

  // PATCH /api/approvals/:id - Unified status update endpoint
  fastify.patch(
    "/api/approvals/:id",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { id } = req.params as { id: string };
        const body = req.body as { status?: string; reason?: string } | null;

        console.log(`[ApprovalRoutes] PATCH /api/approvals/${id}`);
        console.log(`[ApprovalRoutes] req.params:`, req.params);
        console.log(`[ApprovalRoutes] req.body:`, body);

        if (!id) {
          return res.status(400).send({
            success: false,
            error: { code: "BAD_REQUEST", message: "Missing approval ID" },
          });
        }

        const status = body?.status;
        if (!status || !["approved", "rejected"].includes(status)) {
          return res.status(400).send({
            success: false,
            error: {
              code: "BAD_REQUEST",
              message: "Invalid status. Must be 'approved' or 'rejected'",
            },
          });
        }

        let approval;
        if (status === "approved") {
          approval = await approvalService.approveAction(id, userId);
        } else {
          approval = await approvalService.rejectAction(
            id,
            userId,
            undefined,
            body?.reason,
          );
        }

        console.log(`[ApprovalRoutes] Approval ${id} updated to ${status}`);

        return res.send({
          success: true,
          data: { approval },
        });
      } catch (error: any) {
        console.error("[ApprovalRoutes] Error updating approval:", error);
        return res.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: error.message || "Failed to update approval",
          },
        });
      }
    },
  );

  // Get approval history
  fastify.get(
    "/api/approvals/history",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { actionType, limit } = req.query as {
          actionType?: string;
          limit?: string;
        };
        const limitNum = limit ? parseInt(limit) : 50;
        const approvals = await approvalService.getApprovalHistory(
          userId,
          actionType,
          limitNum,
        );

        return res.send({
          success: true,
          data: { approvals },
        });
      } catch (error: any) {
        console.error("Error getting approval history:", error);
        return res.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to get approval history",
          },
        });
      }
    },
  );
}
