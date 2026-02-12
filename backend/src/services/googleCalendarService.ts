import { google } from "googleapis";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class GoogleCalendarService {
  private calendar = google.calendar("v3");

  /**
   * Get OAuth2 client for a user
   */
  private async getOAuth2Client(userId: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI ||
        "http://localhost:8080/auth/google/callback",
    );

    // Retrieve user's access token from database
    const userTokens = await prisma.userOAuthToken.findUnique({
      where: { userId_provider: { userId, provider: "google" } },
    });

    if (userTokens) {
      oauth2Client.setCredentials({
        access_token: userTokens.accessToken,
        refresh_token: userTokens.refreshToken || undefined,
        expiry_date: userTokens.expiryDate
          ? Number(userTokens.expiryDate)
          : undefined,
      });

      // Handle token rotation/refresh automatically
      oauth2Client.on("tokens", async (tokens) => {
        if (tokens.refresh_token) {
          await prisma.userOAuthToken.update({
            where: { userId_provider: { userId, provider: "google" } },
            data: {
              accessToken: tokens.access_token!,
              refreshToken: tokens.refresh_token,
              expiryDate: tokens.expiry_date
                ? BigInt(tokens.expiry_date)
                : null,
            },
          });
        } else if (tokens.access_token) {
          await prisma.userOAuthToken.update({
            where: { userId_provider: { userId, provider: "google" } },
            data: {
              accessToken: tokens.access_token,
              expiryDate: tokens.expiry_date
                ? BigInt(tokens.expiry_date)
                : null,
            },
          });
        }
      });
    }

    return oauth2Client;
  }

  /**
   * Helper to format Date to PKT ISO string (+05:00)
   */
  private toPktIsoString(date: Date): string {
    // Add 5 hours to UTC to get PKT local time value
    const pktTime = date.getTime() + 5 * 60 * 60 * 1000;
    const pktDate = new Date(pktTime);

    // Format: YYYY-MM-DDTHH:mm:ss.sss
    const iso = pktDate.toISOString().replace("Z", "");
    return `${iso}+05:00`;
  }

  /**
   * Create an event in Google Calendar
   */
  async createEvent(
    userId: string,
    eventData: {
      title: string;
      description?: string;
      startTime: Date;
      endTime: Date;
      location?: string;
      attendees?: Array<{ name: string; email: string }>;
    },
  ) {
    try {
      const auth = await this.getOAuth2Client(userId);

      const event = {
        summary: eventData.title,
        description: eventData.description,
        location: eventData.location,
        start: {
          dateTime: this.toPktIsoString(eventData.startTime),
          timeZone: "Asia/Karachi",
        },
        end: {
          dateTime: this.toPktIsoString(eventData.endTime),
          timeZone: "Asia/Karachi",
        },
        attendees: eventData.attendees?.map((a) => ({ email: a.email })),
      };

      const response = await this.calendar.events.insert({
        auth,
        calendarId: "primary",
        requestBody: event,
      });

      console.log(`[GoogleCalendar] Created event: ${response.data.id}`);
      return response.data;
    } catch (error) {
      console.error("[GoogleCalendar] Error creating event:", error);

      // If OAuth not set up, log helpful message
      if (!process.env.GOOGLE_CLIENT_ID) {
        console.warn(
          "[GoogleCalendar] GOOGLE_CLIENT_ID not set. Events will only be saved locally.",
        );
        console.warn("[GoogleCalendar] To enable Google Calendar sync:");
        console.warn("[GoogleCalendar] 1. Create a Google Cloud project");
        console.warn("[GoogleCalendar] 2. Enable Google Calendar API");
        console.warn("[GoogleCalendar] 3. Create OAuth 2.0 credentials");
        console.warn(
          "[GoogleCalendar] 4. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env",
        );
      }

      throw error;
    }
  }

  /**
   * Get events from Google Calendar
   */
  async getEvents(userId: string, timeMin?: Date, timeMax?: Date) {
    try {
      const auth = await this.getOAuth2Client(userId);

      // Check if we have credentials set
      if (!auth.credentials || !(auth.credentials as any).access_token) {
        throw new Error("NO_TOKENS");
      }

      const response = await this.calendar.events.list({
        auth,
        calendarId: "primary",
        timeMin: timeMin?.toISOString(),
        timeMax: timeMax?.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });

      return response.data.items || [];
    } catch (error: any) {
      if (error.message === "NO_TOKENS") {
        console.warn(
          "[GoogleCalendar] No OAuth tokens found for user:",
          userId,
        );
        throw error;
      }
      console.error("[GoogleCalendar] Error fetching events:", error);
      throw error; // Propagate error so controller can handle it
    }
  }

  /**
   * Delete an event from Google Calendar
   */
  async deleteEvent(userId: string, eventId: string) {
    try {
      const auth = await this.getOAuth2Client(userId);

      await this.calendar.events.delete({
        auth,
        calendarId: "primary",
        eventId,
      });

      console.log(`[GoogleCalendar] Deleted event: ${eventId}`);
    } catch (error) {
      console.error("[GoogleCalendar] Error deleting event:", error);
      throw error;
    }
  }
}

export default new GoogleCalendarService();
