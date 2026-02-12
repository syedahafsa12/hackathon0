import { PrismaClient } from "@prisma/client";
import approvalService from "../approval/approvalService";
import websocketService from "../websocket";
import emailService from "../emailService";
import calendarService from "../calendarService";
import linkedinAgent from "./linkedinAgent";
import taskService from "../taskService";
import knowledgeService from "../knowledge/knowledgeService";

const prisma = new PrismaClient();

export class ApprovalAgent {
  async processApprovalRequest(
    userId: string,
    actionType: string,
    actionData: any,
  ) {
    try {
      // Create a new approval request
      const approval = await approvalService.createApproval(userId, {
        actionType,
        actionData,
      });

      // Notify the user via WebSocket about the pending approval
      await websocketService.emitToRoom(`user_${userId}`, "approval_request", {
        message: `Action requires your approval: ${actionType}`,
        approval: approval,
      });

      return {
        success: true,
        message: `Approval requested for ${actionType}. Please review and approve.`,
        approval,
      };
    } catch (error) {
      console.error("Error processing approval request:", error);
      throw error;
    }
  }

  async handleApprovalResponse(
    userId: string,
    approvalId: string,
    action: "approve" | "reject",
    reason?: string,
  ) {
    try {
      if (action === "approve") {
        // Approve the action
        const approval = await approvalService.approveAction(
          approvalId,
          userId,
        );

        // Execute the approved action based on its type
        await this.executeApprovedAction(approval);

        return {
          success: true,
          message: "Action approved and executed successfully",
          approval,
        };
      } else {
        // Reject the action
        const approval = await approvalService.rejectAction(
          approvalId,
          userId,
          undefined,
          reason,
        );

        return {
          success: true,
          message: "Action rejected",
          approval,
        };
      }
    } catch (error) {
      console.error("Error handling approval response:", error);
      throw error;
    }
  }

  async executeApprovedAction(approval: any) {
    try {
      // Based on the action type, execute the appropriate service
      switch (approval.actionType) {
        case "email_send":
          await this.executeEmailSend(approval.actionData);
          break;
        case "calendar_create":
          await this.executeCalendarCreate(approval.actionData);
          break;
        case "linkedin_post":
          await this.executeLinkedInPost(approval.actionData);
          break;
        case "task_create":
          await this.executeTaskCreate(approval.actionData);
          break;
        case "knowledge_save":
          await this.executeKnowledgeSave(approval.actionData);
          break;
        default:
          console.warn(`Unknown action type: ${approval.actionType}`);
          break;
      }
    } catch (error) {
      console.error("Error executing approved action:", error);
      throw error;
    }
  }

  private async executeEmailSend(actionData: any) {
    try {
      // In a real implementation, this would send the email via email service
      console.log("Executing email send:", actionData);
      // For now, we'll just log the action
    } catch (error) {
      console.error("Error executing email send:", error);
      throw error;
    }
  }

  private async executeCalendarCreate(actionData: any) {
    try {
      // In a real implementation, this would create the calendar event
      console.log("Executing calendar creation:", actionData);
      // For now, we'll just log the action
    } catch (error) {
      console.error("Error executing calendar creation:", error);
      throw error;
    }
  }

  private async executeLinkedInPost(actionData: any) {
    try {
      // In a real implementation, this would post to LinkedIn
      console.log("Executing LinkedIn post:", actionData);
      // For now, we'll just log the action
    } catch (error) {
      console.error("Error executing LinkedIn post:", error);
      throw error;
    }
  }

  private async executeTaskCreate(actionData: any) {
    try {
      // In a real implementation, this would create the task
      console.log("Executing task creation:", actionData);
      // For now, we'll just log the action
    } catch (error) {
      console.error("Error executing task creation:", error);
      throw error;
    }
  }

  private async executeKnowledgeSave(actionData: any) {
    try {
      // In a real implementation, this would save the knowledge entry
      console.log("Executing knowledge save:", actionData);
      // For now, we'll just log the action
    } catch (error) {
      console.error("Error executing knowledge save:", error);
      throw error;
    }
  }

  async getPendingApprovals(userId: string) {
    try {
      const approvals = await approvalService.getPendingApprovals(userId);

      return {
        success: true,
        message: `Found ${approvals.length} pending approvals`,
        approvals,
      };
    } catch (error) {
      console.error("Error getting pending approvals:", error);
      throw error;
    }
  }

  async processApprovalCommand(userId: string, command: string) {
    try {
      // Parse the command to determine intent
      const intent = this.identifyIntent(command);

      switch (intent) {
        case "view_pending":
          return await this.handleViewPending(userId);
        case "approve_action":
          return await this.handleApproveAction(userId, command);
        case "reject_action":
          return await this.handleRejectAction(userId, command);
        default:
          return {
            success: false,
            message:
              'Unable to understand the approval command. Try phrases like "show me pending approvals" or "approve the email draft"',
          };
      }
    } catch (error) {
      console.error("Error processing approval command:", error);
      throw error;
    }
  }

  private identifyIntent(command: string): string {
    const lowerCommand = command.toLowerCase();

    if (
      lowerCommand.includes("show") ||
      lowerCommand.includes("view") ||
      lowerCommand.includes("pending") ||
      lowerCommand.includes("approval")
    ) {
      return "view_pending";
    } else if (
      lowerCommand.includes("approve") ||
      lowerCommand.includes("yes") ||
      lowerCommand.includes("confirm")
    ) {
      return "approve_action";
    } else if (
      lowerCommand.includes("reject") ||
      lowerCommand.includes("deny") ||
      lowerCommand.includes("no")
    ) {
      return "reject_action";
    } else {
      return "view_pending"; // Default to viewing pending approvals
    }
  }

  private async handleViewPending(userId: string) {
    return await this.getPendingApprovals(userId);
  }

  private async handleApproveAction(userId: string, command: string) {
    // This is a simplified implementation
    // In reality, you'd need to identify which specific approval to approve

    // For now, we'll get the first pending approval
    const pendingApprovals = await approvalService.getPendingApprovals(userId);

    if (pendingApprovals.length === 0) {
      return {
        success: false,
        message: "No pending approvals to approve",
      };
    }

    // Approve the first pending approval
    const approval = await approvalService.approveAction(
      pendingApprovals[0].id,
      userId,
    );

    return {
      success: true,
      message: `Approved: ${approval.actionType}`,
      approval,
    };
  }

  private async handleRejectAction(userId: string, command: string) {
    // This is a simplified implementation
    // In reality, you'd need to identify which specific approval to reject

    // For now, we'll get the first pending approval
    const pendingApprovals = await approvalService.getPendingApprovals(userId);

    if (pendingApprovals.length === 0) {
      return {
        success: false,
        message: "No pending approvals to reject",
      };
    }

    // Reject the first pending approval
    const approval = await approvalService.rejectAction(
      pendingApprovals[0].id,
      userId,
    );

    return {
      success: true,
      message: `Rejected: ${approval.actionType}`,
      approval,
    };
  }
}

export default new ApprovalAgent();
