import { promises as fs } from "fs";
import { join } from "path";
import { Logger } from "../shared/logger";
import {
  ApprovalWorkflowOrchestrator,
  WorkflowEvent,
} from "./ApprovalWorkflowOrchestrator";

export interface DashboardState {
  lastUpdated: string;
  activeAgents: number;
  pendingApprovals: number;
  completedActions: number;
  financialOverview: {
    bankBalance: string;
    recentTransactions: string[];
    budgetStatus: number;
  };
  activeProjects: Project[];
  pendingActions: PendingAction[];
  recentActivity: ActivityLog[];
  systemHealth: {
    database: "connected" | "disconnected";
    obsidianSync: "active" | "inactive";
    apiConnections: "all_connected" | "some_disconnected";
  };
  nextSteps: string[];
}

export interface Project {
  name: string;
  status: "active" | "completed" | "on_hold";
}

export interface PendingAction {
  description: string;
  status: "pending" | "approved" | "rejected";
}

export interface ActivityLog {
  timestamp: string;
  action: string;
  agent: string;
}

export class DashboardManager {
  private dashboardPath: string;
  private logger: Logger;
  private state: DashboardState;
  private readonly updateInterval = 30000; // 30 seconds
  private updateTimer?: NodeJS.Timeout;

  constructor(vaultPath: string) {
    this.dashboardPath = join(vaultPath, "Dashboard.md");
    this.logger = new Logger("DashboardManager");
    this.state = this.initializeDefaultState();
  }

  private initializeDefaultState(): DashboardState {
    return {
      lastUpdated: new Date().toISOString(),
      activeAgents: 0,
      pendingApprovals: 0,
      completedActions: 0,
      financialOverview: {
        bankBalance: "$0.00",
        recentTransactions: [],
        budgetStatus: 0,
      },
      activeProjects: [],
      pendingActions: [],
      recentActivity: [],
      systemHealth: {
        database: "connected",
        obsidianSync: "active",
        apiConnections: "all_connected",
      },
      nextSteps: [],
    };
  }

  async initialize(): Promise<void> {
    this.logger.info("Initializing Dashboard Manager...");

    // Check if dashboard file exists, create if not
    try {
      await fs.access(this.dashboardPath);
      this.logger.info("Dashboard.md found");
    } catch {
      this.logger.info("Creating new Dashboard.md");
      await this.createDefaultDashboard();
    }

    // Start automatic updates
    this.startAutoUpdates();
  }

