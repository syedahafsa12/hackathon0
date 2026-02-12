import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { AuthenticatedRequest } from "../middleware/auth";

const DEV_USER_ID = "dev-user-001";

// Mock news data - in production this would fetch from real news APIs
const generateMockNews = (categories: string[]) => {
  const allNews = [
    {
      id: `news-ai-1`,
      source: "MIT Technology Review",
      content:
        "Researchers achieve breakthrough in neural network efficiency, reducing computational costs by 40% while maintaining accuracy.",
      category: "AI",
      publishedAt: new Date(),
    },
    {
      id: `news-ai-2`,
      source: "arXiv",
      content:
        "New paper demonstrates multimodal AI systems that can reason across text, images, and code simultaneously.",
      category: "AI",
      publishedAt: new Date(),
    },
    {
      id: `news-tech-1`,
      source: "TechCrunch",
      content:
        "Quantum computing startup achieves 1000-qubit milestone, bringing practical quantum advantage closer to reality.",
      category: "tech",
      publishedAt: new Date(),
    },
    {
      id: `news-tech-2`,
      source: "Ars Technica",
      content:
        "New battery technology promises 500-mile EV range with 10-minute charging times.",
      category: "tech",
      publishedAt: new Date(),
    },
    {
      id: `news-world-1`,
      source: "Reuters",
      content:
        "Global renewable energy capacity surpasses fossil fuel capacity for the first time in history.",
      category: "world-impact",
      publishedAt: new Date(),
    },
    {
      id: `news-world-2`,
      source: "Bloomberg",
      content:
        "Major economies announce coordinated climate action plan targeting net-zero emissions by 2040.",
      category: "world-impact",
      publishedAt: new Date(),
    },
  ];

  if (categories.length === 0 || categories.includes("all")) {
    return allNews;
  }

  return allNews.filter((n) => categories.includes(n.category));
};

export default async function newsRoutes(fastify: FastifyInstance) {
  const injectDevUserId = async (req: FastifyRequest) => {
    if (process.env.NODE_ENV !== "production") {
      (req as AuthenticatedRequest).userId = DEV_USER_ID;
    }
  };

  // Real News API integration
  fastify.get(
    "/api/news",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const { categories } = req.query as { categories?: string };
        const apiKey = process.env.NEWS_API_KEY;

        if (!apiKey) {
          throw new Error("NEWS_API_KEY not configured");
        }

        const categoryList = categories
          ? categories.split(",")
          : ["technology", "business", "science"];

        console.log(
          "[NewsRoutes] Fetching real news for categories:",
          categoryList,
        );

        // Fetch from NewsAPI (using top-headlines for "now" feel)
        const { default: axios } = await import("axios");

        // We pick the first category for the main headline, or join them in a query
        const response = await axios.get(
          "https://newsapi.org/v2/top-headlines",
          {
            params: {
              apiKey,
              category: categoryList[0], // NewsAPI top-headlines supports one category at a time
              language: "en",
            },
          },
        );

        const news = response.data.articles.map(
          (article: any, index: number) => ({
            id: `news-${index}`,
            source: article.source.name,
            content: article.title,
            url: article.url,
            category: categoryList[0],
            publishedAt: new Date(article.publishedAt),
          }),
        );

        console.log("[NewsRoutes] Returning real news items:", news.length);

        return res.send({
          success: true,
          data: { news },
        });
      } catch (error: any) {
        console.error("[NewsRoutes] Error fetching news:", error);
        return res.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: error.message || "Failed to fetch news",
          },
        });
      }
    },
  );

  // Get news digest
  fastify.get(
    "/api/news/digest",
    { preHandler: injectDevUserId },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        console.log("[NewsRoutes] Generating news digest");

        const news = generateMockNews(["AI", "tech", "world-impact"]);

        const digest = {
          content:
            "Today's key developments: AI efficiency breakthroughs, quantum computing milestones, and global renewable energy transitions.",
          articles: news.slice(0, 5),
          generatedAt: new Date(),
        };

        return res.send({
          success: true,
          data: { digest },
        });
      } catch (error: any) {
        console.error("[NewsRoutes] Error generating digest:", error);
        return res.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to generate digest",
          },
        });
      }
    },
  );
}
