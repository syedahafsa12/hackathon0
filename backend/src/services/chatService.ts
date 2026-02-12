import { PrismaClient, ChatMessage as PrismaChatMessage } from "@prisma/client";
import { ChatMessage } from "../../../shared/types";
import crypto from "crypto";

// Generate UUID using Node.js crypto
const uuidv4 = (): string => crypto.randomUUID();

const prisma = new PrismaClient();

export class ChatService {
  private async ensureDevUserExists(userId: string): Promise<void> {
    // In development, auto-create the user if it doesn't exist
    if (process.env.NODE_ENV !== "production") {
      try {
        await prisma.user.upsert({
          where: { id: userId },
          update: {},
          create: {
            id: userId,
            name: "Dev User",
            email: `${userId.replace(/[^a-zA-Z0-9]/g, "-")}@dev.local`,
          },
        });
      } catch (error) {
        console.log(`User ${userId} already exists or creation handled`);
      }
    }
  }

  async createMessage(
    userId: string,
    content: string,
    sender: "user" | "assistant",
    parentId?: string,
  ): Promise<ChatMessage> {
    try {
      // Ensure user exists in development
      await this.ensureDevUserExists(userId);

      const message = await prisma.chatMessage.create({
        data: {
          id: uuidv4(),
          userId,
          content,
          role: sender,
          parentId,
          timestamp: new Date(),
          status: "sent",
        },
      });

      return this.mapPrismaToChatMessage(message);
    } catch (error) {
      console.error("Error creating chat message:", error);
      throw error;
    }
  }

  async getMessagesByUserId(
    userId: string,
    limit: number = 50,
    before?: Date,
    after?: Date,
  ): Promise<ChatMessage[]> {
    try {
      const whereClause: any = { userId };

      if (before) {
        whereClause.timestamp = { ...whereClause.timestamp, lt: before };
      }
      if (after) {
        whereClause.timestamp = { ...whereClause.timestamp, gt: after };
      }

      const messages = await prisma.chatMessage.findMany({
        where: whereClause,
        orderBy: { timestamp: "desc" },
        take: limit,
      });

      return messages.map(this.mapPrismaToChatMessage);
    } catch (error) {
      console.error("Error getting chat messages:", error);
      throw error;
    }
  }

  async getMessageById(id: string): Promise<ChatMessage | null> {
    try {
      const message = await prisma.chatMessage.findUnique({
        where: { id },
      });

      if (!message) {
        return null;
      }

      return this.mapPrismaToChatMessage(message);
    } catch (error) {
      console.error("Error getting chat message by id:", error);
      throw error;
    }
  }

  async updateMessageStatus(
    id: string,
    status: "sent" | "delivered" | "read",
  ): Promise<ChatMessage> {
    try {
      const message = await prisma.chatMessage.update({
        where: { id },
        data: { status },
      });

      return this.mapPrismaToChatMessage(message);
    } catch (error) {
      console.error("Error updating chat message status:", error);
      throw error;
    }
  }

  private mapPrismaToChatMessage(
    prismaMessage: PrismaChatMessage,
  ): ChatMessage {
    return {
      id: prismaMessage.id,
      userId: prismaMessage.userId,
      sender: prismaMessage.role as "user" | "assistant",
      content: prismaMessage.content,
      timestamp: prismaMessage.timestamp,
      status: prismaMessage.status as "sent" | "delivered" | "read",
      parentId: prismaMessage.parentId || undefined,
    };
  }
}

export default new ChatService();
