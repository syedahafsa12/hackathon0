import { PrismaClient } from '@prisma/client';
import openaiService from '../openaiService';
import approvalAgent from './approvalAgent';

const prisma = new PrismaClient();

export class LinkedInAgent {
  async generatePost(userId: string, topic: string, tone: string = 'professional', includeImages: boolean = true) {
    try {
      // Generate the LinkedIn post content using OpenAI
      const postContent = await openaiService.generateLinkedInPost(topic, tone);

      // Create a draft post in the database
      const draftPost = await prisma.linkedInPost.create({
        data: {
          id: `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId,
          title: `LinkedIn Post: ${topic.substring(0, 30)}...`,
          content: postContent,
          status: 'draft',
          engagementMetrics: {}
        }
      });

      // Generate image suggestions if requested
      const imageSuggestions = includeImages ? this.generateImageSuggestions(topic) : [];

      return {
        success: true,
        message: 'LinkedIn post draft created successfully',
        post: {
          id: draftPost.id,
          title: draftPost.title,
          content: draftPost.content,
          imageSuggestions
        }
      };
    } catch (error) {
      console.error('Error generating LinkedIn post:', error);
      throw error;
    }
  }

  async schedulePost(userId: string, postId: string, scheduledDate: Date) {
    try {
      // Get the post to verify ownership
      const post = await prisma.linkedInPost.findUnique({
        where: { id: postId }
      });

      if (!post || post.userId !== userId) {
        throw new Error('Post not found or unauthorized');
      }

      // Update the post with scheduled date and status
      const scheduledPost = await prisma.linkedInPost.update({
        where: { id: postId },
        data: {
          status: 'scheduled',
          scheduledDate: scheduledDate
        }
      });

      return {
        success: true,
        message: `LinkedIn post scheduled for ${scheduledDate.toLocaleString()}`,
        post: scheduledPost
      };
    } catch (error) {
      console.error('Error scheduling LinkedIn post:', error);
      throw error;
    }
  }

  async publishPostWithApproval(userId: string, postId: string) {
    try {
      // Get the post to verify ownership and status
      const post = await prisma.linkedInPost.findUnique({
        where: { id: postId }
      });

      if (!post || post.userId !== userId) {
        throw new Error('Post not found or unauthorized');
      }

      if (post.status !== 'draft' && post.status !== 'scheduled') {
        throw new Error('Only draft or scheduled posts can be published');
      }

      // Create an approval request for publishing the post
      const approval = await approvalAgent.processApprovalRequest(userId, 'linkedin_post', {
        postId: post.id,
        title: post.title,
        content: post.content,
        scheduledDate: post.scheduledDate
      });

      return {
        success: true,
        message: 'LinkedIn post publication requires your approval',
        approval: approval.approval
      };
    } catch (error) {
      console.error('Error requesting LinkedIn post approval:', error);
      throw error;
    }
  }

  async getPostHistory(userId: string, status?: 'draft' | 'scheduled' | 'posted' | 'rejected', limit: number = 20) {
    try {
      const whereClause: any = { userId };

      if (status) {
        whereClause.status = status;
      }

      const posts = await prisma.linkedInPost.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return {
        success: true,
        posts: posts.map(post => ({
          id: post.id,
          title: post.title,
          content: post.content,
          status: post.status as 'draft' | 'scheduled' | 'posted' | 'rejected',
          scheduledDate: post.scheduledDate || undefined,
          postedDate: post.postedDate || undefined,
          engagementMetrics: post.engagementMetrics || {},
          createdAt: post.createdAt,
          updatedAt: post.updatedAt
        }))
      };
    } catch (error) {
      console.error('Error getting LinkedIn post history:', error);
      throw error;
    }
  }

  async processLinkedInCommand(userId: string, command: string) {
    try {
      // Parse the command to determine intent
      const intent = this.identifyIntent(command);

      switch (intent) {
        case 'generate_post':
          return await this.handleGeneratePost(userId, command);
        case 'schedule_post':
          return await this.handleSchedulePost(userId, command);
        case 'publish_post':
          return await this.handlePublishPost(userId, command);
        case 'view_history':
          return await this.handleViewHistory(userId, command);
        default:
          return {
            success: false,
            message: 'Unable to understand the LinkedIn command. Try phrases like "create a LinkedIn post about AI trends" or "show me my recent posts"'
          };
      }
    } catch (error) {
      console.error('Error processing LinkedIn command:', error);
      throw error;
    }
  }

  private identifyIntent(command: string): string {
    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes('create') || lowerCommand.includes('make') || lowerCommand.includes('write') ||
        lowerCommand.includes('generate') || lowerCommand.includes('draft') || lowerCommand.includes('post about')) {
      return 'generate_post';
    } else if (lowerCommand.includes('schedule') || lowerCommand.includes('plan to post') ||
               lowerCommand.includes('post later') || lowerCommand.includes('set date')) {
      return 'schedule_post';
    } else if (lowerCommand.includes('publish') || lowerCommand.includes('post now') ||
               lowerCommand.includes('share') || lowerCommand.includes('send')) {
      return 'publish_post';
    } else if (lowerCommand.includes('show') || lowerCommand.includes('view') ||
               lowerCommand.includes('my posts') || lowerCommand.includes('history')) {
      return 'view_history';
    } else {
      // Default to generate post for commands that might be requesting content
      return 'generate_post';
    }
  }

  private async handleGeneratePost(userId: string, command: string) {
    // Extract topic from command
    let topic = command;

    // Remove common phrases
    const phrasesToRemove = [
      'create a linkedin post about ',
      'write a linkedin post about ',
      'make a linkedin post about ',
      'generate a linkedin post about ',
      'draft a linkedin post about ',
      'create linkedin post about ',
      'write linkedin post about ',
      'make linkedin post about ',
      'generate linkedin post about ',
      'draft linkedin post about ',
      'create a post about ',
      'write a post about ',
      'make a post about ',
      'generate a post about ',
      'draft a post about '
    ];

    for (const phrase of phrasesToRemove) {
      if (topic.toLowerCase().startsWith(phrase)) {
        topic = topic.substring(phrase.length);
        break;
      }
    }

    // Determine tone based on command
    let tone = 'professional';
    if (command.toLowerCase().includes('casual') || command.toLowerCase().includes('informal')) {
      tone = 'casual';
    } else if (command.toLowerCase().includes('inspirational') || command.toLowerCase().includes('motivational')) {
      tone = 'inspirational';
    }

    return await this.generatePost(userId, topic, tone);
  }

  private async handleSchedulePost(userId: string, command: string) {
    // This is a simplified implementation
    // In reality, you'd need to extract which post and when to schedule

    // For now, we'll just return a message asking for more details
    return {
      success: false,
      message: 'Please specify which post to schedule and when. Example: "schedule my latest post for Friday at 2pm"'
    };
  }

  private async handlePublishPost(userId: string, command: string) {
    // This is a simplified implementation
    // In reality, you'd need to identify which post to publish

    // For now, we'll just return a message asking for more details
    return {
      success: false,
      message: 'Please specify which post to publish. Example: "publish my draft post about AI"'
    };
  }

  private async handleViewHistory(userId: string, command: string) {
    // Determine what kind of posts to show
    let statusFilter: 'draft' | 'scheduled' | 'posted' | 'rejected' | undefined;

    if (command.toLowerCase().includes('draft')) {
      statusFilter = 'draft';
    } else if (command.toLowerCase().includes('scheduled')) {
      statusFilter = 'scheduled';
    } else if (command.toLowerCase().includes('published') || command.toLowerCase().includes('posted')) {
      statusFilter = 'posted';
    } else if (command.toLowerCase().includes('rejected')) {
      statusFilter = 'rejected';
    }

    return await this.getPostHistory(userId, statusFilter);
  }

  private generateImageSuggestions(topic: string): string[] {
    // Generate image suggestions based on the topic
    // This is a simplified implementation

    const lowerTopic = topic.toLowerCase();
    const suggestions: string[] = [];

    if (lowerTopic.includes('ai') || lowerTopic.includes('artificial intelligence') || lowerTopic.includes('machine learning')) {
      suggestions.push('AI neural network visualization', 'Futuristic robot concept', 'Digital brain illustration');
    } else if (lowerTopic.includes('business') || lowerTopic.includes('leadership') || lowerTopic.includes('management')) {
      suggestions.push('Professional networking image', 'Business growth chart', 'Leadership concept');
    } else if (lowerTopic.includes('tech') || lowerTopic.includes('technology') || lowerTopic.includes('software')) {
      suggestions.push('Modern tech workspace', 'Code visualization', 'Digital innovation concept');
    } else if (lowerTopic.includes('career') || lowerTopic.includes('professional') || lowerTopic.includes('development')) {
      suggestions.push('Career ladder illustration', 'Professional achievement', 'Skill development concept');
    } else {
      // Generic suggestions
      suggestions.push('Relevant industry image', 'Infographic representation', 'Professional photo related to topic');
    }

    return suggestions;
  }
}

export default new LinkedInAgent();