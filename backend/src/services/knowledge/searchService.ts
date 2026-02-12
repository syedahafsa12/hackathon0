import { PrismaClient } from '@prisma/client';
import { KnowledgeEntry } from '../../../../shared/types';

const prisma = new PrismaClient();

export class SearchService {
  async fullTextSearch(userId: string, query: string, category?: string, tags?: string[], limit: number = 50): Promise<KnowledgeEntry[]> {
    try {
      // Basic full-text search implementation
      // In a real application, you'd want to use a proper search engine like Elasticsearch or PostgreSQL's full-text search

      const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);

      if (searchTerms.length === 0) {
        return [];
      }

      // Build search conditions
      const searchConditions: any = {
        userId,
        OR: []
      };

      // Add conditions for each search term
      for (const term of searchTerms) {
        searchConditions.OR.push({
          title: { contains: term, mode: 'insensitive' }
        });
        searchConditions.OR.push({
          content: { contains: term, mode: 'insensitive' }
        });
        searchConditions.OR.push({
          tags: { has: term }
        });
      }

      // Add category filter if specified
      if (category) {
        searchConditions.category = category;
      }

      // Add tags filter if specified
      if (tags && tags.length > 0) {
        searchConditions.tags = {
          hasSome: tags
        };
      }

      // Perform the search
      const entries = await prisma.knowledgeEntry.findMany({
        where: searchConditions,
        orderBy: [
          // Prioritize entries with terms in the title
          {
            title: {
              contains: query,
              mode: 'insensitive'
            }
          },
          // Then by recency
          { lastAccessed: 'desc' }
        ],
        take: limit
      });

      return entries.map(entry => ({
        id: entry.id,
        userId: entry.userId,
        title: entry.title,
        content: entry.content,
        category: entry.category,
        tags: entry.tags as string[],
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        lastAccessed: entry.lastAccessed
      }));
    } catch (error) {
      console.error('Error in full-text search:', error);
      throw error;
    }
  }

  async semanticSearch(userId: string, query: string, category?: string, tags?: string[], limit: number = 50): Promise<KnowledgeEntry[]> {
    // In a real implementation, this would use embeddings and vector similarity search
    // For now, we'll fall back to the full-text search
    return this.fullTextSearch(userId, query, category, tags, limit);
  }

  async searchByCategory(userId: string, category: string, limit: number = 50): Promise<KnowledgeEntry[]> {
    try {
      const entries = await prisma.knowledgeEntry.findMany({
        where: {
          userId,
          category
        },
        orderBy: { lastAccessed: 'desc' },
        take: limit
      });

      return entries.map(entry => ({
        id: entry.id,
        userId: entry.userId,
        title: entry.title,
        content: entry.content,
        category: entry.category,
        tags: entry.tags as string[],
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        lastAccessed: entry.lastAccessed
      }));
    } catch (error) {
      console.error('Error searching by category:', error);
      throw error;
    }
  }

  async searchByTags(userId: string, tags: string[], limit: number = 50): Promise<KnowledgeEntry[]> {
    try {
      const entries = await prisma.knowledgeEntry.findMany({
        where: {
          userId,
          tags: {
            hasSome: tags
          }
        },
        orderBy: { lastAccessed: 'desc' },
        take: limit
      });

      return entries.map(entry => ({
        id: entry.id,
        userId: entry.userId,
        title: entry.title,
        content: entry.content,
        category: entry.category,
        tags: entry.tags as string[],
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        lastAccessed: entry.lastAccessed
      }));
    } catch (error) {
      console.error('Error searching by tags:', error);
      throw error;
    }
  }

  async getRelatedEntries(userId: string, entryId: string, limit: number = 5): Promise<KnowledgeEntry[]> {
    try {
      // Get the original entry to extract its category and tags
      const originalEntry = await prisma.knowledgeEntry.findUnique({
        where: { id: entryId }
      });

      if (!originalEntry || originalEntry.userId !== userId) {
        return [];
      }

      // Find entries with similar tags or category
      const relatedEntries = await prisma.knowledgeEntry.findMany({
        where: {
          userId,
          id: { not: entryId }, // Exclude the original entry
          OR: [
            { category: originalEntry.category }, // Same category
            { tags: { hasSome: originalEntry.tags as string[] } } // Similar tags
          ]
        },
        orderBy: { lastAccessed: 'desc' },
        take: limit
      });

      return relatedEntries.map(entry => ({
        id: entry.id,
        userId: entry.userId,
        title: entry.title,
        content: entry.content,
        category: entry.category,
        tags: entry.tags as string[],
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        lastAccessed: entry.lastAccessed
      }));
    } catch (error) {
      console.error('Error getting related entries:', error);
      throw error;
    }
  }
}

export default new SearchService();