import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { google } from "googleapis";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEV_USER_ID = "dev-user-001";

export default async function googleAuthRoutes(fastify: FastifyInstance) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ||
      "http://localhost:8080/auth/google/callback",
  );

  /**
   * Initiate Google OAuth flow
   */
  fastify.get(
    "/auth/google",
    async (req: FastifyRequest, res: FastifyReply) => {
      const scopes = [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
      ];

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
        prompt: "consent", // Force consent screen to get refresh token
      });

      console.log("[GoogleAuth] Redirecting to OAuth URL:", authUrl);
      return res.redirect(authUrl);
    },
  );

  /**
   * Handle OAuth callback
   */
  fastify.get(
    "/auth/google/callback",
    async (req: FastifyRequest, res: FastifyReply) => {
      const { code } = req.query as { code?: string };

      if (!code) {
        return res.status(400).send({
          success: false,
          error: "No authorization code provided",
        });
      }

      try {
        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);

        // Store tokens in database
        const userId = (req as any).userId || DEV_USER_ID;

        await prisma.userOAuthToken.upsert({
          where: { userId_provider: { userId, provider: "google" } },
          update: {
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token || undefined,
            expiryDate: tokens.expiry_date ? BigInt(tokens.expiry_date) : null,
            scope: tokens.scope,
            tokenType: tokens.token_type,
          },
          create: {
            userId,
            provider: "google",
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token,
            expiryDate: tokens.expiry_date ? BigInt(tokens.expiry_date) : null,
            scope: tokens.scope,
            tokenType: tokens.token_type,
          },
        });

        console.log("[GoogleAuth] Tokens saved to DB for user:", userId);

        // Redirect to frontend with success message
        return res.redirect(
          `${process.env.FRONTEND_URL || "http://localhost:3000"}?google_auth=success`,
        );
      } catch (error: any) {
        console.error("[GoogleAuth] Error exchanging code for tokens:", error);
        return res.status(500).send({
          success: false,
          error: "Failed to authenticate with Google: " + error.message,
        });
      }
    },
  );

  /**
   * Check OAuth status
   */
  fastify.get(
    "/auth/google/status",
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as any).userId || DEV_USER_ID;
        const tokens = await prisma.userOAuthToken.findUnique({
          where: { userId_provider: { userId, provider: "google" } },
        });

        if (tokens) {
          const isExpired = tokens.expiryDate
            ? Number(tokens.expiryDate) < Date.now()
            : false;
          return res.send({
            success: true,
            data: {
              connected: true,
              expiryDate: tokens.expiryDate ? Number(tokens.expiryDate) : null,
              isExpired,
            },
          });
        }

        return res.send({
          success: true,
          data: {
            connected: false,
          },
        });
      } catch (error) {
        console.error("[GoogleAuth] Error checking status:", error);
        return res.status(500).send({
          success: false,
          error: "Failed to check OAuth status",
        });
      }
    },
  );

  /**
   * Disconnect Google Calendar
   */
  fastify.post(
    "/auth/google/disconnect",
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const userId = (req as any).userId || DEV_USER_ID;
        await prisma.userOAuthToken.deleteMany({
          where: { userId, provider: "google" },
        });

        return res.send({
          success: true,
          message: "Google Calendar disconnected",
        });
      } catch (error) {
        console.error("[GoogleAuth] Error disconnecting:", error);
        return res.status(500).send({
          success: false,
          error: "Failed to disconnect",
        });
      }
    },
  );
}
