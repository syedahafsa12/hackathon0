import { promises as fs } from "fs";
import { join } from "path";
import matter from "gray-matter";
import { Logger } from "../shared/logger";

export interface ApprovalMetadata {
  actionType: string;
  context: string;
  requestId: string;
  timestamp: string;
  decisionCriteria: string[];
  approvalThresholds: ApprovalThresholds;
  formatGuidelines: string[];
  approvalProcess: string[];
}

export interface ApprovalThresholds {
  autoApproveAmount?: number;
  groupReview?: string;
  executiveApproval?: string;
}

export class VaultManager {
  private vaultPath: string;
  private logger: Logger;
  private readonly folders = [
    "Needs_Action", // Incoming tasks from watchers
    "In_Progress", // Tasks being processed
    "Pending_Approval", // Awaiting human decision
    "Approved", // Ready for execution
    "Rejected", // User said no
    "Done", // Completed actions
    "Plans", // Multi-step AI plans (daily priorities)
    "Knowledge_Vault", // User notes and ideas
    "Briefings", // Weekly CEO reports
    "Logs", // Daily JSON logs
    "Backups", // System backups
  ];

  constructor(vaultPath: string = ".obsidian-vault") {
    this.vaultPath = vaultPath;
    this.logger = new Logger("VaultManager");
  }

  async initialize(): Promise<void> {
    this.logger.info("Initializing Obsidian vault...");

    // Create vault directory if it doesn't exist
    try {
      await fs.mkdir(this.vaultPath, { recursive: true });
    } catch (error) {
      this.logger.error("Failed to create vault directory", error);
      throw error;
    }

    // Create all required folders
    for (const folder of this.folders) {
      const folderPath = join(this.vaultPath, folder);
      try {
        await fs.mkdir(folderPath, { recursive: true });
        this.logger.info(`Created folder: ${folder}`);
      } catch (error) {
        this.logger.error(`Failed to create folder: ${folder}`, error);
      }
    }

    // Create initial files
    await this.createInitialFiles();

    this.logger.info("Vault initialization complete");
  }

  private async createInitialFiles(): Promise<void> {
    // Dashboard.md
    const dashboardPath = join(this.vaultPath, "Dashboard.md");
    if (!(await this.fileExists(dashboardPath))) {
      const dashboardContent = `# Mini Hafsa Dashboard

## System State
- **Last Updated**: ${new Date().toISOString()}
- **Active Agents**: 0
- **Pending Approvals**: 0
- **Completed Actions**: 0

## Financial Overview
- **Bank Balance**: $0.00
- **Recent Transactions**: None
- **Budget Status**: 0%

## Active Projects
- No active projects

## Pending Actions
- No pending actions

## Recent Activity
- No activity yet

## System Health
- **Database**: Connected
- **Obsidian Sync**: Active
- **API Connections**: All connected

## Next Steps
- Initialize system
- Review Company Handbook

---
*Last updated: ${new Date().toISOString()}*`;
      await fs.writeFile(dashboardPath, dashboardContent);
    }

    // Company_Handbook.md
    const handbookPath = join(this.vaultPath, "Company_Handbook.md");
    if (!(await this.fileExists(handbookPath))) {
      const handbookContent = `# Company Handbook - Mini Hafsa AI

## Approval Thresholds
- **Auto-Approve**: Actions under $50 or low-risk operations (calendar updates, note-taking)
- **Group Review**: Actions $50-$500 require team review
- **Executive Approval**: Actions over $500 or strategic changes
- **Emergency Override**: Life/business critical situations can be auto-approved

## Communication Style
- **Tone**: Professional yet friendly (Kawaii aesthetic)
- **Response Length**: Concise but complete
- **Format**: Markdown with proper headers and bullet points
- **Language**: Natural, conversational, avoid jargon

## Business Goals
1. Automate routine tasks while maintaining human oversight
2. Build comprehensive knowledge base
3. Ensure transparency and auditability
4. Maintain data privacy and security
5. Provide delightful user experience

## Operational Principles
- Always write reasoning to Markdown before action
- Never execute without explicit approval (when required)
- Log all actions with timestamps
- Reference past conversations when relevant
- Ask clarifying questions when uncertain

## Performance Standards
- Chat responses: Stream within 500ms
- Database queries: < 100ms
- File operations: < 50ms
- Page loads: < 2 seconds

## Emergency Procedures
- System failure: Check Logs folder and redacted error files
- Approval bottleneck: Review Emergency Override threshold
- Data corruption: Restore from latest backup in Backups folder

## Maintenance Schedule
- Daily: Dashboard review, approval processing
- Weekly: Knowledge vault organization, handbook updates
- Monthly: Performance review, system health check
- Quarterly: Constitution compliance review`;
      await fs.writeFile(handbookPath, handbookContent);
    }

    // Business Goals
    const goalsPath = join(this.vaultPath, "Business_Goals.md");
    if (!(await this.fileExists(goalsPath))) {
      const goalsContent = `# Business Goals - Mini Hafsa

## Primary Objectives
1. Automate routine tasks while maintaining human oversight
2. Eliminate decision fatigue through intelligent prioritization
3. Build comprehensive knowledge base for long-term learning
4. Ensure transparency and auditability in all AI actions
5. Provide delightful user experience with Kawaii aesthetic

## Key Metrics
- **Task Completion Rate**: Target 85%+ weekly
- **Response Time**: <500ms for chat streaming
- **Approval Turnaround**: <24 hours for pending items
- **Knowledge Entries**: Grow by 10+ entries weekly

## Monthly Goals
### Current Month
- [ ] Complete Obsidian integration
- [ ] Launch Priority Sorter Agent
- [ ] Implement autonomous task execution

### Next Month
- [ ] Full CEO Briefing functionality
- [ ] Advanced news curation
- [ ] Performance optimization

## Long-term Vision
Build the most helpful, transparent, and delightful AI employee that augments human capability without replacing human judgment.

---
*Last reviewed: ${new Date().toISOString().split("T")[0]}*`;
      await fs.writeFile(goalsPath, goalsContent);
    }

    // Manual approval template
    const templatePath = join(
      this.vaultPath,
      "Pending_Approval",
      "Manual_Approval_Template.md",
    );
    if (!(await this.fileExists(templatePath))) {
      const templateContent = `# Manual Approval Templates

## [ACTION_TYPE]-[CONTEXT]-[DATE]

### Context
[Brief description of what this action involves]

### Decision Criteria
[Key factors to consider]

### Approval Thresholds
- [ ] Below [AMOUNT] -> Auto-approve
- [ ] Requires discussion -> [GROUP]
- [ ] Complex impact -> [GROUP]

### Format Guidelines
- [ ] Include TCPA compliance notes
- [ ] Add cost/benefit analysis
- [ ] Specify timeline constraints

### Approval Process
1. Place in Pending_Approval folder
2. Copy to Approved after human review
3. Move to Done after implementation`;
      await fs.writeFile(templatePath, templateContent);
    }
  }

