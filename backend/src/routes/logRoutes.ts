import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fs from "fs";
import path from "path";
import config from "../config";

interface LogQuery {
  date?: string;
  category?: string;
}

export default async function logRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/api/logs",
    async (
      request: FastifyRequest<{ Querystring: LogQuery }>,
      reply: FastifyReply,
    ) => {
      try {
        const { date, category = "system" } = request.query;
        const logsDir = path.join(config.logPath, category);

        if (!fs.existsSync(logsDir)) {
          return { success: true, data: [] };
        }

        const files = fs.readdirSync(logsDir);
        const logFiles = files.filter(
          (f) => f.endsWith(".json") || f.endsWith(".log"),
        );

        const logs = logFiles.map((file) => {
          const filePath = path.join(logsDir, file);
          const stats = fs.statSync(filePath);
          let content = "";

          try {
            content = fs.readFileSync(filePath, "utf8");
            // If JSON, try to parse
            if (file.endsWith(".json")) {
              return {
                fileName: file,
                createdAt: stats.birthtime,
                size: stats.size,
                data: JSON.parse(content),
              };
            }
          } catch (e) {
            console.error(`Error reading log file ${file}:`, e);
          }

          return {
            fileName: file,
            createdAt: stats.birthtime,
            size: stats.size,
            content: content.substring(0, 1000), // Truncate long logs
          };
        });

        // Sort by creation date descending
        logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        return { success: true, data: logs };
      } catch (error) {
        fastify.log.error(error);
        return reply
          .status(500)
          .send({ success: false, error: "Failed to fetch logs" });
      }
    },
  );

  fastify.get("/api/logs/categories", async () => {
    try {
      if (!fs.existsSync(config.logPath)) {
        return { success: true, data: [] };
      }
      const categories = fs
        .readdirSync(config.logPath)
        .filter((f) => fs.statSync(path.join(config.logPath, f)).isDirectory());
      return { success: true, data: categories };
    } catch (error) {
      return { success: false, error: "Failed to fetch categories" };
    }
  });
}
