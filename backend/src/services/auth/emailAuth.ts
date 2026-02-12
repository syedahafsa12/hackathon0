import { google, outlook } from 'googleapis';
import { PrismaClient } from '@prisma/client';
import config from '../../config';

const prisma = new PrismaClient();

export class EmailAuthService {
  private gmailOAuth2Client: any;
  private outlookOAuth2Client: any;

  constructor() {
    // Initialize OAuth clients
    if (config.emailClientId && config.emailClientSecret) {
      this.gmailOAuth2Client = new google.auth.OAuth2(
        config.emailClientId,
        config.emailClientSecret,
        config.emailRedirectUri
      );

      // For Outlook/Office 365, we'd use Microsoft Graph API
      // This is a simplified implementation
    }
  }

  async generateGmailAuthUrl(userId: string): Promise<string> {
    if (!this.gmailOAuth2Client) {
      throw new Error('Gmail OAuth client not configured');
    }

    const authUrl = this.gmailOAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      state: userId // Include user ID in state for verification
    });

    return authUrl;
  }

  async handleGmailCallback(code: string, userId: string) {
    if (!this.gmailOAuth2Client) {
      throw new Error('Gmail OAuth client not configured');
    }

    try {
      const { tokens } = await this.gmailOAuth2Client.getToken(code);
      this.gmailOAuth2Client.setCredentials(tokens);

      // Store the tokens securely for the user
      await prisma.user.update({
        where: { id: userId },
        data: {
          preferences: {
            ...(await this.getUserPreferences(userId)),
            emailTokens: {
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null
            }
          }
        }
      });

      return { success: true, message: 'Gmail account connected successfully' };
    } catch (error) {
      console.error('Error handling Gmail callback:', error);
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

  async disconnectEmailAccount(userId: string, provider: 'gmail' | 'outlook') {
    try {
      // Remove email tokens from user preferences
      const currentPrefs = await this.getUserPreferences(userId);
      const updatedPrefs = { ...currentPrefs };

      if (updatedPrefs.emailTokens) {
        delete updatedPrefs.emailTokens;
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          preferences: updatedPrefs
        }
      });

      return { success: true, message: `${provider} account disconnected` };
    } catch (error) {
      console.error(`Error disconnecting ${provider} account:`, error);
      throw error;
    }
  }

  async verifyEmailConnection(userId: string, provider: 'gmail' | 'outlook'): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true }
      });

      const prefs = user?.preferences || {};
      return !!(prefs.emailTokens && prefs.emailTokens.accessToken);
    } catch (error) {
      console.error('Error verifying email connection:', error);
      return false;
    }
  }
}

export default new EmailAuthService();