  async createApprovalFile(
    actionType: string,
    context: string,
    metadata: ApprovalMetadata,
    content: string,
  ): Promise<string> {
    const { v4: uuidv4 } = await import("uuid");
    const requestId = uuidv4();
    const timestamp = new Date().toISOString();
    const filename = `${actionType}_${context}_${timestamp.replace(/:/g, "-")}.md`;
    const filePath = join(this.vaultPath, "Pending_Approval", filename);

    const fileContent = `---
actionType: ${actionType}
context: ${context}
requestId: ${requestId}
timestamp: ${timestamp}
decisionCriteria: |
${metadata.decisionCriteria.map((criterion) => `  - ${criterion}`).join("\n")}
approvalThresholds:
${metadata.approvalThresholds.autoApproveAmount ? `  autoApproveAmount: ${metadata.approvalThresholds.autoApproveAmount}` : ""}
${metadata.approvalThresholds.groupReview ? `  groupReview: ${metadata.approvalThresholds.groupReview}` : ""}
${metadata.approvalThresholds.executiveApproval ? `  executiveApproval: ${metadata.approvalThresholds.executiveApproval}` : ""}
formatGuidelines: |
${metadata.formatGuidelines.map((guideline) => `  - ${guideline}`).join("\n")}
approvalProcess: |
${metadata.approvalProcess.map((step) => `  - ${step}`).join("\n")}
---

${content}
`;

    await fs.writeFile(filePath, fileContent);
    this.logger.info(`Created approval file: ${filename}`);

    return filePath;
  }

  async updateDashboard(content: string): Promise<void> {
    const dashboardPath = join(this.vaultPath, "Dashboard.md");
    const updatedContent = content.replace(
      "[TIMESTAMP]",
      new Date().toISOString(),
    );
    await fs.writeFile(dashboardPath, updatedContent);
    this.logger.info("Dashboard updated");
  }

