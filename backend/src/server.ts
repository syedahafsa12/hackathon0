import Fastify from "fastify";
import cors from "fastify-cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import websocketService from "./services/websocket";
import chatRoutes from "./routes/chatRoutes";
import approvalRoutes from "./routes/approvalRoutes";
import taskRoutes from "./routes/taskRoutes";
import calendarRoutes from "./routes/calendarRoutes";
import knowledgeRoutes from "./routes/knowledgeRoutes";
import newsRoutes from "./routes/newsRoutes";
import linkedinRoutes from "./routes/linkedinRoutes";
import reminderRoutes from "./routes/reminderRoutes";
import googleAuthRoutes from "./routes/googleAuthRoutes";
import logRoutes from "./routes/logRoutes";
import { orchestrator } from "./core/orchestrator";
import { fileWatcher } from "./orchestrator/fileWatcher";

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();
const server = Fastify({ logger: true });

// Add global error handler for better debugging
server.setErrorHandler((error, request, reply) => {
  console.error("[Server] Error:", error);
  console.error("[Server] Request URL:", request.url);
  console.error("[Server] Request method:", request.method);
  console.error("[Server] Request body:", request.body);

  reply.status(error.statusCode || 500).send({
    success: false,
    error: {
      code: error.code || "INTERNAL_ERROR",
      message: error.message || "Internal server error",
    },
  });
});

// Register CORS
server.register(cors, {
  origin:
    process.env.NODE_ENV === "production"
      ? process.env.FRONTEND_URL
      : ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true,
});

// Register routes
server.register(chatRoutes);
server.register(approvalRoutes);
server.register(taskRoutes);
server.register(calendarRoutes);
server.register(knowledgeRoutes);
server.register(newsRoutes);
server.register(linkedinRoutes);
server.register(reminderRoutes);
server.register(googleAuthRoutes);
server.register(logRoutes);

// Health check endpoint
server.get("/health", async () => {
  return { status: "OK", timestamp: new Date().toISOString() };
});

// Main endpoint
server.get("/", async () => {
  return { message: "Welcome to Mini Hafsa API!" };
});

const PORT = parseInt(process.env.PORT || "8080");

async function startServer() {
  try {
    // Start Orchestrator (Autonomous Loop)
    await orchestrator.start();
    console.log("[Server] Orchestrator started");

    // Start FileWatcher (Obsidian HITL)
    fileWatcher.start();
    console.log("[Server] FileWatcher started");

    // Start the server
    const address = await server.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Server running on ${address}`);

    // Initialize WebSocket service with the server instance
    websocketService.initialize(server.server as any);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

export default server;
