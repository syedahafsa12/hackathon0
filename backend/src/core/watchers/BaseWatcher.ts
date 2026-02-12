/**
 * Base Watcher class for all action executors
 * Implements the Watcher pattern from Hackathon Zero architecture
 */

import { Approval } from "../../../../shared/types";
import { ExecutionResult } from "../actionTypes";
import { StructuredLogger } from "../logging/structuredLogger";

export abstract class BaseWatcher {
  protected logger: StructuredLogger;

  constructor(protected name: string) {
    this.logger = new StructuredLogger(`watcher:${name}`);
  }

  /**
   * Check if this Watcher can handle the given approval
   * @param approval The approval to check
   * @returns true if this Watcher can handle the approval
   */
  abstract canHandle(approval: Approval): boolean;

  /**
   * Execute the approved action
   * @param approval The approval to execute
   * @returns Execution result
   */
  abstract execute(approval: Approval): Promise<ExecutionResult>;

  /**
   * Safe execution wrapper with error handling and logging
   * @param approval The approval to execute
   * @returns Execution result
   */
  async safeExecute(approval: Approval): Promise<ExecutionResult> {
    const timer = this.logger.startTimer();

    this.logger.info("execute:start", {
      approvalId: approval.id,
      userId: approval.userId,
      actionType: approval.actionType,
    });

    try {
      const result = await this.execute(approval);
      const durationMs = timer();

      this.logger.info("execute:complete", {
        approvalId: approval.id,
        userId: approval.userId,
        actionType: approval.actionType,
        success: result.success,
        durationMs,
      });

      return {
        ...result,
        durationMs,
      };
    } catch (error) {
      const durationMs = timer();
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error("execute:error", error as Error, {
        approvalId: approval.id,
        userId: approval.userId,
        actionType: approval.actionType,
        durationMs,
      });

      return {
        success: false,
        error: errorMessage,
        executedAt: new Date(),
        durationMs,
      };
    }
  }

  /**
   * Report execution result (for logging/monitoring)
   * @param result The execution result
   */
  report(result: ExecutionResult): void {
    if (result.success) {
      this.logger.info("report:success", {
        success: true,
        durationMs: result.durationMs,
      });
    } else {
      this.logger.warn("report:failure", {
        success: false,
        error: result.error,
        durationMs: result.durationMs,
      });
    }
  }

  /**
   * Get the name of this Watcher
   */
  getName(): string {
    return this.name;
  }
}