  async logAction(
    actionType: string,
    details: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const date = timestamp.split("T")[0];
    const logPath = join(this.vaultPath, "Logs", `${date}.json`);

    const logEntry = {
      timestamp,
      actionType,
      details,
      metadata,
      vaultPath: this.vaultPath,
    };

    try {
      let existingLogs: any[] = [];
      try {
        const existingData = await fs.readFile(logPath, "utf8");
        existingLogs = JSON.parse(existingData);
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }

      existingLogs.push(logEntry);
      await fs.writeFile(logPath, JSON.stringify(existingLogs, null, 2));
      this.logger.info(`Logged action: ${actionType}`);
    } catch (error) {
      this.logger.error("Failed to log action", error);
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  getVaultPath(): string {
    return this.vaultPath;
  }

  getFolderPath(folder: string): string {
    return join(this.vaultPath, folder);
  }

  /**
   * Move a file from one folder to another
   */
  async moveFile(
    filename: string,
    fromFolder: string,
    toFolder: string,
  ): Promise<string> {
    const sourcePath = join(this.vaultPath, fromFolder, filename);
    const destPath = join(this.vaultPath, toFolder, filename);

    try {
      await fs.rename(sourcePath, destPath);
      this.logger.info(
        `Moved file ${filename} from ${fromFolder} to ${toFolder}`,
      );
      return destPath;
    } catch (error) {
      this.logger.error(`Failed to move file: ${filename}`, error as Error);
      throw error;
    }
  }

  /**
   * Read and parse a markdown file with frontmatter
   */
  async readMarkdownFile(
    filePath: string,
  ): Promise<{ data: any; content: string }> {
    try {
      const fileContent = await fs.readFile(filePath, "utf8");
      return matter(fileContent);
    } catch (error) {
      this.logger.error(`Failed to read markdown file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Write a markdown file with frontmatter
   */
  async writeMarkdownFile(
    folder: string,
    filename: string,
    frontmatter: Record<string, any>,
    content: string,
  ): Promise<string> {
    const filePath = join(this.vaultPath, folder, filename);
    const yamlFrontmatter = Object.entries(frontmatter)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}:\n${value.map((v) => `  - ${v}`).join("\n")}`;
        }
        return `${key}: ${value}`;
      })
      .join("\n");

    const fileContent = `---\n${yamlFrontmatter}\n---\n\n${content}`;
    await fs.writeFile(filePath, fileContent);
    this.logger.info(`Created file: ${folder}/${filename}`);
    return filePath;
  }

  /**
   * List all markdown files in a folder
   */
  async listFiles(folder: string): Promise<string[]> {
    const folderPath = join(this.vaultPath, folder);
    try {
      const files = await fs.readdir(folderPath);
      return files.filter((f) => f.endsWith(".md"));
    } catch (error) {
      this.logger.error(`Failed to list files in ${folder}`, error);
      return [];
    }
  }

  /**
   * Create an action file for approval
   */
  async createActionFile(
    actionType: string,
    actionId: string,
    userId: string,
    priority: "low" | "medium" | "high" | "critical",
    title: string,
    details: string,
  ): Promise<string> {
    const timestamp = new Date().toISOString();
    const filename = `${actionType.toUpperCase()}_${actionId}_${timestamp.replace(/:/g, "-").split(".")[0]}.md`;

    const frontmatter = {
      type: actionType,
      actionId,
      userId,
      priority,
      status: "pending_approval",
      createdAt: timestamp,
    };

    const content = `## Action: ${title}

${details}

## Approval Instructions
- Move this file to \`/Approved/\` to proceed
- Move to \`/Rejected/\` to cancel
`;

    return await this.writeMarkdownFile(
      "Pending_Approval",
      filename,
      frontmatter,
      content,
    );
  }

  /**
   * Create a plan file in Plans folder
   */
  async createPlanFile(
    planType: string,
    date: Date,
    content: string,
    metadata: Record<string, any> = {},
  ): Promise<string> {
    const dateStr = date.toISOString().split("T")[0];
    const filename = `${planType}_${dateStr}.md`;
    const filePath = join(this.vaultPath, "Plans", filename);

    await fs.writeFile(filePath, content);
    this.logger.info(`Created plan file: Plans/${filename}`);
    return filePath;
  }

  /**
   * Create a briefing file in Briefings folder
   */
  async createBriefingFile(
    briefingType: string,
    date: Date,
    content: string,
  ): Promise<string> {
    const dateStr = date.toISOString().split("T")[0];
    const filename = `${briefingType}_${dateStr}.md`;
    const filePath = join(this.vaultPath, "Briefings", filename);

    await fs.writeFile(filePath, content);
    this.logger.info(`Created briefing file: Briefings/${filename}`);
    return filePath;
  }
}

// Singleton instance for easy access
let vaultManagerInstance: VaultManager | null = null;

export function getVaultManager(vaultPath?: string): VaultManager {
  if (!vaultManagerInstance) {
    vaultManagerInstance = new VaultManager(vaultPath || ".obsidian-vault");
  }
  return vaultManagerInstance;
}
