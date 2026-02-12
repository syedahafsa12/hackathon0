import { promises as fs } from "fs";
import { join } from "path";
import matter from "gray-matter";
import { Logger } from "../shared/logger";

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: string;
  sessionId: string;
  context?: string;
  tags: string[];
}

export interface KnowledgeEntry {
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  references: string[];
}

export interface SearchResult {
  file: string;
  content: string;
  matchedTerms: string[];
  timestamp: string;
}

export class KnowledgeVault {
  private knowledgePath: string;
  private logger: Logger;
  private readonly indexFile = "knowledge-index.json";

  constructor(vaultPath: string) {
    this.knowledgePath = join(vaultPath, "Knowledge");
    this.logger = new Logger("KnowledgeVault");
  }

  async initialize(): Promise<void> {
    this.logger.info("Initializing Knowledge Vault...");

    try {
      await fs.mkdir(this.knowledgePath, { recursive: true });
      this.logger.info("Knowledge vault directory created");

      // Initialize search index
      await this.initializeIndex();
    } catch (error) {
      this.logger.error("Failed to initialize knowledge vault", error);
      throw error;
    }
  }

  private async initializeIndex(): Promise<void> {
    const indexPath = join(this.knowledgePath, this.indexFile);
    try {
      await fs.access(indexPath);
    } catch {
      const initialIndex = {
        version: "1.0",
        lastUpdated: new Date().toISOString(),
        entries: [],
        fullTextSearch: true,
      };
      await fs.writeFile(indexPath, JSON.stringify(initialIndex, null, 2));
      this.logger.info("Knowledge index initialized");
    }
  }

  async saveChatMessage(
    content: string,
    role: "user" | "assistant" | "system",
    sessionId: string,
    context?: string,
    tags: string[] = [],
  ): Promise<string> {
    const messageId = `chat_${Date.now()}_${role}`;
    const timestamp = new Date().toISOString();
    const date = timestamp.split("T")[0];

    const chatMessage: ChatMessage = {
      id: messageId,
      content,
      role,
      timestamp,
      sessionId,
      context,
      tags: [...tags, "chat", role, date],
    };

    // Create dated subfolder
    const datedPath = join(this.knowledgePath, date);
    await fs.mkdir(datedPath, { recursive: true });

    // Save as markdown file
    const filename = `${messageId}.md`;
    const filePath = join(datedPath, filename);

    const frontmatter = `---
id: ${chatMessage.id}
role: ${chatMessage.role}
timestamp: ${chatMessage.timestamp}
sessionId: ${chatMessage.sessionId}
context: ${chatMessage.context || ""}
tags: ${JSON.stringify(chatMessage.tags)}
---

${content}`;

    await fs.writeFile(filePath, frontmatter);

    // Update index
    await this.updateIndex(chatMessage, filePath);

    this.logger.info(`Saved chat message: ${messageId}`);
    return filePath;
  }

