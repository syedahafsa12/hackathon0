/**
 * Priority Sorter Agent
 *
 * Eliminates daily decision fatigue by automatically organizing tasks
 * into a clear, actionable priority list every morning.
 *
 * Features:
 * - Multi-source task collection (database + Obsidian)
 * - AI-powered priority analysis using Mistral
 * - Conflict detection for calendar events
 * - Dashboard integration
 * - Scheduled daily generation at 6 AM
 */

import { PrismaClient } from "@prisma/client";
import { StructuredLogger } from "../../core/logging/structuredLogger";
import { getVaultManager } from "../../vault/VaultManager";
import { getDashboardManager } from "../../vault/DashboardManager";

const prisma = new PrismaClient();

export interface CollectedTask {
  id: string;
  title: string;
  source: "database" | "obsidian";
  dueDate?: Date;
  priority?: "low" | "medium" | "high" | "critical";
  estimatedMinutes?: number;
  dependencies?: string[];
  category: "task" | "event" | "reminder";
  description?: string;
}

export interface PriorityResult {
  doNow: CollectedTask[];
  doNext: CollectedTask[];
  canWait: CollectedTask[];
}

export interface ConflictInfo {
  type: "time_overlap" | "overloaded_day" | "deadline_conflict";
  description: string;
  affectedItems: string[];
}

export class PrioritySorterAgent {
  private logger: StructuredLogger;
  private vaultManager: ReturnType<typeof getVaultManager>;

  constructor() {
    this.logger = new StructuredLogger("priority-sorter-agent");
    this.vaultManager = getVaultManager();
  }

