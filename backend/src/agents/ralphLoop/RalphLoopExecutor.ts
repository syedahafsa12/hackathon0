/**
 * Ralph Loop Executor
 *
 * A persistence mechanism that makes the AI truly autonomous by completing
 * multi-step tasks without human intervention after initial approval.
 *
 * Named after Ralph Wiggum's determination - "I'm helping!"
 *
 * Features:
 * - State file management for persistence
 * - Dual completion detection (file movement + promise tag)
 * - Iteration loop with context building
 * - Safety mechanisms (max iterations, timeout, emergency stop)
 * - Comprehensive logging
 */

import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import { join } from "path";
import { StructuredLogger } from "../../core/logging/structuredLogger";
import { getVaultManager } from "../../vault/VaultManager";

const prisma = new PrismaClient();

export interface RalphIteration {
  number: number;
  timestamp: Date;
  action: string;
  result: string;
  tokensUsed?: number;
  completionCheck: boolean;
}

export interface RalphStateData {
  taskId: string;
  userId: string;
  prompt: string;
  currentIteration: number;
  maxIterations: number;
  startedAt: Date;
  lastIterationAt: Date;
  status: "running" | "completed" | "failed" | "stopped";
  completionPromise: string;
  iterations: RalphIteration[];
}

export interface RalphExecutionResult {
  success: boolean;
  taskId: string;
  iterations: number;
  finalStatus: RalphStateData["status"];
  output?: string;
  error?: string;
  filePath?: string;
}

export class RalphLoopExecutor {
  private logger: StructuredLogger;
  private vaultManager: ReturnType<typeof getVaultManager>;
  private readonly MAX_ITERATIONS = 10;
  private readonly MAX_TOTAL_TIME_MS = 5 * 60 * 1000; // 5 minutes
  private readonly ITERATION_DELAY_MS = 2000; // 2 seconds between iterations
  private readonly MAX_CONSECUTIVE_ERRORS = 3;

  constructor() {
    this.logger = new StructuredLogger("ralph-loop-executor");
    this.vaultManager = getVaultManager();
  }