  async saveKnowledgeEntry(
    title: string,
    content: string,
    tags: string[] = [],
    references: string[] = [],
  ): Promise<string> {
    const entryId = `knowledge_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const date = timestamp.split("T")[0];

    const knowledgeEntry: KnowledgeEntry = {
      title,
      content,
      tags,
      createdAt: timestamp,
      updatedAt: timestamp,
      references,
    };

    // Create dated subfolder
    const datedPath = join(this.knowledgePath, date);
    await fs.mkdir(datedPath, { recursive: true });

    // Save as markdown file
    const filename = `${entryId}.md`;
    const filePath = join(datedPath, filename);

    const frontmatter = `---
id: ${entryId}
title: ${title}
createdAt: ${timestamp}
updatedAt: ${timestamp}
tags: ${JSON.stringify(tags)}
references: ${JSON.stringify(references)}
---

${content}`;

    await fs.writeFile(filePath, frontmatter);

    // Update index
    await this.updateIndex(knowledgeEntry as any, filePath);

    this.logger.info(`Saved knowledge entry: ${title}`);
    return filePath;
  }

  private async updateIndex(entry: any, filePath: string): Promise<void> {
    const indexPath = join(this.knowledgePath, this.indexFile);

    try {
      const indexData = JSON.parse(await fs.readFile(indexPath, "utf8"));
      const relativePath = filePath
        .replace(this.knowledgePath, "")
        .replace(/^[/\\]/, "");

      indexData.entries.push({
        file: relativePath,
        id: entry.id,
        timestamp: entry.timestamp,
        role: entry.role,
        tags: entry.tags,
        sessionId: entry.sessionId,
      });

      indexData.lastUpdated = new Date().toISOString();

      await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));
    } catch (error) {
      this.logger.error("Failed to update knowledge index", error);
    }
  }

  async search(query: string, tags?: string[]): Promise<SearchResult[]> {
    this.logger.info(`Searching knowledge vault: "${query}"`);

    const results: SearchResult[] = [];
    const indexPath = join(this.knowledgePath, this.indexFile);

    try {
      const indexData = JSON.parse(await fs.readFile(indexPath, "utf8"));

      for (const entry of indexData.entries) {
        // Filter by tags if specified
        if (tags && tags.length > 0) {
          const hasAllTags = tags.every((tag) => entry.tags.includes(tag));
          if (!hasAllTags) continue;
        }

        const filePath = join(this.knowledgePath, entry.file);
        try {
          const fileContent = await fs.readFile(filePath, "utf8");
          const { content } = matter(fileContent);

          // Simple text search
          const contentLower = content.toLowerCase();
          const queryLower = query.toLowerCase();

          if (contentLower.includes(queryLower)) {
            // Extract snippet around match
            const index = contentLower.indexOf(queryLower);
            const start = Math.max(0, index - 100);
            const end = Math.min(content.length, index + query.length + 100);
            const snippet = content.substring(start, end);

            results.push({
              file: entry.file,
              content: snippet + (end < content.length ? "..." : ""),
              matchedTerms: [query],
              timestamp: entry.timestamp,
            });
          }
        } catch (error) {
          this.logger.warn(`Could not read file ${entry.file}`, error);
        }
      }
    } catch (error) {
      this.logger.error("Failed to search knowledge vault", error);
    }

    // Sort by recency
    results.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    this.logger.info(`Search found ${results.length} results`);
    return results;
  }

  async getRecentChats(limit: number = 10): Promise<ChatMessage[]> {
    const indexPath = join(this.knowledgePath, this.indexFile);

    try {
      const indexData = JSON.parse(await fs.readFile(indexPath, "utf8"));

      const chatEntries = indexData.entries
        .filter(
          (entry: any) =>
            entry.role && ["user", "assistant", "system"].includes(entry.role),
        )
        .sort(
          (a: any, b: any) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, limit);

      const chats: ChatMessage[] = [];

      for (const entry of chatEntries) {
        const filePath = join(this.knowledgePath, entry.file);
        try {
          const fileContent = await fs.readFile(filePath, "utf8");
          const { data, content } = matter(fileContent);

          chats.push({
            id: data.id,
            content,
            role: data.role,
            timestamp: data.timestamp,
            sessionId: data.sessionId,
            context: data.context,
            tags: data.tags,
          });
        } catch (error) {
          this.logger.warn(`Could not read chat file ${entry.file}`, error);
        }
      }

      return chats;
    } catch (error) {
      this.logger.error("Failed to get recent chats", error);
      return [];
    }
  }

  async getBySession(sessionId: string): Promise<ChatMessage[]> {
    const indexPath = join(this.knowledgePath, this.indexFile);

    try {
      const indexData = JSON.parse(await fs.readFile(indexPath, "utf8"));

      const sessionEntries = indexData.entries.filter(
        (entry: any) => entry.sessionId === sessionId,
      );

      const messages: ChatMessage[] = [];

      for (const entry of sessionEntries) {
        const filePath = join(this.knowledgePath, entry.file);
        try {
          const fileContent = await fs.readFile(filePath, "utf8");
          const { data, content } = matter(fileContent);

          messages.push({
            id: data.id,
            content,
            role: data.role,
            timestamp: data.timestamp,
            sessionId: data.sessionId,
            context: data.context,
            tags: data.tags,
          });
        } catch (error) {
          this.logger.warn(`Could not read chat file ${entry.file}`, error);
        }
      }

      // Sort by timestamp
      messages.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      return messages;
    } catch (error) {
      this.logger.error("Failed to get session chats", error);
      return [];
    }
  }

  async getKnowledgeStats(): Promise<{
    totalEntries: number;
    totalChats: number;
    totalTags: number;
    dateRange: { earliest: string; latest: string } | null;
  }> {
    const indexPath = join(this.knowledgePath, this.indexFile);

    try {
      const indexData = JSON.parse(await fs.readFile(indexPath, "utf8"));

      const chatEntries = indexData.entries.filter(
        (entry: any) =>
          entry.role && ["user", "assistant", "system"].includes(entry.role),
      );
      const allTags = new Set<string>();
      const timestamps = indexData.entries.map((entry: any) => entry.timestamp);

      indexData.entries.forEach((entry: any) => {
        (entry.tags || []).forEach((tag: string) => allTags.add(tag));
      });

      return {
        totalEntries: indexData.entries.length,
        totalChats: chatEntries.length,
        totalTags: allTags.size,
        dateRange:
          timestamps.length > 0
            ? {
                earliest: new Date(
                  Math.min(
                    ...timestamps.map((t: string) => new Date(t).getTime()),
                  ),
                )
                  .toISOString()
                  .split("T")[0],
                latest: new Date(
                  Math.max(
                    ...timestamps.map((t: string) => new Date(t).getTime()),
                  ),
                )
                  .toISOString()
                  .split("T")[0],
              }
            : null,
      };
    } catch (error) {
      this.logger.error("Failed to get knowledge stats", error);
      return {
        totalEntries: 0,
        totalChats: 0,
        totalTags: 0,
        dateRange: null,
      };
    }
  }

  async pruneOldEntries(retentionDays: number = 90): Promise<number> {
    this.logger.info(`Pruning entries older than ${retentionDays} days...`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let prunedCount = 0;

    try {
      const indexPath = join(this.knowledgePath, this.indexFile);
      const indexData = JSON.parse(await fs.readFile(indexPath, "utf8"));

      const entriesToPrune = indexData.entries.filter((entry: any) => {
        const entryDate = new Date(entry.timestamp);
        return entryDate < cutoffDate;
      });

      // Remove files and update index
      for (const entry of entriesToPrune) {
        const filePath = join(this.knowledgePath, entry.file);
        try {
          await fs.unlink(filePath);
          prunedCount++;
        } catch (error) {
          this.logger.warn(`Could not delete file ${entry.file}`, error);
        }
      }

      // Update index
      indexData.entries = indexData.entries.filter(
        (entry: any) =>
          !entriesToPrune.some((toPrune) => toPrune.file === entry.file),
      );
      indexData.lastUpdated = new Date().toISOString();

      await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));

      this.logger.info(`Pruned ${prunedCount} old entries`);
    } catch (error) {
      this.logger.error("Failed to prune old entries", error);
    }

    return prunedCount;
  }

  async cleanup(): Promise<void> {
    this.logger.info("Knowledge Vault cleaned up");
  }
}

// Singleton instance
let knowledgeVaultInstance: KnowledgeVault | null = null;

export function getKnowledgeVault(vaultPath?: string): KnowledgeVault {
  if (!knowledgeVaultInstance) {
    knowledgeVaultInstance = new KnowledgeVault(vaultPath || ".obsidian-vault");
  }
  return knowledgeVaultInstance;
}
