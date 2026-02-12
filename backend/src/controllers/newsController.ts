import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../middleware/auth';
import newsAgent from '../services/agents/newsAgent';

export class NewsController {
  async fetchNews(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { categories, limit } = req.query as {
        categories?: string;
        limit?: string;
      };

      const userId = req.userId;
      const categoriesArray = categories ? categories.split(',') : ['AI', 'tech', 'world-impact'];
      const limitNum = limit ? parseInt(limit) : 5;

      const result = await newsAgent.fetchNews(userId, categoriesArray, limitNum);

      return res.send({
        success: result.success,
        message: result.message,
        data: result.news
      });
    } catch (error) {
      console.error('Error fetching news:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch news' }
      });
    }
  }

  async generateNewsDigest(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { topics, timeFrame } = req.body as {
        topics?: string[];
        timeFrame?: 'daily' | 'weekly';
      };

      const userId = req.userId;

      const result = await newsAgent.generateNewsDigest(userId, topics, timeFrame || 'daily');

      return res.send({
        success: result.success,
        message: result.message,
        data: result.digest
      });
    } catch (error) {
      console.error('Error generating news digest:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to generate news digest' }
      });
    }
  }

  async getNewsHistory(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { category, limit } = req.query as {
        category?: 'AI' | 'tech' | 'world-impact';
        limit?: string;
      };

      const userId = req.userId;
      const limitNum = limit ? parseInt(limit) : 20;

      const result = await newsAgent.getNewsHistory(userId, category, limitNum);

      return res.send({
        success: result.success,
        data: result.news
      });
    } catch (error) {
      console.error('Error getting news history:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get news history' }
      });
    }
  }

  async processNewsCommand(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { command } = req.body as { command: string };
      const userId = req.userId;

      if (!command) {
        return res.status(400).send({
          success: false,
          error: { code: 'MISSING_COMMAND', message: 'News command is required' }
        });
      }

      const result = await newsAgent.processNewsCommand(userId, command);

      return res.send({
        success: result.success,
        message: result.message,
        data: result.news || result.digest
      });
    } catch (error) {
      console.error('Error processing news command:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process news command' }
      });
    }
  }
}

export default new NewsController();