  private async createDefaultDashboard(): Promise<void> {
    const defaultContent = `# Mini Hafsa Dashboard

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

    await fs.writeFile(this.dashboardPath, defaultContent);
  }

  private startAutoUpdates(): void {
    this.updateTimer = setInterval(async () => {
      try {
        await this.updateDashboard();
      } catch (error) {
        this.logger.error("Failed to auto-update dashboard", error);
      }
    }, this.updateInterval);

    this.logger.info(
      `Auto-updates started every ${this.updateInterval / 1000} seconds`,
    );
  }

  stopAutoUpdates(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
      this.logger.info("Auto-updates stopped");
    }
  }

  async updateDashboard(): Promise<void> {
    this.logger.info("Updating Dashboard.md...");

    // Update state with latest data
    this.state.lastUpdated = new Date().toISOString();
    this.state.pendingApprovals = await this.countPendingApprovals();

    // Generate markdown content
    const dashboardContent = this.generateDashboardContent();

    // Write to file
    try {
      await fs.writeFile(this.dashboardPath, dashboardContent);
      this.logger.info("Dashboard updated successfully");
    } catch (error) {
      this.logger.error("Failed to update Dashboard.md", error);
      throw error;
    }
  }

  private async countPendingApprovals(): Promise<number> {
    try {
      const pendingDir = this.dashboardPath.replace(
        "Dashboard.md",
        "Pending_Approval",
      );
      const files = await fs.readdir(pendingDir);
      return files.filter((file) => file.endsWith(".md")).length;
    } catch {
      return 0;
    }
  }

  private generateDashboardContent(): string {
    return `# Mini Hafsa Dashboard

## System State
- **Last Updated**: ${this.state.lastUpdated}
- **Active Agents**: ${this.state.activeAgents}
- **Pending Approvals**: ${this.state.pendingApprovals}
- **Completed Actions**: ${this.state.completedActions}

## Financial Overview
- **Bank Balance**: ${this.state.financialOverview.bankBalance}
- **Recent Transactions**: ${this.state.financialOverview.recentTransactions.join(", ") || "None"}
- **Budget Status**: ${this.state.financialOverview.budgetStatus}%

## Active Projects
${this.state.activeProjects.map((project) => `- ${project.name}: ${project.status}`).join("\n") || "- No active projects"}

## Pending Actions
${this.state.pendingActions.map((action) => `- ${action.description}: ${action.status}`).join("\n") || "- No pending actions"}

## Recent Activity
${this.state.recentActivity.map((activity) => `- ${activity.timestamp}: ${activity.action} by ${activity.agent}`).join("\n") || "- No activity yet"}

## System Health
- **Database**: ${this.state.systemHealth.database}
- **Obsidian Sync**: ${this.state.systemHealth.obsidianSync}
- **API Connections**: ${this.state.systemHealth.apiConnections}

## Next Steps
${this.state.nextSteps.map((step) => `- ${step}`).join("\n") || "- No next steps"}

---
*Last updated: ${this.state.lastUpdated}*`;
  }

  // Methods to update specific dashboard sections
  updateFinancialOverview(
    balance: string,
    transactions: string[],
    budgetStatus: number,
  ): void {
    this.state.financialOverview = {
      bankBalance: balance,
      recentTransactions: transactions,
      budgetStatus,
    };
  }

  updateActiveProjects(projects: Project[]): void {
    this.state.activeProjects = projects;
  }

  updatePendingActions(actions: PendingAction[]): void {
    this.state.pendingActions = actions;
  }

  updateRecentActivity(activity: ActivityLog[]): void {
    this.state.recentActivity = activity;
  }

  updateSystemHealth(health: {
    database: "connected" | "disconnected";
    obsidianSync: "active" | "inactive";
    apiConnections: "all_connected" | "some_disconnected";
  }): void {
    this.state.systemHealth = health;
  }

  updateNextSteps(steps: string[]): void {
    this.state.nextSteps = steps;
  }

  // Event handlers for workflow events
  handleWorkflowEvent(event: WorkflowEvent): void {
    switch (event.type) {
      case "approval_request":
        this.state.pendingApprovals++;
        this.state.pendingActions.push({
          description: `${event.actionType} - ${event.context}`,
          status: "pending",
        });
        break;

      case "approval_granted":
        this.state.pendingApprovals--;
        const approvedAction = this.state.pendingActions.find(
          (action) =>
            action.description === `${event.actionType} - ${event.context}`,
        );
        if (approvedAction) {
          approvedAction.status = "approved";
        }
        this.state.completedActions++;
        this.state.recentActivity.unshift({
          timestamp: event.timestamp,
          action: `${event.actionType} approved`,
          agent: "Human",
        });
        break;

      case "approval_denied":
        this.state.pendingApprovals--;
        const deniedAction = this.state.pendingActions.find(
          (action) =>
            action.description === `${event.actionType} - ${event.context}`,
        );
        if (deniedAction) {
          deniedAction.status = "rejected";
        }
        this.state.recentActivity.unshift({
          timestamp: event.timestamp,
          action: `${event.actionType} rejected`,
          agent: "Human",
        });
        break;

      case "workflow_complete":
        // No state change needed, just log activity
        this.state.recentActivity.unshift({
          timestamp: event.timestamp,
          action: `${event.actionType} workflow completed`,
          agent: "System",
        });
        break;
    }

    // Keep recent activity limited to last 10 items
    if (this.state.recentActivity.length > 10) {
      this.state.recentActivity = this.state.recentActivity.slice(0, 10);
    }
  }

  getState(): DashboardState {
    return { ...this.state };
  }

  async cleanup(): Promise<void> {
    this.stopAutoUpdates();
    this.logger.info("Dashboard Manager cleaned up");
  }
}

// Singleton instance
let dashboardManagerInstance: DashboardManager | null = null;

export function getDashboardManager(vaultPath?: string): DashboardManager {
  if (!dashboardManagerInstance) {
    dashboardManagerInstance = new DashboardManager(
      vaultPath || ".obsidian-vault",
    );
  }
  return dashboardManagerInstance;
}
