import { PrismaClient, Approval as PrismaApproval } from "@prisma/client";
import { Approval } from "../../../../shared/types";
import * as crypto from "crypto";
import { handbookService } from "../handbookService";

console.log("[ApprovalService] Loaded");

// Generate UUID using Node.js crypto
const uuidv4 = (): string => crypto.randomUUID();

const prisma = new PrismaClient();

export class ApprovalService {
  async createApproval(
    userId: string,
    approvalData: {
      actionType: string;
      actionData: any;
      requesterId?: string;
    },
  ): Promise<Approval> {
    try {
      console.log("[ApprovalService] createApproval called");
      console.log("[ApprovalService] Writing approval to DB");

      // Serialize actionData to JSON string (Prisma schema expects String)
      const actionDataStr = JSON.stringify(approvalData.actionData);
      console.log("[ApprovalService] actionData serialized:", actionDataStr);

      // Check auto-approval rules from handbook
      const shouldAutoApprove = handbookService.isAutoApprovable({
        type: approvalData.actionType,
        durationEstimate: approvalData.actionData?.durationEstimate, // Backend should provide this if possible
      });

      const approval = await prisma.approval.create({
        data: {
          id: uuidv4(),
          userId,
          actionType: approvalData.actionType,
          actionData: actionDataStr,
          status: shouldAutoApprove ? "approved" : "pending",
          requestedAt: new Date(),
          respondedAt: shouldAutoApprove ? new Date() : null,
          responderId: shouldAutoApprove
            ? "system"
            : approvalData.requesterId || userId,
        },
      });

      console.log(
        "[ApprovalService] Prisma create() returned:",
        JSON.stringify(approval),
      );

      console.log("[ApprovalService] Approval created:", approval.id);
      console.log("[ApprovalService] Approval persisted");

      return this.mapPrismaToApproval(approval);
    } catch (error) {
      console.error("Error creating approval:", error);
      throw error;
    }
  }

  async getPendingApprovals(userId: string): Promise<Approval[]> {
    try {
      const approvals = await prisma.approval.findMany({
        where: {
          userId,
          status: "pending",
        },
        orderBy: { requestedAt: "desc" },
      });

      return approvals.map(this.mapPrismaToApproval);
    } catch (error) {
      console.error("Error getting pending approvals:", error);
      throw error;
    }
  }

  async getApprovalById(id: string, userId: string): Promise<Approval | null> {
    try {
      const approval = await prisma.approval.findUnique({
        where: { id },
      });

      if (!approval || approval.userId !== userId) {
        return null;
      }

      return this.mapPrismaToApproval(approval);
    } catch (error) {
      console.error("Error getting approval by id:", error);
      throw error;
    }
  }

  async approveAction(
    id: string,
    userId: string,
    approverId?: string,
  ): Promise<Approval> {
    try {
      const approval = await prisma.approval.findUnique({
        where: { id },
      });

      if (!approval || approval.userId !== userId) {
        throw new Error("Approval not found or unauthorized");
      }

      const updatedApproval = await prisma.approval.update({
        where: { id },
        data: {
          status: "approved",
          respondedAt: new Date(),
          responderId: approverId || userId,
        },
      });

      return this.mapPrismaToApproval(updatedApproval);
    } catch (error) {
      console.error("Error approving action:", error);
      throw error;
    }
  }

  async rejectAction(
    id: string,
    userId: string,
    approverId?: string,
    reason?: string,
  ): Promise<Approval> {
    try {
      const approval = await prisma.approval.findUnique({
        where: { id },
      });

      if (!approval || approval.userId !== userId) {
        throw new Error("Approval not found or unauthorized");
      }

      const updatedApproval = await prisma.approval.update({
        where: { id },
        data: {
          status: "rejected",
          respondedAt: new Date(),
          responderId: approverId || userId,
          rejectionReason: reason || null,
        },
      });

      return this.mapPrismaToApproval(updatedApproval);
    } catch (error) {
      console.error("Error rejecting action:", error);
      throw error;
    }
  }

  async updateApprovalStatus(
    id: string,
    userId: string,
    status: "pending" | "approved" | "rejected",
    approverId?: string,
    reason?: string,
  ): Promise<Approval> {
    try {
      const approval = await prisma.approval.findUnique({
        where: { id },
      });

      if (!approval || approval.userId !== userId) {
        throw new Error("Approval not found or unauthorized");
      }

      const updateData: any = {
        status,
        respondedAt: new Date(),
      };

      if (approverId) {
        updateData.responderId = approverId;
      }

      if (reason && status === "rejected") {
        updateData.rejectionReason = reason;
      }

      const updatedApproval = await prisma.approval.update({
        where: { id },
        data: updateData,
      });

      return this.mapPrismaToApproval(updatedApproval);
    } catch (error) {
      console.error("Error updating approval status:", error);
      throw error;
    }
  }

  async getApprovalsByUserAndStatus(
    userId: string,
    status: "pending" | "approved" | "rejected",
    limit: number = 50,
  ): Promise<Approval[]> {
    try {
      const approvals = await prisma.approval.findMany({
        where: {
          userId,
          status,
        },
        orderBy: { requestedAt: "desc" },
        take: limit,
      });

      return approvals.map(this.mapPrismaToApproval);
    } catch (error) {
      console.error("Error getting approvals by status:", error);
      throw error;
    }
  }

  async getApprovalHistory(
    userId: string,
    actionType?: string,
    limit: number = 50,
  ): Promise<Approval[]> {
    try {
      const whereClause: any = { userId };

      if (actionType) {
        whereClause.actionType = actionType;
      }

      const approvals = await prisma.approval.findMany({
        where: whereClause,
        orderBy: { requestedAt: "desc" },
        take: limit,
      });

      return approvals.map(this.mapPrismaToApproval);
    } catch (error) {
      console.error("Error getting approval history:", error);
      throw error;
    }
  }

  private mapPrismaToApproval(prismaApproval: PrismaApproval): Approval {
    // Parse actionData from JSON string back to object
    let actionData: any;
    try {
      actionData =
        typeof prismaApproval.actionData === "string"
          ? JSON.parse(prismaApproval.actionData)
          : prismaApproval.actionData;
    } catch (e) {
      console.error("[ApprovalService] Failed to parse actionData:", e);
      actionData = prismaApproval.actionData;
    }

    return {
      id: prismaApproval.id,
      userId: prismaApproval.userId,
      actionType: prismaApproval.actionType,
      actionData,
      status: prismaApproval.status as "pending" | "approved" | "rejected",
      requestedAt: prismaApproval.requestedAt,
      respondedAt: prismaApproval.respondedAt || undefined,
      responderId: prismaApproval.responderId || undefined,
      rejectionReason: prismaApproval.rejectionReason || undefined,
    };
  }
}

export default new ApprovalService();
