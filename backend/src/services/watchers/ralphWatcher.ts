import { Approval } from "../../../../shared/types";
import { BaseWatcher } from "../../core/watchers/BaseWatcher";
import { ExecutionResult, ActionType } from "../../core/actionTypes";
import { ralphLoopExecutor } from "../../agents/ralphLoop/RalphLoopExecutor";

export class RalphWatcher extends BaseWatcher {
  constructor() {
    super("ralphWatcher");
  }

  canHandle(approval: Approval): boolean {
    return approval.actionType === ActionType.RALPH_EXECUTE;
  }

  async execute(approval: Approval): Promise<ExecutionResult> {
    try {
      const { prompt, maxIterations } = approval.actionData;

      this.logger.info("execute:starting_ralph_loop", {
        approvalId: approval.id,
        data: { prompt: prompt.substring(0, 50), maxIterations },
      });

      // Execute the loop autonomously
      const result = await ralphLoopExecutor.executeWithPersistence(
        approval.userId,
        prompt,
        maxIterations,
      );

      return {
        success: result.success,
        data: result,
        executedAt: new Date(),
        message: result.success
          ? `Ralph Loop completed successfully after ${result.iterations} iterations.`
          : `Ralph Loop failed: ${result.error}`,
      };
    } catch (error: any) {
      this.logger.error("execute:failed", error, {
        approvalId: approval.id,
      });

      return {
        success: false,
        error: error.message,
        executedAt: new Date(),
      };
    }
  }
}

export default new RalphWatcher();
