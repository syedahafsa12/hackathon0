/**
 * Agent Scheduler Service
 *
 * Uses node-cron to schedule agent executions:
 * - Priority Sorter: Daily at 6 AM
 * - CEO Briefing: Sunday at 8 PM
 */

import * as cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { StructuredLogger } from "../../core/logging/structuredLogger";
import { prioritySorterAgent } from "../../agents/prioritySorter";
import { ceoBriefingAgent } from "../../agents/ceoBriefing";

const prisma = new PrismaClient();

export class AgentScheduler {
  private logger: StructuredLogger;
  private scheduledTasks: cron.ScheduledTask[] = [];
  private defaultUserId: string = "dev-user-001";

  constructor() {
    this.logger = new StructuredLogger("agent-scheduler");
  }

  /**
   * Start all scheduled tasks
   */
  async start(): Promise<void> {
    this.logger.info("start", {});

    // Get default user (or first user in system)
    const user = await prisma.user.findFirst();
    if (user) {
      this.defaultUserId = user.id;
    }

    // Schedule Priority Sorter: Daily at 6 AM
    const priorityTask = cron.schedule(
      "0 6 * * *",
      async () => {
        await this.runPrioritySorter();
      }
    );
    this.scheduledTasks.push(priorityTask);
    this.logger.info("scheduled:priority_sorter", {
      data: { cron: "0 6 * * *", description: "Daily at 6 AM" },
    });

    // Schedule CEO Briefing: Sunday at 8 PM
    const briefingTask = cron.schedule(
      "0 20 * * 0",
      async () => {
        await this.runCEOBriefing();
      }
    );
    this.scheduledTasks.push(briefingTask);
    this.logger.info("scheduled:ceo_briefing", {
      data: { cron: "0 20 * * 0", description: "Sunday at 8 PM" },
    });

    // Check if we need to run Priority Sorter on startup
    await this.checkAndRunStartupTasks();

    this.logger.info("start:complete", {
      data: { tasksScheduled: this.scheduledTasks.length },
    });
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    this.logger.info("stop", {});

    for (const task of this.scheduledTasks) {
      task.stop();
    }
    this.scheduledTasks = [];

    this.logger.info("stop:complete", {});
  }

  /**
   * Check and run startup tasks if needed
   */
  private async checkAndRunStartupTasks(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if today's priority plan exists
    const existingPlan = await prisma.priorityPlan.findUnique({
      where: {
        userId_date: {
          userId: this.defaultUserId,
          date: today,
        },
      },
    });

    if (!existingPlan) {
      this.logger.info("startup:generating_priority_plan", {});
      await this.runPrioritySorter();
    } else {
      this.logger.info("startup:priority_plan_exists", {});
    }
  }

  /**
   * Run Priority Sorter Agent
   */
  private async runPrioritySorter(): Promise<void> {
    const timer = this.logger.startTimer();
    this.logger.info("run:priority_sorter:start", {});

    try {
      const result = await prioritySorterAgent.generateDailyPriorities(
        this.defaultUserId
      );

      const durationMs = timer();
      if (result.success) {
        this.logger.info("run:priority_sorter:complete", {
          durationMs,
          data: {
            doNow: result.priorities?.doNow.length,
            doNext: result.priorities?.doNext.length,
            canWait: result.priorities?.canWait.length,
          },
        });
      } else {
        this.logger.error("run:priority_sorter:failed", result.error || "Unknown error", {
          durationMs,
        });
      }
    } catch (error) {
      const durationMs = timer();
      this.logger.error("run:priority_sorter:error", error as Error, {
        durationMs,
      });
    }
  }

  /**
   * Run CEO Briefing Agent
   */
  private async runCEOBriefing(): Promise<void> {
    const timer = this.logger.startTimer();
    this.logger.info("run:ceo_briefing:start", {});

    try {
      const result = await ceoBriefingAgent.generateBriefing(this.defaultUserId);

      const durationMs = timer();
      if (result.success) {
        this.logger.info("run:ceo_briefing:complete", {
          durationMs,
          data: {
            taskCompletionRate: result.briefing?.metrics.taskCompletion.rate,
            bottlenecks: result.briefing?.bottlenecks.length,
          },
        });
      } else {
        this.logger.error("run:ceo_briefing:failed", result.error || "Unknown error", {
          durationMs,
        });
      }
    } catch (error) {
      const durationMs = timer();
      this.logger.error("run:ceo_briefing:error", error as Error, {
        durationMs,
      });
    }
  }

  /**
   * Manually trigger Priority Sorter (for testing)
   */
  async triggerPrioritySorter(userId?: string): Promise<void> {
    this.defaultUserId = userId || this.defaultUserId;
    await this.runPrioritySorter();
  }

  /**
   * Manually trigger CEO Briefing (for testing)
   */
  async triggerCEOBriefing(userId?: string): Promise<void> {
    this.defaultUserId = userId || this.defaultUserId;
    await this.runCEOBriefing();
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    scheduledTasks: number;
    nextPrioritySorterRun: string;
    nextCEOBriefingRun: string;
  } {
    // Calculate next run times
    const now = new Date();

    // Next 6 AM
    const nextPriority = new Date(now);
    nextPriority.setHours(6, 0, 0, 0);
    if (nextPriority <= now) {
      nextPriority.setDate(nextPriority.getDate() + 1);
    }

    // Next Sunday 8 PM
    const nextBriefing = new Date(now);
    nextBriefing.setHours(20, 0, 0, 0);
    const daysUntilSunday = (7 - now.getDay()) % 7;
    nextBriefing.setDate(nextBriefing.getDate() + daysUntilSunday);
    if (daysUntilSunday === 0 && now.getHours() >= 20) {
      nextBriefing.setDate(nextBriefing.getDate() + 7);
    }

    return {
      isRunning: this.scheduledTasks.length > 0,
      scheduledTasks: this.scheduledTasks.length,
      nextPrioritySorterRun: nextPriority.toISOString(),
      nextCEOBriefingRun: nextBriefing.toISOString(),
    };
  }
}

// Singleton instance
export const agentScheduler = new AgentScheduler();
export default agentScheduler;
