import { FastifyRequest, FastifyReply } from "fastify";
import chatService from "../services/chatService";
import { AuthenticatedRequest } from "../middleware/auth";
import intentRouter from "../services/intentRouter/intentRouter";
import websocketService from "../services/websocket";

export class ChatController {
  async sendMessage(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { content, parentId } = req.body as {
        content: string;
        parentId?: string;
      };
      const userId = req.userId;

      if (!content) {
        return res.status(400).send({
          success: false,
          error: {
            code: "MISSING_CONTENT",
            message: "Message content is required",
          },
        });
      }

      // Save user message
      const userMessage = await chatService.createMessage(
        userId,
        content,
        "user",
        parentId,
      );

      console.log(
        `[ChatController] About to call intentRouter.processMessage for user ${userId}`,
      );
      console.log(`[ChatController] Message content: "${content}"`);

      // Fetch conversation history for context (last 10 messages)
      const conversationHistory = await chatService.getMessagesByUserId(
        userId,
        10,
      );
      const contextMessages = conversationHistory
        .reverse() // Oldest first
        .map((msg) => msg.content);

      // Process through IntentRouter with conversation context
      const routerResponse = await intentRouter.processMessage(
        userId,
        content,
        contextMessages,
      );

      console.log(
        `[ChatController] IntentRouter returned:`,
        JSON.stringify(routerResponse, null, 2),
      );

      // Save assistant response
      const assistantMessage = await chatService.createMessage(
        userId,
        routerResponse.message,
        "assistant",
        userMessage.id,
      );

      // Emit assistant response via WebSocket
      websocketService.emitToUser(userId, "assistant_response", {
        messageId: assistantMessage.id,
        content: routerResponse.message,
        intent: {
          type: routerResponse.classification.intent,
          confidence: routerResponse.classification.confidence,
        },
        eventCreated: routerResponse.eventCreated,
        eventId: routerResponse.eventId,
        timestamp: assistantMessage.timestamp,
      });

      // If an approval was created, emit approval request
      if (routerResponse.eventCreated && routerResponse.eventId) {
        websocketService.emitToUser(userId, "approval_request", {
          approvalId: routerResponse.eventId,
          actionType: routerResponse.classification.intent,
          actionData: routerResponse.classification.entities,
          createdAt: new Date().toISOString(),
        });
      }

      return res.send({
        success: true,
        data: {
          userMessage,
          assistantMessage,
          intent: {
            type: routerResponse.classification.intent,
            confidence: routerResponse.classification.confidence,
          },
          eventCreated: routerResponse.eventCreated,
          eventId: routerResponse.eventId,
        },
      });
    } catch (error: any) {
      console.error("Error sending message:", error);
      console.error("Error stack:", error?.stack);
      return res.status(500).send({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to send message",
          details: error?.message || String(error),
        },
      });
    }
  }

  async getChatHistory(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { limit, before, after } = req.query as {
        limit?: string;
        before?: string;
        after?: string;
      };

      const userId = req.userId;
      const limitNum = limit ? parseInt(limit) : 50;
      const beforeDate = before ? new Date(before) : undefined;
      const afterDate = after ? new Date(after) : undefined;

      const messages = await chatService.getMessagesByUserId(
        userId,
        limitNum,
        beforeDate,
        afterDate,
      );

      return res.send({
        success: true,
        data: {
          messages,
          hasMore: messages.length === limitNum,
        },
      });
    } catch (error) {
      console.error("Error getting chat history:", error);
      return res.status(500).send({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get chat history",
        },
      });
    }
  }

  async updateMessageStatus(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { messageId, status } = req.body as {
        messageId: string;
        status: "sent" | "delivered" | "read";
      };

      const validStatuses: Array<"sent" | "delivered" | "read"> = [
        "sent",
        "delivered",
        "read",
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).send({
          success: false,
          error: { code: "INVALID_STATUS", message: "Invalid status value" },
        });
      }

      const updatedMessage = await chatService.updateMessageStatus(
        messageId,
        status,
      );

      return res.send({
        success: true,
        data: updatedMessage,
      });
    } catch (error) {
      console.error("Error updating message status:", error);
      return res.status(500).send({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update message status",
        },
      });
    }
  }

  /**
   * Send streaming message with SSE
   */
  async sendStreamingMessage(
    userId: string,
    content: string,
    onChunk: (chunk: string) => void,
    onComplete: (done: boolean) => void,
  ) {
    try {
      // Save user message
      await chatService.createMessage(userId, content, "user");

      // Fetch conversation history
      const conversationHistory = await chatService.getMessagesByUserId(
        userId,
        10,
      );
      const contextMessages = conversationHistory
        .reverse()
        .map((msg) => msg.content);

      // Process through IntentRouter
      const routerResponse = await intentRouter.processMessage(
        userId,
        content,
        contextMessages,
      );

      // Simulate streaming by breaking response into words
      const words = routerResponse.message.split(" ");
      let fullMessage = "";

      for (const word of words) {
        fullMessage += (fullMessage ? " " : "") + word;
        onChunk(word + " ");
        // Small delay to simulate streaming
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Save assistant message
      await chatService.createMessage(userId, fullMessage, "assistant");

      // Signal completion
      onComplete(true);
    } catch (error) {
      console.error("[ChatController] Streaming error:", error);
      onChunk("Sorry, I encountered an error processing your message.");
      onComplete(true);
    }
  }
}

export const chatController = new ChatController();
export default chatController;
