/**
 * Health Check Routes
 * Comprehensive system status endpoint for frontend dashboard
 */

import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function healthRoutes(fastify: FastifyInstance) {
  console.log("[HealthRoutes] Registering health routes...");

  // Comprehensive health check endpoint
  fastify.get("/api/system/health", async () => {
    console.log("[HealthRoutes] /api/system/health called");
    // Get orchestrator status
    let orchestratorStatus = { isRunning: false, watcherCount: 0 };
    try {
      const { default: orchestrator } = await import("../core/orchestrator");
      orchestratorStatus = orchestrator.getStatus();
    } catch (e) {
      console.error("[Health] Failed to get orchestrator status:", e);
    }

    // Get vault path
    const vaultPath = process.env.VAULT_PATH || ".obsidian-vault";
    let vaultStatus = "unknown";
    try {
      const fs = await import("fs/promises");
      await fs.access(vaultPath);
      vaultStatus = "ready";
    } catch {
      vaultStatus = "missing";
    }

    // Check database
    let dbStatus = "unknown";
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = "connected";
    } catch {
      dbStatus = "disconnected";
    }

    // Get pending approvals count
    let pendingApprovals = 0;
    try {
      pendingApprovals = await prisma.approval.count({
        where: { status: "pending" },
      });
    } catch {
      // Ignore
    }

    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      watchers: [
        "emailWatcher",
        "calendarWatcher",
        "taskWatcher",
        "reminderWatcher",
        "linkedinWatcher",
        "knowledgeWatcher",
      ],
      watcherCount: orchestratorStatus.watcherCount,
      orchestratorRunning: orchestratorStatus.isRunning,
      agents: ["prioritySorter", "newsAgent", "ceoBriefing", "ralphLoop"],
      vaultPath: vaultPath,
      vaultStatus: vaultStatus,
      database: dbStatus,
      pendingApprovals: pendingApprovals,
      demoMode: process.env.DEMO_MODE === "true",
    };
  });

  // Legacy health endpoint
  fastify.get("/health", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
}
