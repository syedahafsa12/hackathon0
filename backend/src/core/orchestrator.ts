/**
 * Central Orchestrator for Mini Hafsa
 * Implements the autonomous loop pattern from Hackathon Zero
 *
 * Responsibilities:
 * - Monitor approved actions
 * - Dispatch to appropriate Watchers
 * - Handle execution results
 * - Update approval status
 */

import { PrismaClient } from "@prisma/client";
import { Approval } from "../../../shared/types";
import { BaseWatcher } from "./watchers/BaseWatcher";
import { ExecutionResult } from "./actionTypes";
import { StructuredLogger } from "./logging/structuredLogger";

const prisma = new PrismaClient();

export class Orchestrator {
  private watchers: Map<string, BaseWatcher> = new Map();
  private logger: StructuredLogger;
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 2000; // 2 seconds
  private readonly MAX_APPROVALS_PER_CYCLE = 10;

  constructor() {
    this.logger = new StructuredLogger("orchestrator");
  }

  /**
   * Register a Watcher with the orchestrator
   */
  registerWatcher(watcher: BaseWatcher): void {
    this.watchers.set(watcher.getName(), watcher);
    this.logger.info("watcher:registered", {
      data: { watcherName: watcher.getName() },
    });
  }

  /**
   * Start the orchestration loop
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("start:already_running", {});
      return;
    }

    this.logger.info("start", {});
    this.isRunning = true;

    // Start polling loop
    this.pollInterval = setInterval(async () => {
      await this.processApprovedActions();
    }, this.POLL_INTERVAL_MS);
  }

  /**
   * Stop the orchestration loop
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info("stop", {});
    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Process all approved actions (main loop logic)
   */
  private async processApprovedActions(): Promise<void> {
    try {
      // Find approvals that are approved but not yet executed
      // Allow retry of failed approvals (requires re-approval)
      const approvals = await prisma.approval.findMany({
        where: {
          status: "approved",
          OR: [{ executionStatus: null }, { executionStatus: "failed" }],
        },
        take: this.MAX_APPROVALS_PER_CYCLE,
        orderBy: {
          respondedAt: "asc", // Process oldest first
        },
      });

      if (approvals.length === 0) {
        return; // Nothing to process
      }

      this.logger.info("process:found_approvals", {
        data: { count: approvals.length },
      });

      // Process each approval
      for (const approval of approvals) {
        await this.executeApproval(this.mapPrismaToApproval(approval));
      }
    } catch (error) {
      this.logger.error("process:error", error as Error);
    }
  }

