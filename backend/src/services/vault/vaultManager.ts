/**
 * Vault Manager Service
 *
 * Singleton service managing all Obsidian vault operations.
 * Implements Constitution Principle III: Obsidian as Nerve Center.
 *
 * Features:
 * - Creates vault structure on first run
 * - Atomic file writes (temp file + rename)
 * - Thread-safe operations via mutex
 * - Graceful degradation with write queue
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Mutex } from 'async-mutex';
import {
  VaultConfig,
  VaultStatus,
  VaultOperationResult,
  QueuedWriteOperation,
  VAULT_FOLDERS,
} from '../../types/vault';
import { FOLDER_DEFINITIONS, getWatchedFolders } from './folderConfig';

class VaultManager {
  private static instance: VaultManager;
  private vaultPath: string;
  private initialized: boolean = false;
  private writeMutex: Mutex;
  private writeQueue: QueuedWriteOperation[] = [];
  private queueProcessorInterval: NodeJS.Timeout | null = null;
  private maxRetries: number = 5;
  private retryDelayMs: number = 10000;

  private constructor() {
    this.vaultPath = process.env.VAULT_PATH || './obsidian-vault';
    this.writeMutex = new Mutex();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): VaultManager {
    if (!VaultManager.instance) {
      VaultManager.instance = new VaultManager();
    }
    return VaultManager.instance;
  }

  /**
   * Initialize vault - creates structure if needed
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log(`[VaultManager] Initializing vault at ${this.vaultPath}`);
    await this.ensureVaultStructure();

    // Start queue processor for graceful degradation
    this.startQueueProcessor();

    this.initialized = true;
    console.log('[VaultManager] Vault initialized successfully');
  }

  /**
   * Get absolute path to vault
   */
  public getVaultPath(): string {
    return path.resolve(this.vaultPath);
  }

  /**
   * Ensure vault structure exists with all folders
   */
  public async ensureVaultStructure(): Promise<void> {
    const absolutePath = this.getVaultPath();

    // Create root vault directory
    await fs.mkdir(absolutePath, { recursive: true });

    // Create all folders and their README files
    for (const folder of FOLDER_DEFINITIONS) {
      const folderPath = path.join(absolutePath, folder.name);
      await fs.mkdir(folderPath, { recursive: true });

      // Create README file
      const readmePath = path.join(folderPath, '_README.md');
      try {
        await fs.access(readmePath);
      } catch {
        // README doesn't exist, create it
        await fs.writeFile(readmePath, folder.readmeContent, 'utf-8');
      }
    }

    // Create root files if they don't exist
    await this.createInitialDashboard();
    await this.createInitialHandbook();
    await this.createInitialBusinessGoals();
    await this.createObsidianConfig();

    console.log(`[VaultManager] Vault structure ensured at ${absolutePath}`);
  }

  /**
   * Write file atomically (temp file + rename)
   */
  public async writeFile(
    relativePath: string,
    content: string
  ): Promise<VaultOperationResult> {
    const release = await this.writeMutex.acquire();
    const startTime = Date.now();

    try {
      const absolutePath = path.join(this.getVaultPath(), relativePath);
      const dir = path.dirname(absolutePath);

      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      // Write to temp file first
      const tempPath = `${absolutePath}.tmp`;
      await fs.writeFile(tempPath, content, 'utf-8');

      // Atomic rename
      await fs.rename(tempPath, absolutePath);

      return {
        success: true,
        path: relativePath,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[VaultManager] Write failed: ${errorMessage}`);

      // Queue for retry
      this.queueWrite(relativePath, content, 'write');

      return {
        success: false,
        path: relativePath,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      };
    } finally {
      release();
    }
  }

  /**
   * Read file from vault
   */
  public async readFile(relativePath: string): Promise<string | null> {
    try {
      const absolutePath = path.join(this.getVaultPath(), relativePath);
      return await fs.readFile(absolutePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Move file between folders
   */
  public async moveFile(
    fromPath: string,
    toFolder: string
  ): Promise<VaultOperationResult> {
    const release = await this.writeMutex.acquire();
    const startTime = Date.now();

    try {
      const fromAbsolute = path.join(this.getVaultPath(), fromPath);
      const filename = path.basename(fromPath);
      const toAbsolute = path.join(this.getVaultPath(), toFolder, filename);

      // Ensure destination folder exists
      await fs.mkdir(path.join(this.getVaultPath(), toFolder), { recursive: true });

      // Move file
      await fs.rename(fromAbsolute, toAbsolute);

      return {
        success: true,
        path: path.join(toFolder, filename),
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[VaultManager] Move failed: ${errorMessage}`);

      return {
        success: false,
        path: fromPath,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      };
    } finally {
      release();
    }
  }

  /**
   * Delete file from vault
   */
  public async deleteFile(relativePath: string): Promise<VaultOperationResult> {
    const release = await this.writeMutex.acquire();
    const startTime = Date.now();

    try {
      const absolutePath = path.join(this.getVaultPath(), relativePath);
      await fs.unlink(absolutePath);

      return {
        success: true,
        path: relativePath,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        path: relativePath,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      };
    } finally {
      release();
    }
  }

  /**
   * List files in a folder
   */
  public async listFiles(folder: string, pattern?: RegExp): Promise<string[]> {
    try {
      const folderPath = path.join(this.getVaultPath(), folder);
      const files = await fs.readdir(folderPath);

      // Filter by pattern if provided, exclude README files
      return files.filter(file => {
        if (file.startsWith('_')) return false;
        if (pattern && !pattern.test(file)) return false;
        return true;
      });
    } catch {
      return [];
    }
  }

  /**
   * Check if file exists
   */
  public async fileExists(relativePath: string): Promise<boolean> {
    try {
      const absolutePath = path.join(this.getVaultPath(), relativePath);
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get vault status
   */
  public async getStatus(): Promise<VaultStatus> {
    const folders: VaultStatus['folders'] = [];

    for (const folder of FOLDER_DEFINITIONS) {
      const folderPath = path.join(this.getVaultPath(), folder.name);
      let exists = false;
      let fileCount = 0;

      try {
        const files = await fs.readdir(folderPath);
        exists = true;
        fileCount = files.filter(f => !f.startsWith('_') && f.endsWith('.md')).length;
      } catch {
        exists = false;
      }

      folders.push({
        name: folder.name,
        fileCount,
        exists,
      });
    }

    const healthy = folders.every(f => f.exists);

    return {
      healthy,
      path: this.getVaultPath(),
      lastChecked: new Date(),
      folders,
      pendingWrites: this.writeQueue.length,
    };
  }

  /**
   * Get configuration
   */
  public getConfig(): VaultConfig {
    return {
      path: this.getVaultPath(),
      folders: FOLDER_DEFINITIONS,
      watchedFolders: getWatchedFolders(),
    };
  }

  /**
   * Queue a write operation for retry
   */
  private queueWrite(path: string, content: string, operation: 'write' | 'move' | 'delete'): void {
    this.writeQueue.push({
      path,
      content,
      retries: 0,
      lastAttempt: new Date(),
      operation,
    });
    console.log(`[VaultManager] Queued ${operation} for ${path}, queue size: ${this.writeQueue.length}`);
  }

  /**
   * Start queue processor for retrying failed writes
   */
  private startQueueProcessor(): void {
    if (this.queueProcessorInterval) return;

    this.queueProcessorInterval = setInterval(async () => {
      if (this.writeQueue.length === 0) return;

      const now = new Date();
      const toProcess = this.writeQueue.filter(op => {
        const timeSinceLastAttempt = now.getTime() - op.lastAttempt.getTime();
        return timeSinceLastAttempt >= this.retryDelayMs;
      });

      for (const op of toProcess) {
        if (op.retries >= this.maxRetries) {
          console.error(`[VaultManager] Max retries exceeded for ${op.path}, removing from queue`);
          this.writeQueue = this.writeQueue.filter(o => o !== op);
          continue;
        }

        console.log(`[VaultManager] Retrying ${op.operation} for ${op.path} (attempt ${op.retries + 1})`);
        op.retries++;
        op.lastAttempt = new Date();

        if (op.operation === 'write') {
          const result = await this.writeFile(op.path, op.content);
          if (result.success) {
            this.writeQueue = this.writeQueue.filter(o => o !== op);
            console.log(`[VaultManager] Retry successful for ${op.path}`);
          }
        }
      }
    }, 5000);
  }

  /**
   * Stop queue processor
   */
  public stopQueueProcessor(): void {
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval);
      this.queueProcessorInterval = null;
    }
  }

  /**
   * Create initial Dashboard.md
   */
  private async createInitialDashboard(): Promise<void> {
    const dashboardPath = path.join(this.getVaultPath(), 'Dashboard.md');
    try {
      await fs.access(dashboardPath);
    } catch {
      const content = `# Mini Hafsa Dashboard

*Last updated: ${new Date().toISOString()}*

## Today's Summary

| Metric | Count |
|--------|-------|
| Pending Approvals | 0 |
| Completed Today | 0 |
| Failed Today | 0 |
| Upcoming Reminders | 0 |

## Pending Approvals

*No pending approvals*

## Recent Actions

*No recent actions*

## Active Projects

*No active projects*

## Quick Stats

- Total Emails: 0
- Total Tasks: 0
- Total Knowledge Entries: 0

---

<!-- USER: notes -->
## My Notes

*Add your personal notes here - this section won't be overwritten*

<!-- /USER: notes -->

<!-- USER: goals -->
## My Goals

*Add your goals here - this section won't be overwritten*

<!-- /USER: goals -->
`;
      await fs.writeFile(dashboardPath, content, 'utf-8');
    }
  }

  /**
   * Create initial Company_Handbook.md
   */
  private async createInitialHandbook(): Promise<void> {
    const handbookPath = path.join(this.getVaultPath(), 'Company_Handbook.md');
    try {
      await fs.access(handbookPath);
    } catch {
      const content = `# Company Handbook

This file defines how Mini Hafsa should behave. Edit these sections to customize behavior.

## Auto-Approve Rules

Actions matching these rules will be executed immediately without approval:

- Task creation for internal notes: auto-approve
- Knowledge saving: auto-approve
- Calendar events with no external attendees: auto-approve

## Approval Timeouts

| Action Type | Timeout |
|-------------|---------|
| EMAIL_SEND | 24 hours |
| LINKEDIN_POST | 24 hours |
| CALENDAR_CREATE | 4 hours |
| TASK_CREATE | 4 hours |
| REMINDER_CREATE | 4 hours |
| KNOWLEDGE_SAVE | 24 hours |

## Communication Style

- **Tone**: Friendly but professional
- **Sign-off**: "Best regards"
- **Language**: English (US)

## Current Priorities

1. **Client deliverables** - Weight: 10
2. **Internal meetings** - Weight: 5
3. **Learning & development** - Weight: 3
4. **Administrative tasks** - Weight: 1

## Blocked Actions

The following actions will never be executed:

- BULK_EMAIL (more than 10 recipients)
- DELETE_ALL_DATA
`;
      await fs.writeFile(handbookPath, content, 'utf-8');
    }
  }

  /**
   * Create initial Business_Goals.md
   */
  private async createInitialBusinessGoals(): Promise<void> {
    const goalsPath = path.join(this.getVaultPath(), 'Business_Goals.md');
    try {
      await fs.access(goalsPath);
    } catch {
      const content = `# Business Goals

Track your objectives and key results here.

## Q1 Objectives

### Objective 1: [Your first objective]

**Key Results:**
- [ ] KR1: [Measurable result]
- [ ] KR2: [Measurable result]
- [ ] KR3: [Measurable result]

### Objective 2: [Your second objective]

**Key Results:**
- [ ] KR1: [Measurable result]
- [ ] KR2: [Measurable result]

## Metrics to Track

| Metric | Current | Target | Progress |
|--------|---------|--------|----------|
| Revenue | $0 | $X | 0% |
| Customers | 0 | X | 0% |
| NPS | - | 50+ | - |

## Notes

*Add strategic notes and insights here*
`;
      await fs.writeFile(goalsPath, content, 'utf-8');
    }
  }

  /**
   * Create minimal .obsidian config
   */
  private async createObsidianConfig(): Promise<void> {
    const obsidianDir = path.join(this.getVaultPath(), '.obsidian');
    await fs.mkdir(obsidianDir, { recursive: true });

    const configPath = path.join(obsidianDir, 'app.json');
    try {
      await fs.access(configPath);
    } catch {
      const config = {
        alwaysUpdateLinks: true,
        newFileLocation: 'folder',
        newFileFolderPath: 'Knowledge_Vault',
        showUnsupportedFiles: false,
        attachmentFolderPath: '.attachments',
      };
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    }
  }

  /**
   * Shutdown - cleanup resources
   */
  public async shutdown(): Promise<void> {
    this.stopQueueProcessor();

    // Process remaining queue items
    if (this.writeQueue.length > 0) {
      console.log(`[VaultManager] Processing ${this.writeQueue.length} queued writes before shutdown`);
      for (const op of this.writeQueue) {
        if (op.operation === 'write') {
          await this.writeFile(op.path, op.content);
        }
      }
    }

    console.log('[VaultManager] Shutdown complete');
  }
}

// Export singleton instance
const vaultManager = VaultManager.getInstance();
export default vaultManager;
export { VaultManager };
