import {
  PrismaClient,
  KnowledgeEntry as PrismaKnowledgeEntry,
} from "@prisma/client";
import { KnowledgeEntry } from "../../../../shared/types";
import crypto from "crypto";

const uuidv4 = (): string => crypto.randomUUID();

const prisma = new PrismaClient();

export class KnowledgeService {
  async createKnowledgeEntry(
    userId: string,
    entryData: {
      title: string;
      content: string;
      category: string;
      tags?: string[];
    },
  ): Promise<KnowledgeEntry> {
    try {
      const entry = await prisma.knowledgeEntry.create({
        data: {
          id: uuidv4(),
          userId,
          title: entryData.title,
          content: entryData.content,
          category: entryData.category,
          tags: entryData.tags || [],
        },
      });

      return this.mapPrismaToKnowledgeEntry(entry);
    } catch (error) {
      console.error("Error creating knowledge entry:", error);
      throw error;
    }
  }

  async getKnowledgeEntriesByUserId(
    userId: string,
    category?: string,
    tags?: string[],
    limit: number = 50,
  ): Promise<KnowledgeEntry[]> {
    try {
      const whereClause: any = { userId };

      if (category) {
        whereClause.category = category;
      }

      if (tags && tags.length > 0) {
        // Find entries that contain any of the specified tags
        whereClause.tags = {
          hasSome: tags,
        };
      }

      const entries = await prisma.knowledgeEntry.findMany({
        where: whereClause,
        orderBy: { lastAccessed: "desc" },
        take: limit,
      });

      return entries.map(this.mapPrismaToKnowledgeEntry);
    } catch (error) {
      console.error("Error getting knowledge entries:", error);
      throw error;
    }
  }

  async getKnowledgeEntryById(
    id: string,
    userId: string,
  ): Promise<KnowledgeEntry | null> {
    try {
      const entry = await prisma.knowledgeEntry.findUnique({
        where: { id },
      });

      if (!entry || entry.userId !== userId) {
        return null;
      }

      // Update last accessed time
      await prisma.knowledgeEntry.update({
        where: { id },
        data: { lastAccessed: new Date() },
      });

      return this.mapPrismaToKnowledgeEntry(entry);
    } catch (error) {
      console.error("Error getting knowledge entry by id:", error);
      throw error;
    }
  }

  async updateKnowledgeEntry(
    id: string,
    userId: string,
    updateData: Partial<KnowledgeEntry>,
  ): Promise<KnowledgeEntry> {
    try {
      const entry = await prisma.knowledgeEntry.findUnique({
        where: { id },
      });

      if (!entry || entry.userId !== userId) {
        throw new Error("Knowledge entry not found or unauthorized");
      }

      const updatedEntry = await prisma.knowledgeEntry.update({
        where: { id },
        data: {
          title: updateData.title,
          content: updateData.content,
          category: updateData.category,
          tags: updateData.tags,
        },
      });

      return this.mapPrismaToKnowledgeEntry(updatedEntry);
    } catch (error) {
      console.error("Error updating knowledge entry:", error);
      throw error;
    }
  }

  async deleteKnowledgeEntry(id: string, userId: string): Promise<boolean> {
    try {
      const entry = await prisma.knowledgeEntry.findUnique({
        where: { id },
      });

      if (!entry || entry.userId !== userId) {
        throw new Error("Knowledge entry not found or unauthorized");
      }

      await prisma.knowledgeEntry.delete({
        where: { id },
      });

      return true;
    } catch (error) {
      console.error("Error deleting knowledge entry:", error);
      throw error;
    }
  }

  async searchKnowledgeEntries(
    userId: string,
    query: string,
    category?: string,
    limit: number = 50,
  ): Promise<KnowledgeEntry[]> {
    try {
      // Build search query - search in title, content, and tags
      const searchWhereClause: any = {
        userId,
        OR: [
          { title: { contains: query } },
          { content: { contains: query } },
          { tags: { has: query } },
        ],
      };

      if (category) {
        searchWhereClause.category = category;
      }

      const entries = await prisma.knowledgeEntry.findMany({
        where: searchWhereClause,
        orderBy: { lastAccessed: "desc" },
        take: limit,
      });

      return entries.map(this.mapPrismaToKnowledgeEntry);
    } catch (error) {
      console.error("Error searching knowledge entries:", error);
      throw error;
    }
  }

  async getKnowledgeCategories(userId: string): Promise<string[]> {
    try {
      // Get distinct categories for the user
      const categories = await prisma.knowledgeEntry.groupBy({
        by: ["category"],
        where: { userId },
        _count: { category: true },
      });

      return categories.map((cat) => cat.category);
    } catch (error) {
      console.error("Error getting knowledge categories:", error);
      throw error;
    }
  }

  async getKnowledgeTags(userId: string): Promise<string[]> {
    try {
      // Get all tags for the user's entries and return unique ones
      const entries = await prisma.knowledgeEntry.findMany({
        where: { userId },
        select: { tags: true },
      });

      const allTags = entries.flatMap((entry) => entry.tags);
      return [...new Set(allTags)];
    } catch (error) {
      console.error("Error getting knowledge tags:", error);
      throw error;
    }
  }

  private mapPrismaToKnowledgeEntry(
    prismaEntry: PrismaKnowledgeEntry,
  ): KnowledgeEntry {
    return {
      id: prismaEntry.id,
      userId: prismaEntry.userId,
      title: prismaEntry.title,
      content: prismaEntry.content,
      category: prismaEntry.category,
      tags: prismaEntry.tags as string[],
      createdAt: prismaEntry.createdAt,
      updatedAt: prismaEntry.updatedAt,
      lastAccessed: prismaEntry.lastAccessed,
    };
  }
}

export default new KnowledgeService();
