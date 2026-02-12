import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../middleware/auth';
import approvalService from '../services/approval/approvalService';
import approvalAgent from '../services/agents/approvalAgent';

export class ApprovalController {
  async createApproval(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { actionType, actionData } = req.body as {
        actionType: string;
        actionData: any;
      };

      const userId = req.userId;

      if (!actionType || !actionData) {
        return res.status(400).send({
          success: false,
          error: { code: 'MISSING_REQUIRED_FIELDS', message: 'actionType and actionData are required' }
        });
      }

      const result = await approvalAgent.processApprovalRequest(userId, actionType, actionData);

      return res.status(201).send(result);
    } catch (error) {
      console.error('Error creating approval:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create approval request' }
      });
    }
  }

  async getPendingApprovals(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const userId = req.userId;

      const result = await approvalService.getPendingApprovals(userId);

      return res.send({
        success: true,
        data: { approvals: result }
      });
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get pending approvals' }
      });
    }
  }

  async getApproval(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const userId = req.userId;

      const approval = await approvalService.getApprovalById(id, userId);

      if (!approval) {
        return res.status(404).send({
          success: false,
          error: { code: 'APPROVAL_NOT_FOUND', message: 'Approval not found' }
        });
      }

      return res.send({
        success: true,
        data: approval
      });
    } catch (error) {
      console.error('Error getting approval:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get approval' }
      });
    }
  }

  async approveAction(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const { reason } = req.body as { reason?: string };
      const userId = req.userId;

      const result = await approvalAgent.handleApprovalResponse(userId, id, 'approve', reason);

      return res.send(result);
    } catch (error) {
      console.error('Error approving action:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to approve action' }
      });
    }
  }

  async rejectAction(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const { reason } = req.body as { reason?: string };
      const userId = req.userId;

      const result = await approvalAgent.handleApprovalResponse(userId, id, 'reject', reason);

      return res.send(result);
    } catch (error) {
      console.error('Error rejecting action:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to reject action' }
      });
    }
  }

  async getApprovalHistory(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { status, actionType, limit } = req.query as {
        status?: 'pending' | 'approved' | 'rejected';
        actionType?: string;
        limit?: string;
      };

      const userId = req.userId;
      const limitNum = limit ? parseInt(limit) : 50;

      if (status) {
        const result = await approvalService.getApprovalsByUserAndStatus(userId, status, limitNum);
        return res.send({
          success: true,
          data: { approvals: result }
        });
      } else {
        const result = await approvalService.getApprovalHistory(userId, actionType, limitNum);
        return res.send({
          success: true,
          data: { approvals: result }
        });
      }
    } catch (error) {
      console.error('Error getting approval history:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get approval history' }
      });
    }
  }

  async processApprovalCommand(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { command } = req.body as { command: string };
      const userId = req.userId;

      if (!command) {
        return res.status(400).send({
          success: false,
          error: { code: 'MISSING_COMMAND', message: 'Approval command is required' }
        });
      }

      const result = await approvalAgent.processApprovalCommand(userId, command);

      return res.send(result);
    } catch (error) {
      console.error('Error processing approval command:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process approval command' }
      });
    }
  }
}

export default new ApprovalController();