import { promises as fs } from "fs";
import { join } from "path";
import { Logger } from "../shared/logger";

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  service: string;
  action: string;
  details: string;
  metadata?: Record<string, any>;
}

export class LogManager {
  private logsPath: string;
  private logger: Logger;
  private readonly retentionDays = 90; // 90-day retention as per constitution

  constructor(vaultPath: string) {
    this.logsPath = join(vaultPath, "Logs");
    this.logger = new Logger("LogManager");
  }

  async initialize(): Promise<void> {
    this.logger.info("Initializing Log Manager...");

    try {
      await fs.mkdir(this.logsPath, { recursive: true });
      this.logger.info("Logs directory created");

      // Create index.json for quick access
      await this.createLogIndex();

      // Run initial cleanup of old logs
      await this.cleanupOldLogs();
    } catch (error: any) {
      this.logger.error("Failed to initialize log manager", error);
      throw error;
    }
  }

  private async createLogIndex(): Promise<void> {
    const indexPath = join(this.logsPath, "index.json");
    try {
      await fs.access(indexPath);
    } catch {
      const index = {
        version: "1.0",
        lastUpdated: new Date().toISOString(),
        logFiles: [],
        totalEntries: 0,
      };
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
      this.logger.info("Log index created");
    }
  }

  async log(
    level: LogEntry["level"],
    service: string,
    action: string,
    details: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      action,
      details,
      metadata,
    };

    const date = entry.timestamp.split("T")[0];
    const logFile = join(this.logsPath, `${date}.json`);

