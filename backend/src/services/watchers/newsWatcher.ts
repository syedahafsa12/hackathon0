import { Approval } from "../../../../shared/types";
import { BaseWatcher } from "../../core/watchers/BaseWatcher";
import { ExecutionResult, ActionType } from "../../core/actionTypes";
import { newsAgentV2 } from "../../agents/news/NewsAgentV2";

export class NewsWatcher extends BaseWatcher {
  constructor() {
    super("newsWatcher");
  }

  canHandle(approval: Approval): boolean {
    return approval.actionType === ActionType.NEWS_FETCH;
  }

  async execute(approval: Approval): Promise<ExecutionResult> {
    try {
      this.logger.info("execute:fetching_news", {
        approvalId: approval.id,
        userId: approval.userId,
      });

      const result = await newsAgentV2.fetchTodaysNews(approval.userId);

      if (result.success) {
        return {
          success: true,
          data: result.digest,
          executedAt: new Date(),
          message: `News digest generated and saved to vault.`,
        };
      } else {
        return {
          success: false,
          error: result.error,
          executedAt: new Date(),
        };
      }
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

export default new NewsWatcher();
