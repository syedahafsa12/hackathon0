/**
 * CEO Briefing Agent
 *
 * Weekly autonomous performance analysis that provides actionable insights.
 * Runs every Sunday at 8 PM.
 *
 * Features:
 * - Multi-source data collection
 * - KPI calculation
 * - Bottleneck detection
 * - AI-generated recommendations
 * - Obsidian vault integration
 */

import { PrismaClient } from "@prisma/client";
import { StructuredLogger } from "../../core/logging/structuredLogger";
import { getVaultManager } from "../../vault/VaultManager";

const prisma = new PrismaClient();

export interface WeekMetrics {
  taskCompletion: {
    completed: number;
    pending: number;
    total: number;
    rate: number; // percentage
  };
  calendar: {
    totalEvents: number;
    meetingHours: number;
    deepWorkHours: number;
  };
  emails: {
    sent: number;
    averageResponseTimeHours: number;
  };
  approvals: {
    total: number;
    approved: number;
    rejected: number;
    averageDecisionTimeHours: number;
  };
  knowledge: {
    entriesAdded: number;
  };
}

export interface Bottleneck {
  taskTitle: string;
  expectedDays: number;
  actualDays: number;
  delay: number;
  rootCause?: string;
}

export interface Suggestion {
  type: "cost" | "process" | "automation";
  title: string;
  description: string;
  potentialSavings?: string;
  priority: "high" | "medium" | "low";
}

export interface BriefingResult {
  success: boolean;
  briefing?: {
    weekStart: Date;
    weekEnd: Date;
    metrics: WeekMetrics;
    highlights: string[];
    bottlenecks: Bottleneck[];
    upcomingDeadlines: Array<{ title: string; dueDate: Date; daysUntil: number }>;
    suggestions: Suggestion[];
    filePath: string;
  };
  error?: string;
}

export class CEOBriefingAgent {
  private logger: StructuredLogger;
  private vaultManager: ReturnType<typeof getVaultManager>;

  constructor() {
    this.logger = new StructuredLogger("ceo-briefing-agent");
    this.vaultManager = getVaultManager();
  }

  /**
   * Generate weekly CEO briefing
   */
  async generateBriefing(userId: string): Promise<BriefingResult> {
    const timer = this.logger.startTimer();

    // Calculate week range (last Sunday to this Sunday)
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(now.getDate() - now.getDay()); // Last Sunday
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6); // 7 days back
    startDate.setHours(0, 0, 0, 0);

    this.logger.info("generate:start", {
      userId,
      data: {
        weekStart: startDate.toISOString(),
        weekEnd: endDate.toISOString(),
      },
    });

    try {
      // 1. Collect data
      const metrics = await this.collectWeekData(userId, startDate, endDate);

      // 2. Detect bottlenecks
      const bottlenecks = await this.detectBottlenecks(userId, startDate, endDate);

      // 3. Get upcoming deadlines
      const upcomingDeadlines = await this.getUpcomingDeadlines(userId);

      // 4. Generate highlights
      const highlights = this.generateHighlights(metrics, bottlenecks);

      // 5. Generate suggestions
      const suggestions = await this.generateSuggestions(metrics, bottlenecks);

      // 6. Create briefing file
      const filePath = await this.createBriefingFile(
        userId,
        startDate,
        endDate,
        metrics,
        highlights,
        bottlenecks,
        upcomingDeadlines,
        suggestions
      );

      // 7. Save to database
      await this.saveBriefing(
        userId,
        startDate,
        endDate,
        metrics,
        bottlenecks,
        suggestions,
        filePath
      );

      const durationMs = timer();
      this.logger.info("generate:complete", { userId, durationMs });

      return {
        success: true,
        briefing: {
          weekStart: startDate,
          weekEnd: endDate,
          metrics,
          highlights,
          bottlenecks,
          upcomingDeadlines,
          suggestions,
          filePath,
        },
      };
    } catch (error) {
      const durationMs = timer();
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error("generate:error", errorMessage, { userId, durationMs });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Collect data for the week
   */
  private async collectWeekData(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<WeekMetrics> {
    // Tasks
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        OR: [
          { completedAt: { gte: startDate, lte: endDate } },
          { createdAt: { gte: startDate, lte: endDate } },
        ],
      },
    });

