import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface SearchResult {
  query: string;
  results: any;
  timestamp: Date;
}

export class SearchCache {
  /**
   * Get cached search results for a query
   */
  async getCachedSearch(
    query: string,
    userId: string,
  ): Promise<SearchResult | null> {
    try {
      const normalizedQuery = query.toLowerCase().trim();

      const entry = await prisma.knowledgeEntry.findFirst({
        where: {
          userId,
          category: "search_result",
          title: normalizedQuery,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!entry) {
        return null;
      }

      // Parse the stored content
      const content = JSON.parse(entry.content);

      return {
        query: entry.title,
        results: content.results,
        timestamp: entry.createdAt,
      };
    } catch (error) {
      console.error("[SearchCache] Error getting cached search:", error);
      return null;
    }
  }

  /**
   * Cache search results
   */
  async cacheSearch(
    query: string,
    results: any,
    userId: string,
  ): Promise<void> {
    try {
      const normalizedQuery = query.toLowerCase().trim();

      await prisma.knowledgeEntry.create({
        data: {
          userId,
          category: "search_result",
          title: normalizedQuery,
          content: JSON.stringify({
            query: normalizedQuery,
            results,
            cachedAt: new Date().toISOString(),
          }),
          tags: "search,cached",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log(`[SearchCache] Cached search results for: "${query}"`);
    } catch (error) {
      console.error("[SearchCache] Error caching search:", error);
    }
  }

  /**
   * Check if cached results are still fresh (within 24 hours)
   */
  isFresh(timestamp: Date): boolean {
    const hoursSinceCache =
      (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
    return hoursSinceCache < 24;
  }
}

export default new SearchCache();
