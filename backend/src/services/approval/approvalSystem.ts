import { PrismaClient } from '@prisma/client';
import approvalService from './approvalService';
import { WebSocketService } from '../websocket';
import emailAgent from '../agents/emailAgent';
import calendarAgent from '../agents/calendarAgent';
import linkedinAgent from '../agents/linkedinAgent';
import taskAgent from '../agents/taskAgent';
import knowledgeAgent from '../agents/knowledgeAgent';

const prisma = new PrismaClient();
const websocketService = WebSocketService.getInstance();

export class ApprovalSystem {
  /**
   * Checks if an action requires approval and handles the approval flow
   */
  async processActionWithApproval(userId: string, actionType: string, actionData: any) {
    try {
      // Create an approval request
      const approval = await approvalService.createApproval(userId, {
        actionType,
        actionData
      });

      // Notify the user via WebSocket about the pending approval
      await websocketService.emitToRoom(
        `user_${userId}`,
        'approval_request',
        {
          message: `Action requires your approval: ${actionType}`,
          approval: approval
        }
      );

      return {
        requiresApproval: true,
        approval,
        message: `Approval requested for ${actionType}. Please review and approve.`
      };
    } catch (error) {
      console.error('Error processing action with approval:', error);
      throw error;
    }
  }

  /**
   * Executes an action after approval has been granted
   */
  async executeApprovedAction(approval: any) {
    try {
      switch (approval.actionType) {
        case 'email_send':
          return await this.executeEmailSend(approval);
        case 'calendar_create':
          return await this.executeCalendarCreate(approval);
        case 'linkedin_post':
          return await this.executeLinkedInPost(approval);
        case 'task_create':
          return await this.executeTaskCreate(approval);
        case 'knowledge_save':
          return await this.executeKnowledgeSave(approval);
        default:
          throw new Error(`Unknown action type: ${approval.actionType}`);
      }
    } catch (error) {
      console.error('Error executing approved action:', error);
      throw error;
    }
  }

  private async executeEmailSend(approval: any) {
    // Execute the email sending through the email agent
    const result = await emailAgent.sendEmail(approval.userId, approval.actionData);
    return result;
  }

  private async executeCalendarCreate(approval: any) {
    // Execute the calendar event creation through the calendar agent
    const result = await calendarAgent.processCalendarCommand(approval.userId, approval.actionData);
    return result;
  }

  private async executeLinkedInPost(approval: any) {
    // Execute the LinkedIn post through the LinkedIn agent
    const result = await linkedinAgent.publishPostWithApproval(approval.userId, approval.actionData.postId);
    return result;
  }

  private async executeTaskCreate(approval: any) {
    // Execute the task creation through the task agent
    const result = await taskAgent.createTaskFromText(approval.userId, approval.actionData.title);
    return result;
  }

  private async executeKnowledgeSave(approval: any) {
    // Execute the knowledge saving through the knowledge agent
    const result = await knowledgeAgent.processKnowledgeCommand(approval.userId, approval.actionData.command);
    return result;
  }

  /**
   * Handles the approval response (approve/reject)
   */
  async handleApprovalResponse(userId: string, approvalId: string, action: 'approve' | 'reject', reason?: string) {
    try {
      if (action === 'approve') {
        // Update approval status to approved
        const updatedApproval = await approvalService.approveAction(approvalId, userId);

        // Execute the approved action
        const result = await this.executeApprovedAction(updatedApproval);

        return {
          success: true,
          message: 'Action approved and executed successfully',
          result,
          approval: updatedApproval
        };
      } else {
        // Update approval status to rejected
        const updatedApproval = await approvalService.rejectAction(approvalId, userId, undefined, reason);

        return {
          success: true,
          message: 'Action rejected',
          approval: updatedApproval
        };
      }
    } catch (error) {
      console.error('Error handling approval response:', error);
      throw error;
    }
  }

  /**
   * Gets all pending approvals for a user
   */
  async getPendingApprovals(userId: string) {
    try {
      const approvals = await approvalService.getPendingApprovals(userId);
      return {
        success: true,
        approvals,
        count: approvals.length
      };
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      throw error;
    }
  }
}

export default new ApprovalSystem();