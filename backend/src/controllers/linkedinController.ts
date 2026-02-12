import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../middleware/auth';
import linkedinAgent from '../services/agents/linkedinAgent';

export class LinkedInController {
  async generatePost(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { topic, tone, includeImages } = req.body as {
        topic: string;
        tone?: string;
        includeImages?: boolean;
      };

      const userId = req.userId;

      if (!topic) {
        return res.status(400).send({
          success: false,
          error: { code: 'MISSING_TOPIC', message: 'Topic is required' }
        });
      }

      const result = await linkedinAgent.generatePost(userId, topic, tone || 'professional', includeImages ?? true);

      return res.status(201).send({
        success: result.success,
        message: result.message,
        data: result.post
      });
    } catch (error) {
      console.error('Error generating LinkedIn post:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to generate LinkedIn post' }
      });
    }
  }

  async schedulePost(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { postId, scheduledDate } = req.body as {
        postId: string;
        scheduledDate: string;
      };

      const userId = req.userId;

      if (!postId || !scheduledDate) {
        return res.status(400).send({
          success: false,
          error: { code: 'MISSING_REQUIRED_FIELDS', message: 'Post ID and scheduled date are required' }
        });
      }

      const result = await linkedinAgent.schedulePost(userId, postId, new Date(scheduledDate));

      return res.send({
        success: result.success,
        message: result.message,
        data: result.post
      });
    } catch (error) {
      console.error('Error scheduling LinkedIn post:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to schedule LinkedIn post' }
      });
    }
  }

  async publishPost(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { postId } = req.params as { postId: string };
      const userId = req.userId;

      const result = await linkedinAgent.publishPost(userId, postId);

      return res.send({
        success: result.success,
        message: result.message,
        data: result.post
      });
    } catch (error) {
      console.error('Error publishing LinkedIn post:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to publish LinkedIn post' }
      });
    }
  }

  async getPostHistory(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { status, limit } = req.query as {
        status?: 'draft' | 'scheduled' | 'posted' | 'rejected';
        limit?: string;
      };

      const userId = req.userId;
      const limitNum = limit ? parseInt(limit) : 20;

      const result = await linkedinAgent.getPostHistory(userId, status, limitNum);

      return res.send({
        success: result.success,
        data: result.posts
      });
    } catch (error) {
      console.error('Error getting LinkedIn post history:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get LinkedIn post history' }
      });
    }
  }

  async processLinkedInCommand(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { command } = req.body as { command: string };
      const userId = req.userId;

      if (!command) {
        return res.status(400).send({
          success: false,
          error: { code: 'MISSING_COMMAND', message: 'LinkedIn command is required' }
        });
      }

      const result = await linkedinAgent.processLinkedInCommand(userId, command);

      return res.send({
        success: result.success,
        message: result.message,
        data: result.post || result.posts
      });
    } catch (error) {
      console.error('Error processing LinkedIn command:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process LinkedIn command' }
      });
    }
  }
}

export default new LinkedInController();