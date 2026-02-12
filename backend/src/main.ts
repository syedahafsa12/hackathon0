import Fastify from "fastify";
import cors from "fastify-cors";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import healthRoutes from "./routes/healthRoutes";
import chatRoutes from "./routes/chatRoutes";
import approvalRoutes from "./routes/approvalRoutes";
import taskRoutes from "./routes/taskRoutes";
import calendarRoutes from "./routes/calendarRoutes";
import knowledgeRoutes from "./routes/knowledgeRoutes";
import newsRoutes from "./routes/newsRoutes";
import linkedinRoutes from "./routes/linkedinRoutes";
import reminderRoutes from "./routes/reminderRoutes";
import vaultRoutes from "./routes/vaultRoutes";
import logRoutes from "./routes/logRoutes";
import { getDashboardManager } from "./vault/DashboardManager";
import { getVaultManager } from "./vault/VaultManager";
// New agent routes
import priorityRoutes from "./routes/priorityRoutes";
import ralphRoutes from "./routes/ralphRoutes";
import newsRoutesV2 from "./routes/newsRoutesV2";
import briefingRoutes from "./routes/briefingRoutes";
import emailRoutes from "./routes/emailRoutes";
import googleAuthRoutes from "./routes/googleAuthRoutes";
import verificationRoutes from "./routes/verificationRoutes";
// import websocketService from "./services/websocket";

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();
const server = Fastify({ logger: true });

// Allow empty body for JSON content type
server.addContentTypeParser(
  "application/json",
  { parseAs: "string" },
  (req, body, done) => {
    try {
      const json = body ? JSON.parse(body as string) : {};
      done(null, json);
    } catch (err) {
      done(null, {});
    }
  },
);

// Register CORS
server.register(cors, {
  origin:
    process.env.NODE_ENV === "production"
      ? process.env.FRONTEND_URL
      : [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:3002",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:3001",
          "http://127.0.0.1:3002",
        ],
  credentials: true,
});

// Register health routes first
server.register(healthRoutes);

// Register chat routes
server.register(chatRoutes);

// Register approval routes
server.register(approvalRoutes);

// Register all other routes
server.register(taskRoutes);
server.register(calendarRoutes);
server.register(knowledgeRoutes);
// server.register(newsRoutes);
server.register(linkedinRoutes);
server.register(reminderRoutes);
server.register(vaultRoutes);
server.register(googleAuthRoutes);
server.register(verificationRoutes);

// Register new agent routes
server.register(priorityRoutes);
server.register(ralphRoutes);
server.register(newsRoutesV2);
server.register(briefingRoutes);
server.register(emailRoutes);
server.register(logRoutes);

// Main endpoint
server.get("/", async () => {
  return { message: "Welcome to Mini Hafsa API - Your Personal AI Employee!" };
});

// Initialize Orchestrator and Watchers
async function initializeOrchestrator() {
  console.log("[Server] Initializing orchestrator and watchers...");

  const { default: orchestrator } = await import("./core/orchestrator");

  // Define all watchers to register
  const watcherModules = [
    { name: "emailWatcher", path: "./services/watchers/emailWatcher" },
    { name: "calendarWatcher", path: "./services/watchers/calendarWatcher" },
    { name: "taskWatcher", path: "./services/watchers/taskWatcher" },
    { name: "linkedinWatcher", path: "./services/watchers/linkedinWatcher" },
    { name: "knowledgeWatcher", path: "./services/watchers/knowledgeWatcher" },
    { name: "reminderWatcher", path: "./services/watchers/reminderWatcher" },
    { name: "ralphWatcher", path: "./services/watchers/ralphWatcher" },
    { name: "newsWatcher", path: "./services/watchers/newsWatcher" },
  ];

  const registeredWatchers: string[] = [];
  const failedWatchers: string[] = [];

  // Register all Watchers with error handling
  for (const watcher of watcherModules) {
    try {
      const module = await import(watcher.path);
      orchestrator.registerWatcher(module.default);
      registeredWatchers.push(watcher.name);
      console.log(`[Server] Registered watcher: ${watcher.name}`);
    } catch (error) {
      console.error(
        `[Server] Failed to register watcher ${watcher.name}:`,
        error,
      );
      failedWatchers.push(watcher.name);
    }
  }

  // Start orchestrator
  await orchestrator.start();

  // Start FileWatcher for Obsidian HITL
  try {
    const { fileWatcher } = await import("./orchestrator/fileWatcher");
    fileWatcher.start();
    console.log("[Server] FileWatcher started for Obsidian HITL");
  } catch (error) {
    console.error("[Server] Failed to start FileWatcher:", error);
  }

  const status = orchestrator.getStatus();
  console.log("[Server] ===================================");
  console.log(`[Server] Orchestrator started successfully`);
  console.log(`[Server] Registered watchers: ${registeredWatchers.join(", ")}`);
  if (failedWatchers.length > 0) {
    console.log(`[Server] Failed watchers: ${failedWatchers.join(", ")}`);
  }
  console.log(`[Server] Total watchers: ${status.watcherCount}`);
  console.log("[Server] ===================================");
}

const PORT = parseInt(process.env.PORT || "8080");

async function startServer() {
  try {
    const address = await server.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Server running on ${address}`);

    // Initialize orchestrator and watchers
    await initializeOrchestrator();

    // Initialize reminder scheduler (restore pending reminders)
    const { default: reminderScheduler } =
      await import("./services/reminderScheduler");
    await reminderScheduler.restorePendingReminders();
    console.log("[Server] Reminder scheduler initialized");

    // Initialize Obsidian vault and dashboard
    const vaultManager = getVaultManager();
    await vaultManager.initialize();
    const dashboardManager = getDashboardManager();
    await dashboardManager.initialize();
    console.log("[Server] Obsidian vault and dashboard initialized");

    // Initialize agent scheduler (Priority Sorter at 6 AM, CEO Briefing Sunday 8 PM)
    const { agentScheduler } = await import("./services/scheduler");
    await agentScheduler.start();
    const schedulerStatus = agentScheduler.getStatus();
    console.log(
      `[Server] Agent scheduler started: ${schedulerStatus.scheduledTasks} tasks scheduled`,
    );

    // Initialize WebSocket service
    // websocketService.initialize(server.server as any);

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("Shutting down gracefully...");

      // Stop orchestrator
      const { default: orchestrator } = await import("./core/orchestrator");
      await orchestrator.stop();

      // Stop agent scheduler
      const { agentScheduler } = await import("./services/scheduler");
      agentScheduler.stop();

      await prisma.$disconnect();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("Shutting down gracefully...");

      // Stop orchestrator
      const { default: orchestrator } = await import("./core/orchestrator");
      await orchestrator.stop();

      // Stop agent scheduler
      const { agentScheduler } = await import("./services/scheduler");
      agentScheduler.stop();

      await prisma.$disconnect();
      process.exit(0);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

startServer();

export default server;
