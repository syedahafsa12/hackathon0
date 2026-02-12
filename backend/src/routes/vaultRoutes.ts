import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { VaultManager, getVaultManager } from "../vault/VaultManager";
import {
  DashboardManager,
  getDashboardManager,
} from "../vault/DashboardManager";
import { KnowledgeVault, getKnowledgeVault } from "../vault/KnowledgeVault";
import { LogManager, LogEntry, getLogManager } from "../vault/LogManager";
import { join } from "path";

export default async function vaultRoutes(server: FastifyInstance) {
  // Initialize vault components
  // Initialize vault components via singletons
  const vaultManager = getVaultManager();
  const dashboardManager = getDashboardManager();
  const knowledgeVault = getKnowledgeVault();
  const logManager = getLogManager();

  // Initialize on route registration
  try {
    await vaultManager.initialize();
    await dashboardManager.initialize();
    await knowledgeVault.initialize();
    await logManager.initialize();
    server.log.info("Vault routes initialized successfully");
  } catch (error) {
    server.log.error("Failed to initialize vault routes", error);
  }

  // Health check for vault system
  // Health check for vault system
  server.get("/vault/health", async (request, reply) => {
    try {
      const health = {
        status: "ok",
        vaultPath: vaultManager.getVaultPath(),
        dashboard: {
          lastUpdated: dashboardManager.getState().lastUpdated,
        },
        knowledge: await knowledgeVault.getKnowledgeStats(),
        logs: await logManager.getLogStats(),
        timestamp: new Date().toISOString(),
      };
      return health;
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: { code: "HEALTH_CHECK_FAILED", message: error.message },
      });
    }
  });

  // Dashboard operations
  server.get("/vault/dashboard", async (request, reply) => {
    try {
      const state = dashboardManager.getState();
      return { success: true, data: state };
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: { code: "DASHBOARD_GET_FAILED", message: error.message },
      });
    }
  });

  server.put(
    "/vault/dashboard",
    async (request: FastifyRequest<{ Body: any }>, reply) => {
      try {
        const updates = request.body;
        const state = dashboardManager.getState();

        if (updates.financialOverview) {
          dashboardManager.updateFinancialOverview(
            updates.financialOverview.bankBalance,
            updates.financialOverview.recentTransactions,
            updates.financialOverview.budgetStatus,
          );
        }

        if (updates.activeProjects) {
          dashboardManager.updateActiveProjects(updates.activeProjects);
        }

        if (updates.pendingActions) {
          dashboardManager.updatePendingActions(updates.pendingActions);
        }

        if (updates.recentActivity) {
          dashboardManager.updateRecentActivity(updates.recentActivity);
        }

        if (updates.systemHealth) {
          dashboardManager.updateSystemHealth(updates.systemHealth);
        }

        if (updates.nextSteps) {
          dashboardManager.updateNextSteps(updates.nextSteps);
        }

        await dashboardManager.updateDashboard();

        return { success: true, data: dashboardManager.getState() };
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: { code: "DASHBOARD_UPDATE_FAILED", message: error.message },
        });
      }
    },
  );

  // Knowledge vault operations
  server.post(
    "/vault/knowledge/chat",
    async (
      request: FastifyRequest<{
        Body: {
          content: string;
          role: string;
          sessionId: string;
          context?: string;
          tags?: string[];
        };
      }>,
      reply,
    ) => {
      try {
        const { content, role, sessionId, context, tags = [] } = request.body;

        if (!content || !role || !sessionId) {
          reply.status(400).send({
            success: false,
            error: {
              code: "MISSING_FIELDS",
              message: "content, role, and sessionId are required",
            },
          });
          return;
        }

        const filePath = await knowledgeVault.saveChatMessage(
          content,
          role as any,
          sessionId,
          context,
          tags,
        );

        return { success: true, data: { filePath } };
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: { code: "CHAT_SAVE_FAILED", message: error.message },
        });
      }
    },
  );

  server.post(
    "/vault/knowledge/entry",
    async (
      request: FastifyRequest<{
        Body: {
          title: string;
          content: string;
          tags?: string[];
          references?: string[];
        };
      }>,
      reply,
    ) => {
      try {
        const { title, content, tags = [], references = [] } = request.body;

        if (!title || !content) {
          reply.status(400).send({
            success: false,
            error: {
              code: "MISSING_FIELDS",
              message: "title and content are required",
            },
          });
          return;
        }

        const filePath = await knowledgeVault.saveKnowledgeEntry(
          title,
          content,
          tags,
          references,
        );

        return { success: true, data: { filePath } };
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: { code: "ENTRY_SAVE_FAILED", message: error.message },
        });
      }
    },
  );

  server.get(
    "/vault/knowledge/search",
    async (
      request: FastifyRequest<{ Querystring: { q: string; tags?: string } }>,
      reply,
    ) => {
      try {
        const { q, tags } = request.query;

        if (!q) {
          reply.status(400).send({
            success: false,
            error: {
              code: "MISSING_QUERY",
              message: 'Query parameter "q" is required',
            },
          });
          return;
        }

        const tagArray = tags ? tags.split(",").map((t) => t.trim()) : [];
        const results = await knowledgeVault.search(q, tagArray);

        return { success: true, data: { results, count: results.length } };
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: { code: "SEARCH_FAILED", message: error.message },
        });
      }
    },
  );

  server.get(
    "/vault/knowledge/recent",
    async (
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply,
    ) => {
      try {
        const limit = request.query.limit ? parseInt(request.query.limit) : 10;
        const chats = await knowledgeVault.getRecentChats(limit);

        return { success: true, data: { chats, count: chats.length } };
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: { code: "RECENT_CHATS_FAILED", message: error.message },
        });
      }
    },
  );

  server.get(
    "/vault/knowledge/session/:sessionId",
    async (
      request: FastifyRequest<{ Params: { sessionId: string } }>,
      reply,
    ) => {
      try {
        const { sessionId } = request.params;
        const messages = await knowledgeVault.getBySession(sessionId);

        return { success: true, data: { messages, count: messages.length } };
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: { code: "SESSION_GET_FAILED", message: error.message },
        });
      }
    },
  );

  server.get("/vault/knowledge/stats", async (request, reply) => {
    try {
      const stats = await knowledgeVault.getKnowledgeStats();
      return { success: true, data: stats };
    } catch (error: any) {
      reply.status(500).send({
        success: false,
        error: { code: "STATS_FAILED", message: error.message },
      });
    }
  });

  // Log operations
  server.get(
    "/vault/logs",
    async (
      request: FastifyRequest<{
        Querystring: { date?: string; limit?: string };
      }>,
      reply,
    ) => {
      try {
        const { date, limit } = request.query;
        const logs = await logManager.getLogs(
          date,
          limit ? parseInt(limit) : undefined,
        );
        return { success: true, data: { logs, count: logs.length } };
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: { code: "LOGS_GET_FAILED", message: error.message },
        });
      }
    },
  );

  server.post(
    "/vault/logs/search",
    async (
      request: FastifyRequest<{
        Body: {
          query: string;
          level?: string;
          service?: string;
          dateFrom?: string;
          dateTo?: string;
        };
      }>,
      reply,
    ) => {
      try {
        const { query, level, service, dateFrom, dateTo } = request.body;

        if (!query) {
          reply.status(400).send({
            success: false,
            error: { code: "MISSING_QUERY", message: "query is required" },
          });
          return;
        }

        const results = await logManager.searchLogs(
          query,
          level as any,
          service,
          dateFrom,
          dateTo,
        );
        return { success: true, data: { results, count: results.length } };
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: { code: "LOGS_SEARCH_FAILED", message: error.message },
        });
      }
    },
  );

  server.get(
    "/vault/logs/export/:date",
    async (request: FastifyRequest<{ Params: { date: string } }>, reply) => {
      try {
        const { date } = request.params;
        const markdownFile = await logManager.exportMarkdown(date);
        const { promises: fs } = await import("fs");
        const content = await fs.readFile(markdownFile, "utf8");

        reply.type("text/markdown");
        reply.send(content);
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: { code: "EXPORT_FAILED", message: error.message },
        });
      }
    },
  );

  server.get("/vault/logs/stats", async (request, reply) => {
    try {
      const stats = await logManager.getLogStats();
      return { success: true, data: stats };
    } catch (error: any) {
      reply.status(500).send({
        success: false,
        error: { code: "STATS_FAILED", message: error.message },
      });
    }
  });

  server.post("/vault/logs/cleanup", async (request, reply) => {
    try {
      const body = request.body as any;
      const retentionDays = body.retentionDays || 90;
      const pruned = await logManager.cleanupOldLogs();
      return { success: true, data: { pruned, retentionDays } };
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: { code: "CLEANUP_FAILED", message: error.message },
      });
    }
  });

  // Vault operations
  server.get("/vault/folders", async (request, reply) => {
    try {
      const folders = vaultManager["folders"]; // accessible via class property
      return { success: true, data: { folders } };
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: { code: "FOLDERS_GET_FAILED", message: error.message },
      });
    }
  });

  // Get complete vault structure with file listings
  server.get("/vault/structure", async (request, reply) => {
    try {
      const { promises: fs } = await import("fs");
      const { join } = await import("path");
      const vaultPath = vaultManager.getVaultPath();

      const folders = [
        "Needs_Action",
        "In_Progress",
        "Pending_Approval",
        "Approved",
        "Rejected",
        "Done",
        "Plans",
        "Knowledge_Vault",
        "Briefings",
        "Logs",
        "Backups",
      ];

      const structure: any = {
        folders: [],
        totalFiles: 0,
      };

      // Add root-level files first
      try {
        const rootFiles = await fs.readdir(vaultPath);
        const rootMdFiles: any[] = [];

        for (const file of rootFiles) {
          if (file.endsWith(".md")) {
            const filePath = join(vaultPath, file);
            const stats = await fs.stat(filePath);

            rootMdFiles.push({
              name: file,
              path: file,
              size: stats.size,
              modified: stats.mtime,
            });
          }
        }

        if (rootMdFiles.length > 0) {
          structure.folders.push({
            name: "Root",
            path: "",
            fileCount: rootMdFiles.length,
            files: rootMdFiles.sort(
              (a: any, b: any) => b.modified.getTime() - a.modified.getTime(),
            ),
          });
          structure.totalFiles += rootMdFiles.length;
        }
      } catch (error) {
        server.log.warn("Error reading root files:", error);
      }

      // Add all vault folders
      for (const folderName of folders) {
        const folderPath = join(vaultPath, folderName);

        try {
          const files = await fs.readdir(folderPath);
          const mdFiles: any[] = [];

          for (const file of files) {
            if (file.endsWith(".md") || file.endsWith(".json")) {
              const filePath = join(folderPath, file);
              const stats = await fs.stat(filePath);

              mdFiles.push({
                name: file,
                path: `${folderName}/${file}`,
                size: stats.size,
                modified: stats.mtime,
              });
            }
          }

          structure.folders.push({
            name: folderName,
            path: folderName,
            fileCount: mdFiles.length,
            files: mdFiles.sort(
              (a: any, b: any) => b.modified.getTime() - a.modified.getTime(),
            ),
          });

          structure.totalFiles += mdFiles.length;
        } catch (error) {
          // Folder might not exist yet, skip it
          server.log.warn(`Folder ${folderName} not found, skipping`);
        }
      }

      return { success: true, data: structure };
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: { code: "STRUCTURE_GET_FAILED", message: error.message },
      });
    }
  });

  // Direct vault file operations
  server.get(
    "/vault/file/:path*",
    async (request: FastifyRequest<{ Params: { path: string } }>, reply) => {
      try {
        const { path: filePath } = request.params;
        const fullPath = join(vaultManager.getVaultPath(), filePath);

        // Security check: ensure path is within vault
        if (!fullPath.startsWith(vaultManager.getVaultPath())) {
          reply.status(403).send({
            success: false,
            error: { code: "PATH_ACCESS_DENIED", message: "Access denied" },
          });
          return;
        }

        const { promises: fs } = await import("fs");
        try {
          const content = await fs.readFile(fullPath, "utf8");
          const matter = await import("gray-matter");
          const { data } = matter.default(content);

          reply.type("text/markdown");
          reply.send(content);
        } catch (error: any) {
          if (error.code === "ENOENT") {
            reply.status(404).send({
              success: false,
              error: {
                code: "FILE_NOT_FOUND",
                message: `File ${filePath} not found`,
              },
            });
          } else {
            throw error;
          }
        }
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: { code: "FILE_GET_FAILED", message: error.message },
        });
      }
    },
  );

  server.put(
    "/vault/file/:path*",
    async (
      request: FastifyRequest<{
        Params: { path: string };
        Body: { content: string };
      }>,
      reply,
    ) => {
      try {
        const { path: filePath } = request.params;
        const { content } = request.body;
        const fullPath = join(vaultManager.getVaultPath(), filePath);

        // Security check
        if (!fullPath.startsWith(vaultManager.getVaultPath())) {
          reply.status(403).send({
            success: false,
            error: { code: "PATH_ACCESS_DENIED", message: "Access denied" },
          });
          return;
        }

        const { promises: fs } = await import("fs");
        await fs.writeFile(fullPath, content, "utf8");

        return { success: true, data: { filePath } };
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: { code: "FILE_WRITE_FAILED", message: error.message },
        });
      }
    },
  );

  server.delete(
    "/vault/file/:path*",
    async (request: FastifyRequest<{ Params: { path: string } }>, reply) => {
      try {
        const { path: filePath } = request.params;
        const fullPath = join(vaultManager.getVaultPath(), filePath);

        // Security check
        if (!fullPath.startsWith(vaultManager.getVaultPath())) {
          reply.status(403).send({
            success: false,
            error: { code: "PATH_ACCESS_DENIED", message: "Access denied" },
          });
          return;
        }

        const { promises: fs } = await import("fs");
        await fs.unlink(fullPath);

        return { success: true, data: { deleted: filePath } };
      } catch (error: any) {
        if (error.code === "ENOENT") {
          reply.status(404).send({
            success: false,
            error: {
              code: "FILE_NOT_FOUND",
              message: `File path not found`,
            },
          });
          return;
        } else {
          return reply.status(500).send({
            success: false,
            error: { code: "FILE_DELETE_FAILED", message: error.message },
          });
        }
      }
    },
  );

  // Vault maintenance
  server.post("/vault/initialize", async (request, reply) => {
    try {
      await vaultManager.initialize();
      await dashboardManager.initialize();
      await knowledgeVault.initialize();
      await logManager.initialize();

      return { success: true, data: { status: "initialized" } };
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: { code: "INIT_FAILED", message: error.message },
      });
    }
  });

  server.get("/vault/status", async (request, reply) => {
    try {
      const status = {
        vaultInitialized: await checkVaultInitialized(
          vaultManager.getVaultPath(),
        ),
        dashboard: {
          autoUpdateActive: true, // We need to expose this
          lastUpdate: dashboardManager.getState().lastUpdated,
        },
        knowledgeVault: await knowledgeVault.getKnowledgeStats(),
        logs: await logManager.getLogStats(),
      };
      return { success: true, data: status };
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: { code: "STATUS_FAILED", message: error.message },
      });
    }
  });

  async function checkVaultInitialized(path: string): Promise<boolean> {
    try {
      const { promises: fs } = await import("fs");
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}

export type { VaultManager, DashboardManager, KnowledgeVault, LogManager };
