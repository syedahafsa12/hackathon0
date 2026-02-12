/**
 * Knowledge Watcher - Handles knowledge vault save actions
 */

import { Approval } from "../../../../shared/types";
import { BaseWatcher } from "../../core/watchers/BaseWatcher";
import { ExecutionResult, ActionType } from "../../core/actionTypes";
import knowledgeService from "../knowledge/knowledgeService";

export class KnowledgeWatcher extends BaseWatcher {
  constructor() {
    super("knowledgeWatcher");
  }

  canHandle(approval: Approval): boolean {
    return approval.actionType === ActionType.KNOWLEDGE_SAVE;
  }

  async execute(approval: Approval): Promise<ExecutionResult> {
    try {
      const { entities, rawMessage } = approval.actionData;

      // Extract knowledge entry details
      const knowledgeData = {
        title: entities?.title || "Knowledge Entry",
        content: entities?.content || rawMessage,
        category: entities?.category,
        tags: entities?.tags || [],
      };

      this.logger.info("execute:saving_knowledge", {
        approvalId: approval.id,
        data: { title: knowledgeData.title, category: knowledgeData.category },
      });

      // Save knowledge entry
      const entry = await knowledgeService.createKnowledgeEntry(
        approval.userId,
        knowledgeData,
      );

      return {
        success: true,
        data: {
          entryId: entry.id,
          title: entry.title,
          category: entry.category,
          tags: entry.tags,
          createdAt: entry.createdAt,
          verification: "Knowledge entry persisted and searchable",
        },
        executedAt: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error("execute:failed", error as Error, {
        approvalId: approval.id,
      });

      return {
        success: false,
        error: errorMessage,
        executedAt: new Date(),
      };
    }
  }
}

export default new KnowledgeWatcher();
