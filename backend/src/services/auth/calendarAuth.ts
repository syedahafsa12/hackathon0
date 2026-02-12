import { google, outlook } from 'googleapis';
import { PrismaClient } from '@prisma/client';
import config from '../../config';

const prisma = new PrismaClient();

export class CalendarAuthService {
  private googleOAuth2Client: any;

  constructor() {
    // Initialize Google OAuth client
    if (config.calendarApiKey) {
      this.googleOAuth2Client = new google.auth.OAuth2(
        config.emailClientId, // Using email client ID for calendar as well
        config.emailClientSecret, // Using email client secret for calendar as well
        config.emailRedirectUri // Using email redirect URI for calendar as well
      );
    }
  }

  async generateGoogleCalendarAuthUrl(userId: string): Promise<string> {
    if (!this.googleOAuth2Client) {
      throw new Error('Google Calendar OAuth client not configured');
    }

    const authUrl = this.googleOAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      state: userId // Include user ID in state for verification
    });

    return authUrl;
  }

  async handleGoogleCalendarCallback(code: string, userId: string) {
    if (!this.googleOAuth2Client) {
      throw new Error('Google Calendar OAuth client not configured');
    }

    try {
      const { tokens } = await this.googleOAuth2Client.getToken(code);
      this.googleOAuth2Client.setCredentials(tokens);

      // Store the calendar tokens securely for the user
      await prisma.user.update({
        where: { id: userId },
        data: {
          preferences: {
            ...(await this.getUserPreferences(userId)),
            calendarTokens: {
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null
            }
          }
        }
      });

      return { success: true, message: 'Google Calendar connected successfully' };
    } catch (error) {
      console.error('Error handling Google Calendar callback:', error);
      throw error;
    }
  }

  async getUserPreferences(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true }
    });

    return user?.preferences || {};
  }

  async disconnectCalendarAccount(userId: string, provider: 'google' | 'outlook') {
    try {
      // Remove calendar tokens from user preferences
      const currentPrefs = await this.getUserPreferences(userId);
      const updatedPrefs = { ...currentPrefs };

      if (updatedPrefs.calendarTokens) {
        delete updatedPrefs.calendarTokens;
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          preferences: updatedPrefs
        }
      });

      return { success: true, message: `${provider} calendar account disconnected` };
    } catch (error) {
      console.error(`Error disconnecting ${provider} calendar account:`, error);
      throw error;
    }
  }

  async verifyCalendarConnection(userId: string, provider: 'google' | 'outlook'): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true }
      });

      const prefs = user?.preferences || {};
      return !!(prefs.calendarTokens && prefs.calendarTokens.accessToken);
    } catch (error) {
      console.error('Error verifying calendar connection:', error);
      return false;
    }
  }

  async listCalendars(userId: string) {
    try {
      const prefs = await this.getUserPreferences(userId);
      if (!prefs.calendarTokens || !prefs.calendarTokens.accessToken) {
        throw new Error('Calendar not connected');
      }

      // In a real implementation, you would use the Google Calendar API
      // to fetch the user's calendar list
      // For now, we'll return a mock response
      return {
        success: true,
        calendars: [
          { id: 'primary', name: 'Primary Calendar', primary: true },
          { id: 'work', name: 'Work Calendar', primary: false },
          { id: 'personal', name: 'Personal Calendar', primary: false }
        ]
      };
    } catch (error) {
      console.error('Error listing calendars:', error);
      throw error;
    }
  }
}

export default new CalendarAuthService();