    const completedTasks = tasks.filter((t) => t.status === "completed");
    const pendingTasks = tasks.filter((t) => t.status !== "completed");

    // Calendar events
    const events = await prisma.calendarEvent.findMany({
      where: {
        userId,
        startTime: { gte: startDate, lte: endDate },
      },
    });

    const meetingHours = events.reduce((sum, event) => {
      const duration =
        (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60 * 60);
      return sum + duration;
    }, 0);

    // Assume 8 hours workday x 5 days = 40 hours
    const totalWorkHours = 40;
    const deepWorkHours = totalWorkHours - meetingHours;

    // Approvals
    const approvals = await prisma.approval.findMany({
      where: {
        userId,
        requestedAt: { gte: startDate, lte: endDate },
      },
    });

    const approvedCount = approvals.filter((a) => a.status === "approved").length;
    const rejectedCount = approvals.filter((a) => a.status === "rejected").length;

    // Calculate average decision time for responded approvals
    const respondedApprovals = approvals.filter((a) => a.respondedAt);
    const avgDecisionTime =
      respondedApprovals.length > 0
        ? respondedApprovals.reduce((sum, a) => {
            const hours =
              (a.respondedAt!.getTime() - a.requestedAt.getTime()) /
              (1000 * 60 * 60);
            return sum + hours;
          }, 0) / respondedApprovals.length
        : 0;