  /**
   * Main entry point - generate priority plan for today
   */
  async generateDailyPriorities(userId: string): Promise<{
    success: boolean;
    filePath?: string;
    priorities?: PriorityResult;
    conflicts?: ConflictInfo[];
    error?: string;
  }> {
    const timer = this.logger.startTimer();
    this.logger.info("generate:start", { userId });

    try {
      // 1. Collect tasks from all sources
      const tasks = await this.collectTasks(userId);
      this.logger.info("collect:complete", {
        data: { taskCount: tasks.length },
      });

      // 2. Get today's calendar events
      const calendarEvents = await this.getCalendarEvents(userId);
      this.logger.info("calendar:fetched", {
        data: { eventCount: calendarEvents.length },
      });

      // 3. Detect conflicts
      const conflicts = await this.detectConflicts(tasks, calendarEvents);

      // 4. Analyze priorities using AI or heuristics
      const priorities = await this.analyzePriorities(tasks, calendarEvents);

      // 5. Generate plan file
      const filePath = await this.generatePlanFile(
        userId,
        priorities,
        calendarEvents,
        conflicts,
      );

      // 6. Update dashboard
      await this.updateDashboard(priorities);

      // 7. Save to database
      await this.savePriorityPlan(userId, priorities, calendarEvents, filePath);

      const durationMs = timer();
      this.logger.info("generate:complete", {
        userId,
        durationMs,
        data: {
          doNowCount: priorities.doNow.length,
          doNextCount: priorities.doNext.length,
          canWaitCount: priorities.canWait.length,
        },
      });

      return {
        success: true,
        filePath,
        priorities,
        conflicts,
      };
    } catch (error) {
      const durationMs = timer();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error("generate:error", errorMessage, { userId, durationMs });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Collect tasks from all sources
   */
  async collectTasks(userId: string): Promise<CollectedTask[]> {
    const tasks: CollectedTask[] = [];

    // Collect from database - pending tasks
    const dbTasks = await prisma.task.findMany({
      where: {
        userId,
        status: { in: ["pending", "in_progress"] },
      },
    });

    for (const task of dbTasks) {
      tasks.push({
        id: task.id,
        title: task.title,
        source: "database",
        dueDate: task.dueDate || undefined,
        priority: (task.priority as CollectedTask["priority"]) || "medium",
        category: "task",
        description: task.description || undefined,
      });
    }

    // Collect reminders due today or overdue in PKT
    const PKT_OFFSET = 5 * 60 * 60 * 1000;
    const nowUtc = new Date();
    const nowPkt = new Date(nowUtc.getTime() + PKT_OFFSET);

    const todayPktStartStr =
      nowPkt.toISOString().split("T")[0] + "T00:00:00.000Z";
    const todayPktStartInUtc = new Date(
      new Date(todayPktStartStr).getTime() - PKT_OFFSET,
    );

    const tomorrowPktStartStr =
      new Date(nowPkt.getTime() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0] + "T00:00:00.000Z";
    const tomorrowPktInUtc = new Date(
      new Date(tomorrowPktStartStr).getTime() - PKT_OFFSET,
    );

    const reminders = await prisma.reminder.findMany({
      where: {
        userId,
        status: "pending",
        remindAt: { lte: tomorrowPktInUtc },
      },
    });

    for (const reminder of reminders) {
      tasks.push({
        id: reminder.id,
        title: reminder.title,
        source: "database",
        dueDate: reminder.remindAt,
        priority: "high",
        category: "reminder",
        description: reminder.description || undefined,
      });
    }

    // Collect from Obsidian vault - Needs_Action folder
    try {
      const needsActionFiles =
        await this.vaultManager.listFiles("Needs_Action");
      for (const file of needsActionFiles) {
        if (file.endsWith(".md") && !file.includes("Template")) {
          const filePath =
            this.vaultManager.getFolderPath("Needs_Action") + "/" + file;
          try {
            const { data } = await this.vaultManager.readMarkdownFile(filePath);
            tasks.push({
              id: data.actionId || file,
              title: data.title || file.replace(".md", ""),
              source: "obsidian",
              priority: data.priority || "medium",
              category: "task",
              description: data.context || undefined,
            });
          } catch (e) {
            // Skip files that can't be parsed
          }
        }
      }
    } catch (e) {
      // Vault might not be initialized yet
    }

    // Collect from In_Progress folder
    try {
      const inProgressFiles = await this.vaultManager.listFiles("In_Progress");
      for (const file of inProgressFiles) {
        if (file.endsWith(".md") && !file.startsWith("RALPH_STATE")) {
          const filePath =
            this.vaultManager.getFolderPath("In_Progress") + "/" + file;
          try {
            const { data } = await this.vaultManager.readMarkdownFile(filePath);
            tasks.push({
              id: data.actionId || file,
              title: data.title || file.replace(".md", ""),
              source: "obsidian",
              priority: "high", // In progress = high priority
              category: "task",
              description: data.context || undefined,
            });
          } catch (e) {
            // Skip files that can't be parsed
          }
        }
      }
    } catch (e) {
      // Vault might not be initialized yet
    }

    return tasks;
  }

  /**
   * Get today's calendar events
   */
  async getCalendarEvents(userId: string): Promise<CollectedTask[]> {
    const PKT_OFFSET = 5 * 60 * 60 * 1000;
    const nowUtc = new Date();
    const nowPkt = new Date(nowUtc.getTime() + PKT_OFFSET);

    const todayPktStartStr =
      nowPkt.toISOString().split("T")[0] + "T00:00:00.000Z";
    const todayPktInUtc = new Date(
      new Date(todayPktStartStr).getTime() - PKT_OFFSET,
    );

    const tomorrowPktStartStr =
      new Date(nowPkt.getTime() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0] + "T00:00:00.000Z";
    const tomorrowPktInUtc = new Date(
      new Date(tomorrowPktStartStr).getTime() - PKT_OFFSET,
    );

    const events = await prisma.calendarEvent.findMany({
      where: {
        userId,
        startTime: {
          gte: todayPktInUtc,
          lt: tomorrowPktInUtc,
        },
      },
      orderBy: { startTime: "asc" },
    });

    return events.map((event) => ({
      id: event.id,
      title: event.title,
      source: "database" as const,
      dueDate: event.startTime,
      priority: "high" as const,
      category: "event" as const,
      description: event.description || undefined,
      estimatedMinutes: Math.round(
        (event.endTime.getTime() - event.startTime.getTime()) / 60000,
      ),
    }));
  }

  /**
   * Detect conflicts in schedule
   */
  async detectConflicts(
    tasks: CollectedTask[],
    events: CollectedTask[],
  ): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];

    // Check for time overlaps in events
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const event1 = events[i];
        const event2 = events[j];

        if (event1.dueDate && event2.dueDate && event1.estimatedMinutes) {
          const event1End = new Date(
            event1.dueDate.getTime() + event1.estimatedMinutes * 60000,
          );
          if (event1End > event2.dueDate) {
            conflicts.push({
              type: "time_overlap",
              description: `"${event1.title}" overlaps with "${event2.title}"`,
              affectedItems: [event1.id, event2.id],
            });
          }
        }
      }
    }

    // Check if total work exceeds 8 hours
    const totalMinutes =
      events.reduce((sum, e) => sum + (e.estimatedMinutes || 0), 0) +
      tasks.length * 30; // Estimate 30 min per task

    if (totalMinutes > 480) {
      // 8 hours
      conflicts.push({
        type: "overloaded_day",
        description: `Total estimated work (${Math.round(
          totalMinutes / 60,
        )} hours) exceeds 8 hours`,
        affectedItems: [],
      });
    }

    // Check for deadline conflicts (tasks due today but too many)
    const todayTasks = tasks.filter((t) => {
      if (!t.dueDate) return false;
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return t.dueDate <= today;
    });

    if (todayTasks.length > 5) {
      conflicts.push({
        type: "deadline_conflict",
        description: `${todayTasks.length} tasks are due today - consider prioritizing`,
        affectedItems: todayTasks.map((t) => t.id),
      });
    }

    return conflicts;
  }

  /**
   * Analyze priorities using heuristics (AI fallback)
   */
  async analyzePriorities(
    tasks: CollectedTask[],
    _events: CollectedTask[],
  ): Promise<PriorityResult> {
    const doNow: CollectedTask[] = [];
    const doNext: CollectedTask[] = [];
    const canWait: CollectedTask[] = [];

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() + 7);

    for (const task of tasks) {
      // Critical priority or overdue = Do Now
      if (task.priority === "critical") {
        doNow.push(task);
        continue;
      }

      // Due today = Do Now
      if (task.dueDate && task.dueDate <= today) {
        doNow.push(task);
        continue;
      }

      // High priority = Do Next
      if (task.priority === "high") {
        doNext.push(task);
        continue;
      }

      // Due this week = Do Next
      if (task.dueDate && task.dueDate <= thisWeek) {
        doNext.push(task);
        continue;
      }

      // Everything else = Can Wait
      canWait.push(task);
    }

    // Sort each category by due date, then priority
    const sortByPriority = (a: CollectedTask, b: CollectedTask) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (a.dueDate && b.dueDate) {
        return a.dueDate.getTime() - b.dueDate.getTime();
      }
      return (
        (priorityOrder[a.priority || "medium"] || 2) -
        (priorityOrder[b.priority || "medium"] || 2)
      );
    };

    doNow.sort(sortByPriority);
    doNext.sort(sortByPriority);
    canWait.sort(sortByPriority);

    return { doNow, doNext, canWait };
  }

  /**
   * Generate the priority plan markdown file
   */
  async generatePlanFile(
    userId: string,
    priorities: PriorityResult,
    events: CollectedTask[],
    conflicts: ConflictInfo[],
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const totalTasks =
      priorities.doNow.length +
      priorities.doNext.length +
      priorities.canWait.length;

    const estimatedHours = Math.round(
      (totalTasks * 30 +
        events.reduce((sum, e) => sum + (e.estimatedMinutes || 0), 0)) /
        60,
    );

    let content = `# Today's Priorities - ${dateStr}

---
date: ${today.toISOString().split("T")[0]}
generatedAt: ${today.toISOString()}
totalTasks: ${totalTasks}
estimatedHours: ${estimatedHours}
---

`;

    // Conflicts/Warnings section
    if (conflicts.length > 0) {
      content += `## Warnings\n\n`;
      for (const conflict of conflicts) {
        content += `- ${conflict.description}\n`;
      }
      content += "\n";
    }

    // Do Now section
    content += `## Do Now (Before 12 PM)\n\n`;
    if (priorities.doNow.length === 0) {
      content += `- No urgent tasks. Focus on important work!\n`;
    } else {
      for (const task of priorities.doNow) {
        const dueStr = task.dueDate
          ? ` (due ${task.dueDate.toLocaleDateString()})`
          : "";
        content += `- [ ] ${task.title}${dueStr}\n`;
      }
    }
    content += "\n";

    // Do Next section
    content += `## Do Next (Before End of Day)\n\n`;
    if (priorities.doNext.length === 0) {
      content += `- No important tasks pending. Consider tackling "Can Wait" items!\n`;
    } else {
      for (const task of priorities.doNext) {
        const dueStr = task.dueDate
          ? ` (due ${task.dueDate.toLocaleDateString()})`
          : "";
        content += `- [ ] ${task.title}${dueStr}\n`;
      }
    }
    content += "\n";

    // Can Wait section
    content += `## Can Wait (This Week)\n\n`;
    if (priorities.canWait.length === 0) {
      content += `- All caught up! Consider planning ahead.\n`;
    } else {
      for (const task of priorities.canWait) {
        content += `- [ ] ${task.title}\n`;
      }
    }
    content += "\n";

    // Calendar section
    content += `## Calendar Today\n\n`;
    if (events.length === 0) {
      content += `- No meetings scheduled. Deep work day!\n`;
    } else {
      for (const event of events) {
        const timeStr = event.dueDate
          ? event.dueDate.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        const durationStr = event.estimatedMinutes
          ? ` (${event.estimatedMinutes} min)`
          : "";
        content += `- ${timeStr} - ${event.title}${durationStr}\n`;
      }
    }
    content += "\n";

    // Footer
    content += `---\n*Generated by Priority Sorter Agent at ${today.toLocaleTimeString()}*\n`;

    // Save to vault
    const filePath = await this.vaultManager.createPlanFile(
      "Daily_Priority",
      today,
      content,
    );

    return filePath;
  }

  /**
   * Update dashboard with top priorities
   */
  async updateDashboard(priorities: PriorityResult): Promise<void> {
    const dashboardManager = getDashboardManager();
    const nextSteps = [
      ...priorities.doNow.map((t) => t.title),
      ...priorities.doNext.map((t) => t.title),
    ].slice(0, 5);

    dashboardManager.updateNextSteps(nextSteps);
    await dashboardManager.updateDashboard();

    this.logger.info("dashboard:updated", {
      data: { topPriorityCount: nextSteps.length },
    });
  }

  /**
   * Save priority plan to database
   */
  async savePriorityPlan(
    userId: string,
    priorities: PriorityResult,
    events: CollectedTask[],
    filePath: string,
  ): Promise<void> {
    const PKT_OFFSET = 5 * 60 * 60 * 1000;
    const nowUtc = new Date();
    const nowPkt = new Date(nowUtc.getTime() + PKT_OFFSET);

    const todayPktStartStr =
      nowPkt.toISOString().split("T")[0] + "T00:00:00.000Z";
    const todayPktInUtc = new Date(
      new Date(todayPktStartStr).getTime() - PKT_OFFSET,
    );

    const totalMinutes =
      priorities.doNow.length * 30 +
      priorities.doNext.length * 30 +
      priorities.canWait.length * 30 +
      events.reduce((sum, e) => sum + (e.estimatedMinutes || 0), 0);

    await prisma.priorityPlan.upsert({
      where: {
        userId_date: {
          userId,
          date: todayPktInUtc,
        },
      },
      update: {
        doNow: JSON.stringify(priorities.doNow),
        doNext: JSON.stringify(priorities.doNext),
        canWait: JSON.stringify(priorities.canWait),
        calendarEvents: JSON.stringify(events),
        estimatedHours: totalMinutes / 60,
        filePath,
        generatedAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        userId,
        date: todayPktInUtc,
        doNow: JSON.stringify(priorities.doNow),
        doNext: JSON.stringify(priorities.doNext),
        canWait: JSON.stringify(priorities.canWait),
        calendarEvents: JSON.stringify(events),
        estimatedHours: totalMinutes / 60,
        filePath,
      },
    });
  }

  /**
   * Get today's priority plan
   */
  async getTodaysPlan(userId: string): Promise<PriorityResult | null> {
    const PKT_OFFSET = 5 * 60 * 60 * 1000;
    const nowUtc = new Date();
    const nowPkt = new Date(nowUtc.getTime() + PKT_OFFSET);

    const todayPktStartStr =
      nowPkt.toISOString().split("T")[0] + "T00:00:00.000Z";
    const todayPktInUtc = new Date(
      new Date(todayPktStartStr).getTime() - PKT_OFFSET,
    );

    const plan = await prisma.priorityPlan.findUnique({
      where: {
        userId_date: {
          userId,
          date: todayPktInUtc,
        },
      },
    });

    if (!plan) return null;

    return {
      doNow: JSON.parse(plan.doNow),
      doNext: JSON.parse(plan.doNext),
      canWait: JSON.parse(plan.canWait),
    };
  }

  /**
   * Manual re-sort trigger
   */
  async resort(userId: string): Promise<{
    success: boolean;
    filePath?: string;
    priorities?: PriorityResult;
    error?: string;
  }> {
    this.logger.info("resort:triggered", { userId });
    return this.generateDailyPriorities(userId);
  }
}

// Singleton instance
export const prioritySorterAgent = new PrioritySorterAgent();
export default prioritySorterAgent;