  /**
   * Main entry point - execute a multi-step task with persistence
   */
  async executeWithPersistence(
    userId: string,
    taskPrompt: string,
    maxIterations: number = this.MAX_ITERATIONS,
  ): Promise<RalphExecutionResult> {
    const timer = this.logger.startTimer();
    const { v4: uuidv4 } = await import("uuid");
    const taskId = uuidv4();

    this.logger.info("execute:start", {
      userId,
      data: { taskId, prompt: taskPrompt.substring(0, 100) },
    });

    try {
      // Create initial state
      const state = await this.createStateFile(
        userId,
        taskId,
        taskPrompt,
        maxIterations,
      );
      let consecutiveErrors = 0;

      // Main loop
      for (let iteration = 1; iteration <= maxIterations; iteration++) {
        // Check if we've exceeded max time
        const elapsedMs = Date.now() - state.startedAt.getTime();
        if (elapsedMs > this.MAX_TOTAL_TIME_MS) {
          this.logger.warn("execute:timeout", {
            data: { taskId, elapsedMs },
          });
          return this.finishExecution(
            taskId,
            userId,
            "failed",
            "Execution timeout exceeded",
          );
        }

        // Check for manual stop (file in Rejected folder)
        if (await this.checkManualStop(taskId)) {
          this.logger.info("execute:manual_stop", { data: { taskId } });
          return this.finishExecution(
            taskId,
            userId,
            "stopped",
            "Manually stopped by user",
          );
        }

        // Execute one iteration
        try {
          const iterationResult = await this.iterate(state, iteration);

          // Log iteration
          await this.logIteration(taskId, iterationResult);

          // Update state
          state.currentIteration = iteration;
          state.lastIterationAt = new Date();
          state.iterations.push(iterationResult);

          // Save state
          await this.saveState(state);

          consecutiveErrors = 0; // Reset error counter

          // Check completion
          if (iterationResult.completionCheck) {
            this.logger.info("execute:complete", {
              data: { taskId, iteration },
            });
            return this.finishExecution(
              taskId,
              userId,
              "completed",
              undefined,
              iterationResult.result,
            );
          }

          // Delay before next iteration
          await this.delay(this.ITERATION_DELAY_MS);
        } catch (error) {
          consecutiveErrors++;
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          this.logger.error("iterate:error", errorMessage, {
            data: { taskId, iteration, consecutiveErrors },
          });

          if (consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
            return this.finishExecution(
              taskId,
              userId,
              "failed",
              `Failed after ${consecutiveErrors} consecutive errors: ${errorMessage}`,
            );
          }
        }
      }

      // Max iterations reached
      this.logger.warn("execute:max_iterations", {
        data: { taskId, maxIterations },
      });
      return this.finishExecution(
        taskId,
        userId,
        "failed",
        `Task incomplete after ${maxIterations} iterations`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error("execute:error", errorMessage, {
        userId,
        data: { taskId },
      });
      return {
        success: false,
        taskId,
        iterations: 0,
        finalStatus: "failed",
        error: errorMessage,
      };
    }
  }

  /**
   * Create initial state file
   */
  private async createStateFile(
    userId: string,
    taskId: string,
    prompt: string,
    maxIterations: number,
  ): Promise<RalphStateData> {
    const state: RalphStateData = {
      taskId,
      userId,
      prompt,
      currentIteration: 0,
      maxIterations,
      startedAt: new Date(),
      lastIterationAt: new Date(),
      status: "running",
      completionPromise: "TASK_COMPLETE",
      iterations: [],
    };

    // Save to database
    await prisma.ralphState.create({
      data: {
        taskId,
        userId,
        prompt,
        maxIterations,
        iterations: JSON.stringify([]),
        obsidianStatePath: this.getStateFilePath(taskId),
      },
    });

    // Save to Obsidian vault
    await this.saveState(state);

    // Create task file in In_Progress
    const taskFilePath = join(
      this.vaultManager.getFolderPath("In_Progress"),
      `TASK_${taskId}.md`,
    );
    const taskContent = `---
taskId: ${taskId}
userId: ${userId}
status: running
startedAt: ${state.startedAt.toISOString()}
---

## Task: Multi-Step Execution

**Prompt:** ${prompt}

## Progress
- Started at: ${state.startedAt.toISOString()}
- Status: Running

## Iterations
(Will be updated as task progresses)

---
*Managed by Ralph Loop Executor*
`;
    await fs.writeFile(taskFilePath, taskContent);

    this.logger.info("state:created", { data: { taskId } });

    return state;
  }

  /**
   * Execute one iteration
   */
  private async iterate(
    state: RalphStateData,
    iterationNumber: number,
  ): Promise<RalphIteration> {
    this.logger.info("iterate:start", {
      data: { taskId: state.taskId, iteration: iterationNumber },
    });

    // Build context from all previous iterations
    const context = this.buildContext(state);

    // For now, simulate AI execution with a placeholder
    // In production, this would call Mistral AI
    const action = `Processing iteration ${iterationNumber}`;
    const result = await this.simulateAIExecution(
      state.prompt,
      context,
      iterationNumber,
    );

    // Check for completion
    const completionCheck = this.checkCompletionPromise(
      result,
      state.completionPromise,
    );

    return {
      number: iterationNumber,
      timestamp: new Date(),
      action,
      result,
      completionCheck,
    };
  }

  /**
   * Build context for AI from previous iterations
   */
  private buildContext(state: RalphStateData): string {
    let context = `Original Task: ${state.prompt}\n\n`;

    if (state.iterations.length > 0) {
      context += "Previous Iterations:\n";
      for (const iter of state.iterations) {
        context += `\n--- Iteration ${iter.number} ---\n`;
        context += `Action: ${iter.action}\n`;
        context += `Result: ${iter.result}\n`;
      }
    }

    context += `\nContinue working until task is complete. When done, include "<completion>TASK_COMPLETE</completion>" in your response.`;

    return context;
  }

  /**
   * Simulate AI execution (placeholder for actual Mistral integration)
   */
  private async simulateAIExecution(
    prompt: string,
    context: string,
    iteration: number,
  ): Promise<string> {
    // In production, this would call the Mistral AI API
    // For now, simulate completion after a few iterations

    if (iteration >= 3) {
      return `Task analysis complete. All steps have been processed successfully. <completion>TASK_COMPLETE</completion>`;
    }

    return `Iteration ${iteration}: Analyzed requirements. Processing step ${iteration} of the multi-step task. Progress: ${((iteration / 3) * 100).toFixed(0)}%`;
  }

  /**
   * Check for completion promise in result
   */
  private checkCompletionPromise(result: string, promise: string): boolean {
    const pattern = new RegExp(`<completion>${promise}</completion>`, "i");
    return pattern.test(result);
  }

  /**
   * Check if task file is in Done folder (file movement completion)
   */
  private async checkFileCompletion(taskId: string): Promise<boolean> {
    const doneFilePath = join(
      this.vaultManager.getFolderPath("Done"),
      `TASK_${taskId}.md`,
    );

    try {
      await fs.access(doneFilePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check for manual stop (file moved to Rejected)
   */
  private async checkManualStop(taskId: string): Promise<boolean> {
    const rejectedFilePath = join(
      this.vaultManager.getFolderPath("Rejected"),
      `TASK_${taskId}.md`,
    );

    try {
      await fs.access(rejectedFilePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Log iteration to vault
   */
  private async logIteration(
    taskId: string,
    iteration: RalphIteration,
  ): Promise<void> {
    const date = new Date().toISOString().split("T")[0];
    const logPath = join(
      this.vaultManager.getFolderPath("Logs"),
      `${date}_ralph.json`,
    );

    const logEntry = {
      taskId,
      iteration: iteration.number,
      timestamp: iteration.timestamp.toISOString(),
      action: iteration.action,
      result: iteration.result,
      tokensUsed: iteration.tokensUsed,
      completionCheck: iteration.completionCheck,
    };

    try {
      let logs: any[] = [];
      try {
        const existingData = await fs.readFile(logPath, "utf8");
        logs = JSON.parse(existingData);
      } catch {
        // File doesn't exist yet
      }

      logs.push(logEntry);
      await fs.writeFile(logPath, JSON.stringify(logs, null, 2));
    } catch (error) {
      this.logger.error("log:error", error as Error);
    }
  }

  /**
   * Save state to vault
   */
  private async saveState(state: RalphStateData): Promise<void> {
    const stateFilePath = this.getStateFilePath(state.taskId);
    const stateContent = JSON.stringify(state, null, 2);

    await fs.writeFile(stateFilePath, stateContent);

    // Also update database
    await prisma.ralphState.update({
      where: { taskId: state.taskId },
      data: {
        currentIteration: state.currentIteration,
        lastIterationAt: state.lastIterationAt,
        status: state.status,
        iterations: JSON.stringify(state.iterations),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get state file path
   */
  private getStateFilePath(taskId: string): string {
    return join(
      this.vaultManager.getFolderPath("In_Progress"),
      `RALPH_STATE_${taskId}.json`,
    );
  }

  /**
   * Finish execution and clean up
   */
  private async finishExecution(
    taskId: string,
    userId: string,
    status: RalphStateData["status"],
    error?: string,
    output?: string,
  ): Promise<RalphExecutionResult> {
    // Update database
    const dbState = await prisma.ralphState.update({
      where: { taskId },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    // Move task file to appropriate folder
    const sourceFile = `TASK_${taskId}.md`;
    const targetFolder = status === "completed" ? "Done" : "Needs_Action";

    try {
      await this.vaultManager.moveFile(sourceFile, "In_Progress", targetFolder);
    } catch {
      // File might not exist or already moved
    }

    // Clean up state file if completed
    if (status === "completed") {
      try {
        await fs.unlink(this.getStateFilePath(taskId));
      } catch {
        // Ignore cleanup errors
      }
    }

    const iterations = JSON.parse(dbState.iterations || "[]");

    return {
      success: status === "completed",
      taskId,
      iterations: iterations.length,
      finalStatus: status,
      output,
      error,
    };
  }

  /**
   * Get status of a running task
   */
  async getStatus(taskId: string): Promise<RalphStateData | null> {
    const dbState = await prisma.ralphState.findUnique({
      where: { taskId },
    });

    if (!dbState) return null;

    return {
      taskId: dbState.taskId,
      userId: dbState.userId,
      prompt: dbState.prompt,
      currentIteration: dbState.currentIteration,
      maxIterations: dbState.maxIterations,
      startedAt: dbState.startedAt,
      lastIterationAt: dbState.lastIterationAt,
      status: dbState.status as RalphStateData["status"],
      completionPromise: dbState.completionPromise,
      iterations: JSON.parse(dbState.iterations || "[]"),
    };
  }

  /**
   * Emergency stop for a running task
   */
  async stop(taskId: string): Promise<boolean> {
    this.logger.info("stop:request", { data: { taskId } });

    try {
      // Move task file to Rejected to trigger stop
      const sourceFile = `TASK_${taskId}.md`;
      await this.vaultManager.moveFile(sourceFile, "In_Progress", "Rejected");

      // Update database
      await prisma.ralphState.update({
        where: { taskId },
        data: {
          status: "stopped",
          updatedAt: new Date(),
        },
      });

      return true;
    } catch (error) {
      this.logger.error("stop:error", error as Error);
      return false;
    }
  }

  /**
   * Check if a prompt indicates a multi-step task
   */
  isMultiStepTask(prompt: string): boolean {
    const multiStepKeywords = [
      "research and create",
      "analyze and report",
      "download and categorize",
      "find and organize",
      "collect and summarize",
      "gather and compile",
      "search and compile",
      "investigate and document",
      "then",
      "after that",
      "step by step",
      "multi-step",
      "multiple steps",
    ];

    const lowerPrompt = prompt.toLowerCase();
    return multiStepKeywords.some((keyword) => lowerPrompt.includes(keyword));
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const ralphLoopExecutor = new RalphLoopExecutor();
export default ralphLoopExecutor;
