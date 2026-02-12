import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../middleware/auth';
import priorityService from '../services/priorityService';
import dailySummaryAgent from '../services/agents/dailySummaryAgent';

export class PriorityController {
  async getDailyPriorities(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const userId = req.userId;

      const dailyPriorities = await priorityService.getDailyPriorities(userId);

      return res.send({
        success: true,
        data: dailyPriorities
      });
    } catch (error) {
      console.error('Error getting daily priorities:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get daily priorities' }
      });
    }
  }

  async getPrioritizedTasks(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { limit } = req.query as { limit?: string };
      const userId = req.userId;

      const limitNum = limit ? parseInt(limit) : 20;

      const prioritizedTasks = await priorityService.getPrioritizedTasks(userId, limitNum);

      return res.send({
        success: true,
        data: { tasks: prioritizedTasks }
      });
    } catch (error) {
      console.error('Error getting prioritized tasks:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get prioritized tasks' }
      });
    }
  }

  async getPrioritizedEmails(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { limit } = req.query as { limit?: string };
      const userId = req.userId;

      const limitNum = limit ? parseInt(limit) : 20;

      const prioritizedEmails = await priorityService.getPrioritizedEmails(userId, limitNum);

      return res.send({
        success: true,
        data: { emails: prioritizedEmails }
      });
    } catch (error) {
      console.error('Error getting prioritized emails:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get prioritized emails' }
      });
    }
  }

  async generateDailySummary(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const userId = req.userId;

      const result = await dailySummaryAgent.generateDailySummary(userId);

      return res.send({
        success: result.success,
        message: result.message,
        data: result.dailyPriorities
      });
    } catch (error) {
      console.error('Error generating daily summary:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to generate daily summary' }
      });
    }
  }

  async getPriorityRecommendations(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const userId = req.userId;

      const result = await dailySummaryAgent.generatePriorityRecommendations(userId);

      return res.send({
        success: result.success,
        data: result
      });
    } catch (error) {
      console.error('Error getting priority recommendations:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get priority recommendations' }
      });
    }
  }

  async scheduleDailySummary(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { time } = req.body as { time?: string };
      const userId = req.userId;

      const result = await dailySummaryAgent.scheduleDailySummary(userId, time || '08:00');

      return res.send({
        success: result.success,
        message: result.message,
        data: result
      });
    } catch (error) {
      console.error('Error scheduling daily summary:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to schedule daily summary' }
      });
    }
  }
}

export default new PriorityController();