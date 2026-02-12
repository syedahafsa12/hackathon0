import { PrismaClient } from '@prisma/client';
import openaiService from '../openaiService';

const prisma = new PrismaClient();

export class NewsAgent {
  async fetchNews(userId: string, categories: string[] = ['AI', 'tech', 'world-impact'], limit: number = 5) {
    try {
      // In a real implementation, this would fetch from news APIs
      // For now, we'll create mock news based on categories
      const mockNews = this.generateMockNews(categories, limit);

      // Create news digest entries in the database
      const newsDigests = [];
      for (const article of mockNews) {
        const newsEntry = await prisma.newsDigest.create({
          data: {
            id: `news-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId,
            content: article.summary,
            source: article.source,
            publishedAt: new Date(article.publishedAt),
            category: article.category as 'AI' | 'tech' | 'world-impact'
          }
        });
        newsDigests.push(newsEntry);
      }

      return {
        success: true,
        message: `Fetched ${newsDigests.length} news articles`,
        news: newsDigests.map(digest => ({
          id: digest.id,
          content: digest.content,
          source: digest.source,
          publishedAt: digest.publishedAt,
          category: digest.category
        }))
      };
    } catch (error) {
      console.error('Error fetching news:', error);
      throw error;
    }
  }

  async generateNewsDigest(userId: string, topics: string[] = [], timeFrame: 'daily' | 'weekly' = 'daily') {
    try {
      // Determine categories based on user preferences or default to all
      const categories = topics.length > 0 ? topics : ['AI', 'tech', 'world-impact'];

      // Fetch relevant news
      const newsResult = await this.fetchNews(userId, categories, 10);

      // Use OpenAI to generate a concise digest
      const articlesText = newsResult.news.map(article =>
        `${article.source}: ${article.content}`
      ).join('\n\n');

      const digestContent = await openaiService.generateNewsSummary(
        newsResult.news.map(article => ({
          title: article.source,
          content: article.content
        }))
      );

      return {
        success: true,
        message: 'Generated news digest',
        digest: {
          content: digestContent,
          articles: newsResult.news,
          generatedAt: new Date()
        }
      };
    } catch (error) {
      console.error('Error generating news digest:', error);
      throw error;
    }
  }

  async getNewsHistory(userId: string, category?: 'AI' | 'tech' | 'world-impact', limit: number = 20) {
    try {
      const whereClause: any = { userId };

      if (category) {
        whereClause.category = category;
      }

      const newsEntries = await prisma.newsDigest.findMany({
        where: whereClause,
        orderBy: { publishedAt: 'desc' },
        take: limit
      });

      return {
        success: true,
        news: newsEntries.map(entry => ({
          id: entry.id,
          content: entry.content,
          source: entry.source,
          publishedAt: entry.publishedAt,
          category: entry.category as 'AI' | 'tech' | 'world-impact'
        }))
      };
    } catch (error) {
      console.error('Error getting news history:', error);
      throw error;
    }
  }

  async processNewsCommand(userId: string, command: string) {
    try {
      // Parse the command to determine intent
      const intent = this.identifyIntent(command);

      switch (intent) {
        case 'fetch_news':
          return await this.handleFetchNews(userId, command);
        case 'generate_digest':
          return await this.handleGenerateDigest(userId, command);
        case 'view_history':
          return await this.handleViewHistory(userId, command);
        default:
          return {
            success: false,
            message: 'Unable to understand the news command. Try phrases like "get today\'s AI news" or "summarize tech news"'
          };
      }
    } catch (error) {
      console.error('Error processing news command:', error);
      throw error;
    }
  }

  private identifyIntent(command: string): string {
    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes('get') || lowerCommand.includes('fetch') ||
        lowerCommand.includes('show') || lowerCommand.includes('latest') ||
        lowerCommand.includes('recent')) {
      return 'fetch_news';
    } else if (lowerCommand.includes('summarize') || lowerCommand.includes('digest') ||
               lowerCommand.includes('summary') || lowerCommand.includes('roundup')) {
      return 'generate_digest';
    } else if (lowerCommand.includes('history') || lowerCommand.includes('past') ||
               lowerCommand.includes('previous') || lowerCommand.includes('old')) {
      return 'view_history';
    } else {
      // Default to fetch news for commands that might be requesting news
      return 'fetch_news';
    }
  }

  private async handleFetchNews(userId: string, command: string) {
    // Extract categories/topics from command
    const categories: string[] = [];

    if (command.toLowerCase().includes('ai') || command.toLowerCase().includes('artificial intelligence')) {
      categories.push('AI');
    }
    if (command.toLowerCase().includes('tech') || command.toLowerCase().includes('technology')) {
      categories.push('tech');
    }
    if (command.toLowerCase().includes('world') || command.toLowerCase().includes('global') ||
        command.toLowerCase().includes('impact') || command.toLowerCase().includes('climate')) {
      categories.push('world-impact');
    }

    // If no specific categories mentioned, default to all
    if (categories.length === 0) {
      categories.push('AI', 'tech', 'world-impact');
    }

    return await this.fetchNews(userId, categories);
  }

  private async handleGenerateDigest(userId: string, command: string) {
    // Extract topics from command
    const topics: string[] = [];

    if (command.toLowerCase().includes('ai') || command.toLowerCase().includes('artificial intelligence')) {
      topics.push('AI');
    }
    if (command.toLowerCase().includes('tech') || command.toLowerCase().includes('technology')) {
      topics.push('tech');
    }
    if (command.toLowerCase().includes('world') || command.toLowerCase().includes('global') ||
        command.toLowerCase().includes('impact') || command.toLowerCase().includes('climate')) {
      topics.push('world-impact');
    }

    return await this.generateNewsDigest(userId, topics);
  }

  private async handleViewHistory(userId: string, command: string) {
    // Determine category if specified
    let category: 'AI' | 'tech' | 'world-impact' | undefined;

    if (command.toLowerCase().includes('ai')) {
      category = 'AI';
    } else if (command.toLowerCase().includes('tech')) {
      category = 'tech';
    } else if (command.toLowerCase().includes('world') || command.toLowerCase().includes('global') ||
               command.toLowerCase().includes('impact')) {
      category = 'world-impact';
    }

    return await this.getNewsHistory(userId, category);
  }

  private generateMockNews(categories: string[], limit: number) {
    const mockArticles = [];

    for (let i = 0; i < limit; i++) {
      const category = categories[i % categories.length];

      mockArticles.push({
        id: `mock-news-${Date.now()}-${i}`,
        title: `Latest Developments in ${category}: ${this.getRandomNewsTitle(category)}`,
        summary: this.getRandomNewsSummary(category),
        source: this.getRandomNewsSource(),
        publishedAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(), // Within last week
        category: category
      });
    }

    return mockArticles;
  }

  private getRandomNewsTitle(category: string): string {
    const aiTitles = [
      "Breakthrough in Neural Network Efficiency",
      "New AI Model Achieves Human-Level Performance",
      "Ethical Guidelines for AI Deployment Released",
      "AI Predicts Protein Structures with Unprecedented Accuracy"
    ];

    const techTitles = [
      "Quantum Computing Milestone Achieved",
      "New Programming Language Promises Enhanced Security",
      "Major Tech Company Announces Revolutionary Device",
      "Cloud Infrastructure Costs Drop Significantly"
    ];

    const worldImpactTitles = [
      "Global Initiative to Combat Climate Change Launched",
      "Breakthrough in Renewable Energy Storage Announced",
      "International Agreement on Space Exploration Signed",
      "New Approach to Global Health Crisis Shows Promise"
    ];

    const titlesMap: Record<string, string[]> = {
      'AI': aiTitles,
      'tech': techTitles,
      'world-impact': worldImpactTitles
    };

    const titles = titlesMap[category] || aiTitles;
    return titles[Math.floor(Math.random() * titles.length)];
  }

  private getRandomNewsSummary(category: string): string {
    const aiSummaries = [
      `Researchers have developed a new technique that reduces the computational requirements of neural networks by 50% while maintaining accuracy. This breakthrough could make AI more accessible to organizations with limited resources.`,
      `A new artificial intelligence model has demonstrated the ability to perform complex reasoning tasks at a level comparable to human experts. The development marks a significant step forward in general AI capabilities.`,
      `Leading technology companies and research institutions have released a comprehensive set of ethical guidelines for AI development and deployment, addressing concerns about bias, transparency, and accountability.`,
      `Scientists have used advanced AI algorithms to predict protein structures with unprecedented accuracy, opening new avenues for drug discovery and medical treatments.`
    ];

    const techSummaries = [
      `Physicists have achieved a significant milestone in quantum computing, demonstrating stable qubit operations for longer periods than ever before. This advancement brings practical quantum computers closer to reality.`,
      `A new programming language has been developed with built-in security features that prevent common vulnerabilities like buffer overflows and injection attacks. Early adopters report significant improvements in application security.`,
      `A major technology company has announced a revolutionary device that combines computing, communication, and sensing capabilities in a compact form factor, promising to transform how we interact with digital information.`,
      `Recent advances in cloud infrastructure technology have led to a 30% reduction in operational costs for businesses, making enterprise-grade computing more affordable for small and medium-sized organizations.`
    ];

    const worldImpactSummaries = [
      `A coalition of nations has launched an ambitious global initiative to combat climate change, combining technological innovation with policy reform. The program aims to achieve carbon neutrality within the next two decades.`,
      `Scientists have announced a breakthrough in renewable energy storage technology, solving one of the major obstacles to widespread adoption of solar and wind power. The innovation could accelerate the transition to clean energy.`,
      `Representatives from multiple countries have signed an international agreement establishing frameworks for peaceful space exploration and resource utilization, setting precedents for future interplanetary cooperation.`,
      `Health researchers have developed a novel approach to addressing global health crises, combining predictive modeling with community-based interventions. Early trials show promising results in preventing disease outbreaks.`
    ];

    const summariesMap: Record<string, string[]> = {
      'AI': aiSummaries,
      'tech': techSummaries,
      'world-impact': worldImpactSummaries
    };

    const summaries = summariesMap[category] || aiSummaries;
    return summaries[Math.floor(Math.random() * summaries.length)];
  }

  private getRandomNewsSource(): string {
    const sources = [
      'TechCrunch',
      'MIT Technology Review',
      'Wired',
      'The Verge',
      'IEEE Spectrum',
      'Nature',
      'Science Magazine',
      'BBC Science',
      'Reuters Technology',
      'Associated Press'
    ];

    return sources[Math.floor(Math.random() * sources.length)];
  }
}

export default new NewsAgent();