  /**
   * Execute a single approved action
   * This is the main execution entry point
   */
  async executeApproval(approval: Approval): Promise<ExecutionResult> {
    const timer = this.logger.startTimer();

    this.logger.info("execute:start", {
      approvalId: approval.id,
      userId: approval.userId,
      actionType: approval.actionType,
    });

    try {
      // IDEMPOTENCY CHECK: Prevent double execution
      const existingApproval = await prisma.approval.findUnique({
        where: { id: approval.id },
        select: {
          executionStatus: true,
          executedAt: true,
          executionData: true,
        },
      });

      // Log idempotency check
      this.logger.info("execute:idempotency_check", {
        approvalId: approval.id,
        executionStatus: existingApproval?.executionStatus,
      });

      if (existingApproval?.executionStatus === "success") {
        this.logger.info("execute:already_completed", {
          approvalId: approval.id,
          executedAt: existingApproval.executedAt,
        });

        return {
          success: true,
          data: existingApproval.executionData
            ? JSON.parse(existingApproval.executionData as string)
            : {},
          executedAt: existingApproval.executedAt || new Date(),
          message: "Execution skipped — already completed",
        };
      }

      // Prevent race conditions: don't execute if already executing
      if (existingApproval?.executionStatus === "executing") {
        this.logger.warn("execute:already_executing", {
          approvalId: approval.id,
        });

        return {
          success: false,
          error: "Execution already in progress",
          executedAt: new Date(),
        };
      }

      // Mark as executing (state transition: null/failed → executing)
      this.logger.info("execute:state_transition", {
        approvalId: approval.id,
        from: existingApproval?.executionStatus || "null",
        to: "executing",
      });

      await prisma.approval.update({
        where: { id: approval.id },
        data: { executionStatus: "executing" },
      });

      // Find appropriate Watcher
      const watcher = this.findWatcherForApproval(approval);

      if (!watcher) {
        const error = `No Watcher found for action type: ${approval.actionType}`;
        this.logger.error("execute:no_watcher", new Error(error), {
          approvalId: approval.id,
          actionType: approval.actionType,
        });

        // Update approval with error
        await this.updateApprovalWithResult(approval.id, {
          success: false,
          error,
          executedAt: new Date(),
        });

        return {
          success: false,
          error,
          executedAt: new Date(),
        };
      }

      // Execute via Watcher
      const result = await watcher.safeExecute(approval);

      // Report result
      watcher.report(result);

      // Update approval with result
      await this.updateApprovalWithResult(approval.id, result);

      const durationMs = timer();
      this.logger.info("execute:complete", {
        approvalId: approval.id,
        success: result.success,
        durationMs,
      });

      return result;
    } catch (error) {
      const durationMs = timer();
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error("execute:error", error as Error, {
        approvalId: approval.id,
        durationMs,
      });

      const result: ExecutionResult = {
        success: false,
        error: errorMessage,
        executedAt: new Date(),
        durationMs,
      };

      await this.updateApprovalWithResult(approval.id, result);

      return result;
    }
  }

  /**
   * Find the appropriate Watcher for an approval
   */
  private findWatcherForApproval(approval: Approval): BaseWatcher | null {
    for (const watcher of this.watchers.values()) {
      if (watcher.canHandle(approval)) {
        return watcher;
      }
    }
    return null;
  }

  /**
   * Update approval with execution result
   */
  private async updateApprovalWithResult(
    approvalId: string,
    result: ExecutionResult,
  ): Promise<void> {
    await prisma.approval.update({
      where: { id: approvalId },
      data: {
        executedAt: result.executedAt,
        executionStatus: result.success ? "success" : "failed",
        executionError: result.error || null,
        executionData: result.data ? JSON.stringify(result.data) : null,
      },
    });
  }

  /**
   * Map Prisma approval to shared type
   */
  private mapPrismaToApproval(prismaApproval: any): Approval {
    let actionData: any;
    try {
      actionData =
        typeof prismaApproval.actionData === "string"
          ? JSON.parse(prismaApproval.actionData)
          : prismaApproval.actionData;
    } catch (e) {
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

  /**
   * Process an approval manually (e.g. from UI or FileWatcher)
   */
  async processApproval(
    approvalId: string,
    status: "approved" | "rejected",
  ): Promise<boolean> {
    try {
      this.logger.info("process:manual_approval", {
        data: { approvalId, status },
      });

      const approval = await prisma.approval.findUnique({
        where: { id: approvalId },
      });

      if (!approval) {
        this.logger.error(
          "process:not_found",
          new Error(`Approval ${approvalId} not found`),
        );
        return false;
      }

      const updated = await prisma.approval.update({
        where: { id: approvalId },
        data: {
          status,
          respondedAt: new Date(),
        },
      });

      if (status === "approved") {
        // Trigger execution immediately if possible, or wait for next poll
        // For Hackathon 0, we'll let the poll pick it up to maintain the loop pattern
        this.logger.info("process:approved_and_queued", {
          data: { approvalId },
        });
      }

      return true;
    } catch (error) {
      this.logger.error("process:manual_error", error as Error);
      return false;
    }
  }

  /**
   * Get orchestrator status
   */
  getStatus(): { isRunning: boolean; watcherCount: number } {
    return {
      isRunning: this.isRunning,
      watcherCount: this.watchers.size,
    };
  }
}

// Singleton instance
export const orchestrator = new Orchestrator();
export default orchestrator;
