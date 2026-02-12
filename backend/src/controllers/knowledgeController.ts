import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../middleware/auth';
import knowledgeService from '../services/knowledge/knowledgeService';
import knowledgeAgent from '../services/agents/knowledgeAgent';

export class KnowledgeController {
  async createKnowledgeEntry(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { title, content, category, tags } = req.body as {
        title: string;
        content: string;
        category: string;
        tags?: string[];
      };

      const userId = req.userId;

      if (!title || !content || !category) {
        return res.status(400).send({
          success: false,
          error: { code: 'MISSING_REQUIRED_FIELDS', message: 'Title, content, and category are required' }
        });
      }

      const entry = await knowledgeService.createKnowledgeEntry(userId, {
        title,
        content,
        category,
        tags
      });

      return res.status(201).send({
        success: true,
        data: entry
      });
    } catch (error) {
      console.error('Error creating knowledge entry:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create knowledge entry' }
      });
    }
  }

  async getKnowledgeEntries(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { category, tags, limit } = req.query as {
        category?: string;
        tags?: string;
        limit?: string;
      };

      const userId = req.userId;
      const limitNum = limit ? parseInt(limit) : 50;

      // Parse tags from query parameter (comma-separated)
      const tagArray = tags ? tags.split(',').map(tag => tag.trim()) : undefined;

      const entries = await knowledgeService.getKnowledgeEntriesByUserId(
        userId,
        category,
        tagArray,
        limitNum
      );

      return res.send({
        success: true,
        data: { entries }
      });
    } catch (error) {
      console.error('Error getting knowledge entries:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get knowledge entries' }
      });
    }
  }

  async getKnowledgeEntry(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const userId = req.userId;

      const entry = await knowledgeService.getKnowledgeEntryById(id, userId);

      if (!entry) {
        return res.status(404).send({
          success: false,
          error: { code: 'ENTRY_NOT_FOUND', message: 'Knowledge entry not found' }
        });
      }

      return res.send({
        success: true,
        data: entry
      });
    } catch (error) {
      console.error('Error getting knowledge entry:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get knowledge entry' }
      });
    }
  }

  async updateKnowledgeEntry(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const { title, content, category, tags } = req.body as {
        title?: string;
        content?: string;
        category?: string;
        tags?: string[];
      };

      const userId = req.userId;

      const updatedEntry = await knowledgeService.updateKnowledgeEntry(id, userId, {
        title,
        content,
        category,
        tags
      });

      return res.send({
        success: true,
        data: updatedEntry
      });
    } catch (error) {
      console.error('Error updating knowledge entry:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update knowledge entry' }
      });
    }
  }

  async deleteKnowledgeEntry(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const userId = req.userId;

      const success = await knowledgeService.deleteKnowledgeEntry(id, userId);

      if (!success) {
        return res.status(404).send({
          success: false,
          error: { code: 'ENTRY_NOT_FOUND', message: 'Knowledge entry not found' }
        });
      }

      return res.send({
        success: true,
        data: { message: 'Knowledge entry deleted successfully' }
      });
    } catch (error) {
      console.error('Error deleting knowledge entry:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete knowledge entry' }
      });
    }
  }

  async searchKnowledgeEntries(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { query, category, limit } = req.query as {
        query: string;
        category?: string;
        limit?: string;
      };

      const userId = req.userId;
      const limitNum = limit ? parseInt(limit) : 50;

      if (!query) {
        return res.status(400).send({
          success: false,
          error: { code: 'MISSING_QUERY', message: 'Search query is required' }
        });
      }

      const entries = await knowledgeService.searchKnowledgeEntries(userId, query, category, limitNum);

      return res.send({
        success: true,
        data: { entries }
      });
    } catch (error) {
      console.error('Error searching knowledge entries:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to search knowledge entries' }
      });
    }
  }

  async getKnowledgeCategories(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const userId = req.userId;

      const categories = await knowledgeService.getKnowledgeCategories(userId);

      return res.send({
        success: true,
        data: { categories }
      });
    } catch (error) {
      console.error('Error getting knowledge categories:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get knowledge categories' }
      });
    }
  }

  async getKnowledgeTags(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const userId = req.userId;

      const tags = await knowledgeService.getKnowledgeTags(userId);

      return res.send({
        success: true,
        data: { tags }
      });
    } catch (error) {
      console.error('Error getting knowledge tags:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get knowledge tags' }
      });
    }
  }

  async processKnowledgeCommand(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { command } = req.body as { command: string };
      const userId = req.userId;

      if (!command) {
        return res.status(400).send({
          success: false,
          error: { code: 'MISSING_COMMAND', message: 'Knowledge command is required' }
        });
      }

      const result = await knowledgeAgent.processKnowledgeCommand(userId, command);

      return res.send({
        success: result.success,
        message: result.message,
        data: result.entry || result.entries
      });
    } catch (error) {
      console.error('Error processing knowledge command:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process knowledge command' }
      });
    }
  }
}

export default new KnowledgeController();