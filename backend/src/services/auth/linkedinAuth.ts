import { PrismaClient } from '@prisma/client';
import config from '../../config';

const prisma = new PrismaClient();

export class LinkedInAuthService {
  private linkedinClientId: string;
  private linkedinClientSecret: string;
  private redirectUri: string;

  constructor() {
    this.linkedinClientId = config.emailClientId; // Using the same config for now
    this.linkedinClientSecret = config.emailClientSecret;
    this.redirectUri = config.emailRedirectUri;
  }

  async generateLinkedInAuthUrl(userId: string): Promise<string> {
    if (!this.linkedinClientId) {
      throw new Error('LinkedIn OAuth client not configured');
    }

    // Construct LinkedIn OAuth URL
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
      `client_id=${this.linkedinClientId}&` +
      `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
      `response_type=code&` +
      `scope=r_liteprofile%20r_emailaddress%20w_member_social&` +
      `state=${userId}`; // Include user ID in state for verification

    return authUrl;
  }

  async handleLinkedInCallback(code: string, userId: string) {
    try {
      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `grant_type=authorization_code&` +
          `code=${code}&` +
          `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
          `client_id=${this.linkedinClientId}&` +
          `client_secret=${this.linkedinClientSecret}`
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(`LinkedIn OAuth error: ${JSON.stringify(tokenData)}`);
      }

      // Store the tokens securely for the user
      await prisma.user.update({
        where: { id: userId },
        data: {
          preferences: {
            ...(await this.getUserPreferences(userId)),
            linkedinTokens: {
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token,
              expiryDate: new Date(Date.now() + tokenData.expires_in * 1000),
              scope: tokenData.scope
            }
          }
        }
      });

      return {
        success: true,
        message: 'LinkedIn account connected successfully',
        data: {
          accessToken: tokenData.access_token,
          expiresAt: new Date(Date.now() + tokenData.expires_in * 1000)
        }
      };
    } catch (error) {
      console.error('Error handling LinkedIn callback:', error);
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

  async disconnectLinkedInAccount(userId: string) {
    try {
      // Remove LinkedIn tokens from user preferences
      const currentPrefs = await this.getUserPreferences(userId);
      const updatedPrefs = { ...currentPrefs };

      if (updatedPrefs.linkedinTokens) {
        delete updatedPrefs.linkedinTokens;
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          preferences: updatedPrefs
        }
      });

      return { success: true, message: 'LinkedIn account disconnected' };
    } catch (error) {
      console.error('Error disconnecting LinkedIn account:', error);
      throw error;
    }
  }

  async verifyLinkedInConnection(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true }
      });

      const prefs = user?.preferences || {};
      return !!(prefs.linkedinTokens && prefs.linkedinTokens.accessToken);
    } catch (error) {
      console.error('Error verifying LinkedIn connection:', error);
      return false;
    }
  }

  async publishPostToLinkedIn(userId: string, postContent: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true }
      });

      const prefs = user?.preferences || {};
      const accessToken = prefs.linkedinTokens?.accessToken;

      if (!accessToken) {
        throw new Error('LinkedIn account not connected');
      }

      // Get user's LinkedIn profile ID
      const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!profileResponse.ok) {
        throw new Error('Failed to get LinkedIn profile');
      }

      const profileData = await profileResponse.json();
      const profileId = profileData.id;

      // Publish the post
      const postResponse = await fetch(`https://api.linkedin.com/v2/ugcPosts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify({
          author: `urn:li:person:${profileId}`,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            '$type': 'com.linkedin.ugc.ShareContent',
            shareCommentary: {
              text: postContent
            },
            shareMediaCategory: 'NONE'
          },
          visibility: {
            '$type': 'com.linkedin.ugc.MemberNetworkVisibility',
            code: 'PUBLIC'
          }
        })
      });

      if (!postResponse.ok) {
        throw new Error(`Failed to publish LinkedIn post: ${await postResponse.text()}`);
      }

      const postData = await postResponse.json();
      return {
        success: true,
        message: 'Post published to LinkedIn successfully',
        postId: postData.id
      };
    } catch (error) {
      console.error('Error publishing post to LinkedIn:', error);
      throw error;
    }
  }
}

export default new LinkedInAuthService();