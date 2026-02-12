/**
 * Email Watcher - Handles email sending actions
 * Refactored to extend BaseWatcher and implement Hackathon Zero pattern
 */

import { Approval } from "../../../../shared/types";
import { BaseWatcher } from "../../core/watchers/BaseWatcher";
import { ExecutionResult, ActionType } from "../../core/actionTypes";
import emailAgent from "../agents/emailAgent";

export class EmailWatcher extends BaseWatcher {
  constructor() {
    super("emailWatcher");
  }

  canHandle(approval: Approval): boolean {
    return approval.actionType === ActionType.EMAIL_SEND;
  }

  async execute(approval: Approval): Promise<ExecutionResult> {
    try {
      // Parse email data from approval
      const { entities, rawMessage } = approval.actionData;

      // Extract email details (match Mistral's entity field names from systemPrompt)
      const emailData = {
        to: entities?.recipient || entities?.to || "unknown@example.com",
        subject:
          entities?.emailSubject || entities?.subject || `Re: ${rawMessage}`,
        body:
          entities?.emailBody ||
          entities?.body ||
          entities?.message ||
          rawMessage,
      };

      this.logger.info("execute:sending_email", {
        approvalId: approval.id,
        data: { to: emailData.to, subject: emailData.subject },
      });

      // Execute email send via emailAgent
      const result = await emailAgent.sendEmail(approval.userId, emailData);

      return {
        success: true,
        data: {
          messageId: result.messageId,
          to: emailData.to,
          subject: emailData.subject,
          sentAt: result.timestamp,
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

export default new EmailWatcher();
