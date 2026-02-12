import chokidar from "chokidar";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import config from "../config";
import { orchestrator } from "../core/orchestrator";

/**
 * FileWatcher - Hackathon 0 Principle #3 (Obsidian as Nerve Center)
 * Monitors the 'Approved' folder in the Obsidian vault and triggers approvals.
 */
export class FileWatcher {
  private watcher: any = null;
  private vaultPath: string;
  private approvedPath: string;
  private inProgressPath: string;
  private donePath: string;

  constructor() {
    this.vaultPath = path.resolve(config.vaultPath);
    this.approvedPath = path.join(this.vaultPath, "Approved");
    this.inProgressPath = path.join(this.vaultPath, "In_Progress");
    this.donePath = path.join(this.vaultPath, "Done");

    this.ensureDirectories();
  }

  private ensureDirectories() {
    [this.approvedPath, this.inProgressPath, this.donePath].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[FileWatcher] Created directory: ${dir}`);
      }
    });
  }

  public start() {
    console.log(`[FileWatcher] Starting to watch: ${this.approvedPath}`);

    this.watcher = chokidar.watch(this.approvedPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      depth: 0, // only watch root of Approved folder
    });

    this.watcher.on("add", (filePath) => this.handleNewFile(filePath));
  }

  private async handleNewFile(filePath: string) {
    const fileName = path.basename(filePath);
    if (!fileName.endsWith(".md")) return;

    try {
      console.log(`[FileWatcher] Detected new approval file: ${fileName}`);
      const content = fs.readFileSync(filePath, "utf8");

      // Parse YAML frontmatter
      const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
      if (!match) {
        console.warn(`[FileWatcher] No frontmatter found in ${fileName}`);
        return;
      }

      const data: any = yaml.load(match[1]);
      const actionId = data.actionId || data.id;

      if (!actionId) {
        console.warn(
          `[FileWatcher] No actionId found in frontmatter for ${fileName}`,
        );
        return;
      }

      console.log(`[FileWatcher] Triggering approval for action: ${actionId}`);

      // Move to In_Progress before processing
      const inProgressFile = path.join(this.inProgressPath, fileName);
      fs.renameSync(filePath, inProgressFile);

      // Trigger orchestrator
      const success = await orchestrator.processApproval(actionId, "approved");

      if (success) {
        console.log(`[FileWatcher] Action ${actionId} approved successfully`);
        // Move to Done
        const doneFile = path.join(this.donePath, fileName);
        if (fs.existsSync(inProgressFile)) {
          fs.renameSync(inProgressFile, doneFile);
        }
      } else {
        console.error(
          `[FileWatcher] Failed to process approval for ${actionId}`,
        );
        // Optionally move back to parent or keep in In_Progress with error
      }
    } catch (err) {
      console.error(`[FileWatcher] Error handling file ${fileName}:`, err);
    }
  }

  public stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

export const fileWatcher = new FileWatcher();
export default fileWatcher;
