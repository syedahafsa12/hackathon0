// Configuration for news sources

export interface NewsSourceConfig {
  id: string;
  name: string;
  apiUrl: string;
  apiKey?: string;
  categories: string[];
  rateLimit: number; // requests per minute
  enabled: boolean;
}

export const newsSources: NewsSourceConfig[] = [
  {
    id: 'newsapi',
    name: 'NewsAPI',
    apiUrl: 'https://newsapi.org/v2',
    apiKey: process.env.NEWSAPI_API_KEY,
    categories: ['general', 'technology', 'science', 'business'],
    rateLimit: 100, // 100 requests per minute for basic plan
    enabled: !!process.env.NEWSAPI_API_KEY
  },
  {
    id: 'guardian',
    name: 'The Guardian',
    apiUrl: 'https://content.guardianapis.com',
    apiKey: process.env.GUARDIAN_API_KEY,
    categories: ['world', 'politics', 'business', 'technology'],
    rateLimit: 5000, // 5000 requests per day for free plan
    enabled: !!process.env.GUARDIAN_API_KEY
  },
  {
    id: 'reddit',
    name: 'Reddit News',
    apiUrl: 'https://www.reddit.com/r/',
    apiKey: undefined,
    categories: ['technology', 'science', 'world-news'],
    rateLimit: 100, // Limiting to avoid being blocked
    enabled: true
  },
  {
    id: 'rss-feeds',
    name: 'Custom RSS Feeds',
    apiUrl: '',
    apiKey: undefined,
    categories: ['AI', 'tech', 'world-impact'],
    rateLimit: 50, // Per feed
    enabled: true
  }
];

export const defaultNewsCategories = [
  'AI',
  'technology',
  'science',
  'world',
  'business',
  'politics'
];

export const aiNewsSources = [
  'https://www.technologyreview.com/topic/artificial-intelligence/feed/',
  'https://feeds.axios.com/axios/science-and-tech',
  'https://www.wired.com/feed/category/ai/latest/rss'
];

export const techNewsSources = [
  'https://feeds.reuters.com/reuters/technologyNews',
  'https://www.theverge.com/rss/index.xml',
  'https://techcrunch.com/feed/'
];

export const worldImpactSources = [
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://rss.cnn.com/rss/edition.rss',
  'https://www.theguardian.com/world/rss'
];