    try {
      // Read existing logs
      let logs: LogEntry[] = [];
      try {
        const existingData = await fs.readFile(logFile, "utf8");
        logs = JSON.parse(existingData);
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }

      // Add new entry
      logs.push(entry);

      // Write back atomically
      await fs.writeFile(logFile, JSON.stringify(logs, null, 2));

      // Update index
      await this.updateIndex(date, logFile, logs.length);

      this.logger.debug(`Logged: ${service} - ${action}`);
    } catch (error: any) {
      this.logger.error("Failed to write log entry", error);
    }
  }

  async createMarkdownLog(
    service: string,
    action: string,
    details: string,
    metadata?: Record<string, any>,
  ): Promise<string> {
    const timestamp = new Date().toISOString();
    const date = timestamp.split("T")[0];
    const markdownFile = join(this.logsPath, `${date}.md`);

    try {
      // Read existing markdown log
      let content = "";
      try {
        content = await fs.readFile(markdownFile, "utf8");
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }

      // Append new entry in markdown format
      const newEntry = `## [${timestamp}] ${service} - ${action}

**Details**: ${details}

${
  metadata
    ? `**Metadata**:\n${Object.entries(metadata)
        .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
        .join("\n")}\n`
    : ""
}
---

`;

      content = newEntry + content;

      await fs.writeFile(markdownFile, content, "utf8");

      this.logger.debug(`Created markdown log: ${service} - ${action}`);
      return markdownFile;
    } catch (error: any) {
      this.logger.error("Failed to create markdown log", error);
      throw error;
    }
  }

  async getLogs(date?: string, limit?: number): Promise<LogEntry[]> {
    if (date) {
      // Get logs for specific date
      const logFile = join(this.logsPath, `${date}.json`);
      try {
        const data = await fs.readFile(logFile, "utf8");
        const logs: LogEntry[] = JSON.parse(data);
        return limit ? logs.slice(0, limit) : logs;
      } catch (error: any) {
        if (error.code === "ENOENT") {
          return [];
        }
        throw error;
      }
    }

    // Get recent logs from all files
    const indexPath = join(this.logsPath, "index.json");
    try {
      const indexData = await fs.readFile(indexPath, "utf8");
      const index = JSON.parse(indexData);

      // Sort log files by date (most recent first)
      const sortedFiles = index.logFiles.sort(
        (a: any, b: any) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      const allLogs: LogEntry[] = [];

      for (const file of sortedFiles.slice(0, limit || 7)) {
        // Get last 7 days or limit number of entries
        const logFile = join(this.logsPath, file.file);
        try {
          const logs: LogEntry[] = JSON.parse(
            await fs.readFile(logFile, "utf8"),
          );
          allLogs.push(...logs);
        } catch (error: any) {
          this.logger.warn(`Could not read log file ${file.file}`, error);
        }
      }

      // Sort by timestamp (newest first)
      allLogs.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return limit ? allLogs.slice(0, limit) : allLogs;
    } catch (error: any) {
      this.logger.error("Failed to get logs", error);
      return [];
    }
  }

  async searchLogs(
    query: string,
    level?: LogEntry["level"],
    service?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<LogEntry[]> {
    this.logger.info(`Searching logs: "${query}"`);

    const results: LogEntry[] = [];
    const indexPath = join(this.logsPath, "index.json");

    try {
      const indexData = await fs.readFile(indexPath, "utf8");
      const index = JSON.parse(indexData);

      for (const file of index.logFiles) {
        // Filter by date range if specified
        if (dateFrom && file.date < dateFrom) continue;
        if (dateTo && file.date > dateTo) continue;

        const logFile = join(this.logsPath, file.file);
        try {
          const logs: LogEntry[] = JSON.parse(
            await fs.readFile(logFile, "utf8"),
          );

          for (const entry of logs) {
            // Filter by level
            if (level && entry.level !== level) continue;

            // Filter by service
            if (service && entry.service !== service) continue;

            // Search in details and action
            const searchableText =
              `${entry.details} ${entry.action}`.toLowerCase();
            if (searchableText.includes(query.toLowerCase())) {
              results.push(entry);
            }
          }
        } catch (error: any) {
          this.logger.warn(`Could not read log file ${file.file}`, error);
        }
      }

      // Sort by timestamp (newest first)
      results.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      this.logger.info(`Found ${results.length} matching log entries`);
      return results;
    } catch (error: any) {
      this.logger.error("Failed to search logs", error);
      return [];
    }
  }

  async exportMarkdown(date: string): Promise<string> {
    const logFile = join(this.logsPath, `${date}.json`);
    const markdownFile = join(this.logsPath, `${date}-report.md`);

    try {
      const logs: LogEntry[] = JSON.parse(await fs.readFile(logFile, "utf8"));

      let markdown = `# Log Report for ${date}

Generated: ${new Date().toISOString()}
Total entries: ${logs.length}

---

`;

      logs.forEach((entry) => {
        markdown += `### [${entry.timestamp}] ${entry.level.toUpperCase()} - ${entry.service}

**Action**: ${entry.action}
**Details**: ${entry.details}

${
  entry.metadata
    ? `**Metadata**:\n${Object.entries(entry.metadata)
        .map(([key, value]) => `- ${key}: \`${JSON.stringify(value)}\``)
        .join("\n")}`
    : ""
}

---

`;
      });

      await fs.writeFile(markdownFile, markdown);
      this.logger.info(`Exported markdown report: ${markdownFile}`);

      return markdownFile;
    } catch (error: any) {
      this.logger.error("Failed to export markdown report", error);
      throw error;
    }
  }

  async cleanupOldLogs(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

    this.logger.info(
      `Cleaning up logs older than ${cutoffDateStr} (${this.retentionDays} days)`,
    );

    let deletedCount = 0;

    try {
      const indexPath = join(this.logsPath, "index.json");
      const indexData = JSON.parse(await fs.readFile(indexPath, "utf8"));

      const toDelete = indexData.logFiles.filter(
        (file: any) => file.date < cutoffDateStr,
      );

      // Delete old log files
      for (const file of toDelete) {
        const jsonFile = join(this.logsPath, file.file);
        const mdFile = join(this.logsPath, file.file.replace(".json", ".md"));

        try {
          await fs.unlink(jsonFile);
          deletedCount++;

          try {
            await fs.unlink(mdFile);
          } catch (error: any) {
            // Markdown file might not exist
          }
        } catch (error: any) {
          this.logger.warn(`Could not delete log file ${file.file}`, error);
        }
      }

      // Update index
      indexData.logFiles = indexData.logFiles.filter(
        (file: any) => file.date >= cutoffDateStr,
      );
      indexData.lastUpdated = new Date().toISOString();

      await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));

      this.logger.info(`Cleaned up ${deletedCount} old log entries`);
    } catch (error: any) {
      this.logger.error("Failed to cleanup old logs", error);
    }

    return deletedCount;
  }

  async getLogStats(): Promise<{
    totalEntries: number;
    dateRange: { earliest: string; latest: string } | null;
    filesCount: number;
    storageUsedMB: number;
  }> {
    const indexPath = join(this.logsPath, "index.json");

    try {
      const indexData = await fs.readFile(indexPath, "utf8");
      const index = JSON.parse(indexData);

      return {
        totalEntries: index.totalEntries,
        dateRange:
          index.logFiles.length > 0
            ? {
                earliest: index.logFiles[index.logFiles.length - 1].date,
                latest: index.logFiles[0].date,
              }
            : null,
        filesCount: index.logFiles.length,
        storageUsedMB: 0, // TODO: Calculate actual storage
      };
    } catch (error: any) {
      this.logger.error("Failed to get log stats", error);
      return {
        totalEntries: 0,
        dateRange: null,
        filesCount: 0,
        storageUsedMB: 0,
      };
    }
  }

  private async updateIndex(
    date: string,
    logFile: string,
    entryCount: number,
  ): Promise<void> {
    const indexPath = join(this.logsPath, "index.json");

    try {
      const indexData = await fs.readFile(indexPath, "utf8");
      const index = JSON.parse(indexData);

      const relativeFile = logFile
        .replace(this.logsPath, "")
        .replace(/^[/\\]/, "");

      // Check if date already exists
      const existingFile = index.logFiles.find((f: any) => f.date === date);
      if (existingFile) {
        existingFile.entryCount = entryCount;
        existingFile.lastModified = new Date().toISOString();
      } else {
        index.logFiles.push({
          date,
          file: relativeFile,
          entryCount,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        });
      }

      index.totalEntries = index.logFiles.reduce(
        (sum: number, file: any) => sum + file.entryCount,
        0,
      );
      index.lastUpdated = new Date().toISOString();

      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    } catch (error: any) {
      this.logger.error("Failed to update log index", error);
    }
  }

  getRetentionDays(): number {
    return this.retentionDays;
  }

  getLogsPath(): string {
    return this.logsPath;
  }

  async cleanup(): Promise<void> {
    this.logger.info("Log manager cleaned up");
  }
}

// Singleton instance
let logManagerInstance: LogManager | null = null;

export function getLogManager(vaultPath?: string): LogManager {
  if (!logManagerInstance) {
    logManagerInstance = new LogManager(vaultPath || ".obsidian-vault");
  }
  return logManagerInstance;
}
