import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const DEV_USER_ID = "dev-user-001";

export default async function linkedinRoutes(fastify: FastifyInstance) {
  const injectDevUserId = async (req: FastifyRequest) => {
    if (process.env.NODE_ENV !== "production") {
      (req as AuthenticatedRequest).userId = DEV_USER_ID;
    }
  };

  // Get all LinkedIn posts
  fastify.get(
    "/api/linkedin/posts",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;

        console.log("[LinkedInRoutes] Fetching posts for user:", userId);

        const posts = await prisma.linkedInOutbox.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });

        // Map to expected frontend format
        const mappedPosts = posts.map((p) => ({
          id: p.id,
          userId: p.userId,
          title: `LinkedIn Post`,
          content: p.content,
          status: p.status === "ready_to_publish" ? "draft" : p.status,
          createdAt: p.createdAt,
          updatedAt: p.createdAt,
          postedDate: p.publishedAt,
        }));

        console.log("[LinkedInRoutes] Found posts:", mappedPosts.length);

        return res.send({
          success: true,
          data: { posts: mappedPosts },
        });
      } catch (error: any) {
        console.error("[LinkedInRoutes] Error fetching posts:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to fetch posts" },
        });
      }
    },
  );

  // Generate LinkedIn post
  fastify.post(
    "/api/linkedin/generate",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as AuthenticatedRequest).userId;
        const { topic, tone } = req.body as { topic: string; tone: string };

        console.log("[LinkedInRoutes] Generating post:", {
          topic,
          tone,
          userId,
        });

        // Generate content (fallback template - would use AI in production)
        const content = `Excited to share my thoughts on ${topic}!\n\nThis is a topic that's been on my mind lately, and I believe it's worth discussing with the community.\n\n${
          tone === "inspirational"
            ? "Remember: every expert was once a beginner. Keep pushing forward!"
            : tone === "casual"
              ? "Would love to hear what you all think about this!"
              : tone === "educational"
                ? "Here are some key insights I've gathered on this topic..."
                : "I'd appreciate your professional perspective on this matter."
        }\n\nWhat are your thoughts? Let me know in the comments below.`;

        const post = await prisma.linkedInOutbox.create({
          data: {
            userId,
            content,
            status: "ready_to_publish",
          },
        });

        console.log("[LinkedInRoutes] Post created:", post.id);

        return res.send({
          success: true,
          data: {
            post: {
              id: post.id,
              userId: post.userId,
              title: `Post about ${topic}`,
              content: post.content,
              status: "draft",
              createdAt: post.createdAt,
              updatedAt: post.createdAt,
            },
          },
        });
      } catch (error: any) {
        console.error("[LinkedInRoutes] Error generating post:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to generate post" },
        });
      }
    },
  );

  // Mark post as posted
  fastify.post(
    "/api/linkedin/posts/:id/posted",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const { id } = req.params as { id: string };

        console.log("[LinkedInRoutes] Marking post as posted:", id);

        const post = await prisma.linkedInOutbox.update({
          where: { id },
          data: {
            status: "published",
            publishedAt: new Date(),
          },
        });

        return res.send({
          success: true,
          data: {
            post: {
              id: post.id,
              userId: post.userId,
              title: "LinkedIn Post",
              content: post.content,
              status: "posted",
              postedDate: post.publishedAt,
              updatedAt: post.createdAt,
            },
          },
        });
      } catch (error: any) {
        console.error("[LinkedInRoutes] Error updating post:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to update post" },
        });
      }
    },
  );

  // Delete post
  fastify.delete(
    "/api/linkedin/posts/:id",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const { id } = req.params as { id: string };

        console.log("[LinkedInRoutes] Deleting post:", id);

        await prisma.linkedInOutbox.delete({ where: { id } });

        return res.send({
          success: true,
          data: { deleted: true },
        });
      } catch (error: any) {
        console.error("[LinkedInRoutes] Error deleting post:", error);
        return res.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to delete post" },
        });
      }
    },
  );
}