    // Knowledge entries
    const knowledgeEntries = await prisma.knowledgeEntry.count({
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    return {
      taskCompletion: {
        completed: completedTasks.length,
        pending: pendingTasks.length,
        total: tasks.length,
        rate:
          tasks.length > 0
            ? Math.round((completedTasks.length / tasks.length) * 100)
            : 0,
      },
      calendar: {
        totalEvents: events.length,
        meetingHours: Math.round(meetingHours * 10) / 10,
        deepWorkHours: Math.round(deepWorkHours * 10) / 10,
      },
      emails: {
        sent: 0, // Would come from EmailMessage table
        averageResponseTimeHours: 0,
      },
      approvals: {
        total: approvals.length,
        approved: approvedCount,
        rejected: rejectedCount,
        averageDecisionTimeHours: Math.round(avgDecisionTime * 10) / 10,
      },
      knowledge: {
        entriesAdded: knowledgeEntries,
      },
    };
  }

  /**
   * Detect bottlenecks
   */
  private async detectBottlenecks(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Bottleneck[]> {
    const bottlenecks: Bottleneck[] = [];

    // Find tasks that took longer than expected (> 5 days)
    const completedTasks = await prisma.task.findMany({
      where: {
        userId,
        status: "completed",
        completedAt: { gte: startDate, lte: endDate },
      },
    });

    for (const task of completedTasks) {
      if (task.completedAt && task.createdAt) {
        const durationDays = Math.ceil(
          (task.completedAt.getTime() - task.createdAt.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (durationDays > 5) {
          bottlenecks.push({
            taskTitle: task.title,
            expectedDays: 2, // Assume 2 days expected
            actualDays: durationDays,
            delay: durationDays - 2,
            rootCause: "Took longer than expected to complete",
          });
        }
      }
    }

    // Find approvals that took too long
    const slowApprovals = await prisma.approval.findMany({
      where: {
        userId,
        respondedAt: { gte: startDate, lte: endDate },
      },
    });

    for (const approval of slowApprovals) {
      if (approval.respondedAt) {
        const hoursToDecision =
          (approval.respondedAt.getTime() - approval.requestedAt.getTime()) /
          (1000 * 60 * 60);

        if (hoursToDecision > 24) {
          const actionData = JSON.parse(approval.actionData);
          bottlenecks.push({
            taskTitle: `Approval: ${approval.actionType}`,
            expectedDays: 1,
            actualDays: Math.ceil(hoursToDecision / 24),
            delay: Math.ceil(hoursToDecision / 24) - 1,
            rootCause: "Approval decision delayed",
          });
        }
      }
    }

    return bottlenecks.slice(0, 5); // Limit to top 5
  }

  /**
   * Get upcoming deadlines
   */
  private async getUpcomingDeadlines(
    userId: string
  ): Promise<Array<{ title: string; dueDate: Date; daysUntil: number }>> {
    const now = new Date();
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(now.getDate() + 14);

    const tasks = await prisma.task.findMany({
      where: {
        userId,
        status: { not: "completed" },
        dueDate: {
          gte: now,
          lte: twoWeeksLater,
        },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    });

    return tasks.map((task) => ({
      title: task.title,
      dueDate: task.dueDate!,
      daysUntil: Math.ceil(
        (task.dueDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));
  }

  /**
   * Generate highlights
   */
  private generateHighlights(
    metrics: WeekMetrics,
    bottlenecks: Bottleneck[]
  ): string[] {
    const highlights: string[] = [];

    if (metrics.taskCompletion.rate >= 80) {
      highlights.push(
        `Strong week with ${metrics.taskCompletion.rate}% task completion rate`
      );
    }

    if (metrics.calendar.deepWorkHours > 30) {
      highlights.push(
        `Good focus time: ${metrics.calendar.deepWorkHours} hours of deep work`
      );
    }

    if (bottlenecks.length === 0) {
      highlights.push("No significant bottlenecks detected - excellent!");
    }

    if (metrics.knowledge.entriesAdded > 5) {
      highlights.push(
        `Knowledge base growing: ${metrics.knowledge.entriesAdded} new entries`
      );
    }

    if (metrics.approvals.total > 0) {
      const approvalRate = Math.round(
        (metrics.approvals.approved / metrics.approvals.total) * 100
      );
      if (approvalRate > 90) {
        highlights.push(
          `${approvalRate}% approval rate - smooth workflow`
        );
      }
    }

    // If no highlights, add encouraging message
    if (highlights.length === 0) {
      highlights.push("Week in progress - keep building momentum!");
    }

    return highlights;
  }

  /**
   * Generate suggestions
   */
  private async generateSuggestions(
    metrics: WeekMetrics,
    bottlenecks: Bottleneck[]
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // Process improvement suggestions based on bottlenecks
    if (bottlenecks.length > 0) {
      suggestions.push({
        type: "process",
        title: "Address Recurring Bottlenecks",
        description: `${bottlenecks.length} bottleneck(s) detected this week. Consider creating templates or automation for repetitive tasks.`,
        priority: "high",
      });
    }

    // Meeting optimization
    if (
      metrics.calendar.meetingHours > 15 &&
      metrics.calendar.meetingHours > metrics.calendar.deepWorkHours
    ) {
      suggestions.push({
        type: "process",
        title: "Optimize Meeting Load",
        description: `${metrics.calendar.meetingHours} hours in meetings this week. Consider implementing no-meeting days or async alternatives.`,
        priority: "medium",
      });
    }

    // Task completion improvement
    if (metrics.taskCompletion.rate < 70) {
      suggestions.push({
        type: "process",
        title: "Improve Task Completion",
        description: `Task completion rate at ${metrics.taskCompletion.rate}%. Break down large tasks into smaller, actionable items.`,
        priority: "high",
      });
    }

    // Approval speed
    if (metrics.approvals.averageDecisionTimeHours > 12) {
      suggestions.push({
        type: "automation",
        title: "Speed Up Approvals",
        description: `Average approval time: ${metrics.approvals.averageDecisionTimeHours} hours. Consider setting up auto-approve rules for low-risk actions.`,
        priority: "medium",
      });
    }

    return suggestions;
  }

  /**
   * Create briefing file in vault
   */
  private async createBriefingFile(
    userId: string,
    startDate: Date,
    endDate: Date,
    metrics: WeekMetrics,
    highlights: string[],
    bottlenecks: Bottleneck[],
    upcomingDeadlines: Array<{ title: string; dueDate: Date; daysUntil: number }>,
    suggestions: Suggestion[]
  ): Promise<string> {
    const weekStr = `${startDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} - ${endDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;

    let content = `# Monday Morning CEO Briefing
**Week of ${weekStr}**

## Executive Summary
${highlights.map((h) => `- ${h}`).join("\n")}

## Key Metrics
- **Tasks Completed:** ${metrics.taskCompletion.completed} of ${metrics.taskCompletion.total} (${metrics.taskCompletion.rate}%)
- **Meeting Hours:** ${metrics.calendar.meetingHours} hours (${Math.round((metrics.calendar.meetingHours / 40) * 100)}% of time)
- **Deep Work Hours:** ${metrics.calendar.deepWorkHours} hours (${Math.round((metrics.calendar.deepWorkHours / 40) * 100)}% of time)
- **Approvals Processed:** ${metrics.approvals.total} (${metrics.approvals.approved} approved, ${metrics.approvals.rejected} rejected)
- **Knowledge Entries Added:** ${metrics.knowledge.entriesAdded}

`;

    // Bottlenecks section
    content += `## Bottlenecks\n`;
    if (bottlenecks.length === 0) {
      content += `No significant bottlenecks detected this week.\n\n`;
    } else {
      content += `| Task | Expected | Actual | Delay |\n`;
      content += `|------|----------|--------|-------|\n`;
      for (const b of bottlenecks) {
        content += `| ${b.taskTitle} | ${b.expectedDays} days | ${b.actualDays} days | +${b.delay} days |\n`;
      }
      content += "\n";
    }

    // Upcoming deadlines
    content += `## Upcoming Deadlines\n`;
    if (upcomingDeadlines.length === 0) {
      content += `No upcoming deadlines in the next 2 weeks.\n\n`;
    } else {
      for (const d of upcomingDeadlines) {
        content += `- **${d.title}**: ${d.dueDate.toLocaleDateString()} (${d.daysUntil} days)\n`;
      }
      content += "\n";
    }

    // Suggestions
    content += `## Proactive Suggestions\n\n`;
    if (suggestions.length === 0) {
      content += `No immediate action items - continue current trajectory!\n\n`;
    } else {
      for (const s of suggestions) {
        const priorityEmoji =
          s.priority === "high" ? "" : s.priority === "medium" ? "" : "";
        content += `### ${priorityEmoji} ${s.title}\n`;
        content += `${s.description}\n`;
        if (s.potentialSavings) {
          content += `*Potential savings: ${s.potentialSavings}*\n`;
        }
        content += "\n";
      }
    }

    content += `---\n*Generated by CEO Briefing Agent on ${new Date().toISOString()}*\n`;

    const filePath = await this.vaultManager.createBriefingFile(
      "CEO_Briefing",
      endDate,
      content
    );

    return filePath;
  }

  /**
   * Save briefing to database
   */
  private async saveBriefing(
    userId: string,
    weekStart: Date,
    weekEnd: Date,
    metrics: WeekMetrics,
    bottlenecks: Bottleneck[],
    suggestions: Suggestion[],
    filePath: string
  ): Promise<void> {
    await prisma.cEOBriefing.upsert({
      where: {
        userId_weekStartDate: {
          userId,
          weekStartDate: weekStart,
        },
      },
      update: {
        weekEndDate: weekEnd,
        metrics: JSON.stringify(metrics),
        bottlenecks: JSON.stringify(bottlenecks),
        suggestions: JSON.stringify(suggestions),
        filePath,
      },
      create: {
        userId,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        metrics: JSON.stringify(metrics),
        bottlenecks: JSON.stringify(bottlenecks),
        suggestions: JSON.stringify(suggestions),
        filePath,
      },
    });
  }

  /**
   * Get latest briefing
   */
  async getLatestBriefing(userId: string): Promise<BriefingResult["briefing"] | null> {
    const briefing = await prisma.cEOBriefing.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (!briefing) return null;

    return {
      weekStart: briefing.weekStartDate,
      weekEnd: briefing.weekEndDate,
      metrics: JSON.parse(briefing.metrics),
      highlights: [], // Would need to regenerate
      bottlenecks: JSON.parse(briefing.bottlenecks),
      upcomingDeadlines: [], // Would need to regenerate
      suggestions: JSON.parse(briefing.suggestions),
      filePath: briefing.filePath,
    };
  }

  /**
   * Get briefing history
   */
  async getBriefingHistory(
    userId: string,
    limit: number = 10
  ): Promise<Array<{ weekStart: Date; weekEnd: Date; createdAt: Date; filePath: string }>> {
    const briefings = await prisma.cEOBriefing.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        weekStartDate: true,
        weekEndDate: true,
        createdAt: true,
        filePath: true,
      },
    });

    return briefings.map((b) => ({
      weekStart: b.weekStartDate,
      weekEnd: b.weekEndDate,
      createdAt: b.createdAt,
      filePath: b.filePath,
    }));
  }
}

// Singleton instance
export const ceoBriefingAgent = new CEOBriefingAgent();
export default ceoBriefingAgent;
