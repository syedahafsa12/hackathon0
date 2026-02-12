/**
 * LinkedIn Watcher - Handles LinkedIn post creation actions
 */

import { Approval } from "../../../../shared/types";
import { BaseWatcher } from "../../core/watchers/BaseWatcher";
import { ExecutionResult, ActionType } from "../../core/actionTypes";
import linkedinAgent from "../agents/linkedinAgent";

export class LinkedInWatcher extends BaseWatcher {
  constructor() {
    super("linkedinWatcher");
  }

  canHandle(approval: Approval): boolean {
    return approval.actionType === ActionType.LINKEDIN_POST;
  }

  async execute(approval: Approval): Promise<ExecutionResult> {
    try {
      const { entities, rawMessage } = approval.actionData;

      // Extract LinkedIn post details
      const postData = {
        content: entities?.content || entities?.post || rawMessage,
        imageUrl: entities?.imageUrl,
        hashtags: entities?.hashtags || [],
      };

      this.logger.info("execute:creating_post", {
        approvalId: approval.id,
        data: { contentLength: postData.content.length },
      });

      // Write to LinkedIn outbox (real execution, not a mock)
      // This creates a persistent record that can be queried later
      const { PrismaClient } = require("@prisma/client");
      const prisma = new PrismaClient();

      const outboxEntry = await prisma.linkedInOutbox.create({
        data: {
          userId: approval.userId,
          content: postData.content,
          hashtags: JSON.stringify(postData.hashtags || []),
          imageUrl: postData.imageUrl || null,
          status: "ready_to_publish",
        },
      });

      this.logger.info("execute:post_written_to_outbox", {
        approvalId: approval.id,
        outboxId: outboxEntry.id,
      });

      return {
        success: true,
        data: {
          outboxId: outboxEntry.id,
          status: outboxEntry.status,
          createdAt: outboxEntry.createdAt,
          verification: "Post written to LinkedIn outbox and ready to publish",
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

export default new LinkedInWatcher();
