/**
 * Verification Routes - Prove real execution for Hackathon Zero
 * These endpoints allow judges to query and verify that actions actually happened
 */

import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function verificationRoutes(fastify: FastifyInstance) {
  // Get all tasks for a user
  fastify.get("/api/verify/tasks", async (request, reply) => {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return {
      count: tasks.length,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
      })),
    };
  });

  // Get all calendar events
  fastify.get("/api/verify/calendar", async (request, reply) => {
    const events = await prisma.calendarEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return {
      count: events.length,
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
        createdAt: e.createdAt,
      })),
    };
  });

  // Get all knowledge entries
  fastify.get("/api/verify/knowledge", async (request, reply) => {
    const entries = await prisma.knowledgeEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return {
      count: entries.length,
      entries: entries.map((k) => ({
        id: k.id,
        title: k.title,
        category: k.category,
        tags: k.tags,
        createdAt: k.createdAt,
        accessCount: k.accessCount,
      })),
    };
  });

  // Get LinkedIn outbox (posts ready to publish)
  fastify.get("/api/verify/linkedin-outbox", async (request, reply) => {
    const posts = await prisma.linkedInOutbox.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return {
      count: posts.length,
      posts: posts.map((p) => ({
        id: p.id,
        content:
          p.content.substring(0, 100) + (p.content.length > 100 ? "..." : ""),
        status: p.status,
        createdAt: p.createdAt,
        publishedAt: p.publishedAt,
      })),
    };
  });

  // Get execution summary - proves all agents work
  fastify.get("/api/verify/summary", async (request, reply) => {
    const [tasks, events, knowledge, linkedin, approvals] = await Promise.all([
      prisma.task.count(),
      prisma.calendarEvent.count(),
      prisma.knowledgeEntry.count(),
      prisma.linkedInOutbox.count(),
      prisma.approval.findMany({
        where: { executionStatus: "success" },
        select: {
          id: true,
          actionType: true,
          executedAt: true,
          executionData: true,
        },
        orderBy: { executedAt: "desc" },
        take: 20,
      }),
    ]);

    return {
      summary: {
        totalTasks: tasks,
        totalCalendarEvents: events,
        totalKnowledgeEntries: knowledge,
        totalLinkedInPosts: linkedin,
        totalSuccessfulExecutions: approvals.length,
      },
      recentExecutions: approvals.map((a) => ({
        id: a.id,
        actionType: a.actionType,
        executedAt: a.executedAt,
        result: a.executionData ? JSON.parse(a.executionData as string) : null,
      })),
    };
  });
}

export default verificationRoutes;
