import OpenAI from "openai";
import config from "../config";

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

export class OpenAIService {
  async getChatCompletion(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    model: string = "gpt-3.5-turbo",
  ): Promise<string> {
    // Hackathon 0 Principle #1: Local-First (Optional Cloud Toggles)
    if (!config.useCloudServices) {
      console.log(
        "[OpenAIService] Cloud services disabled. Using local heuristic fallback.",
      );
      const lastMessage = messages[messages.length - 1].content;

      // Basic heuristic fallbacks
      if (lastMessage.includes("task") || lastMessage.includes("interpret")) {
        return JSON.stringify({
          title: "Local Task: " + lastMessage.substring(0, 20),
          description: lastMessage,
        });
      }
      return "I'm in local-only mode. I can see your request but my brain is currently limited to this machine! :)";
    }

    try {
      const response = await openai.chat.completions.create({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      return response.choices[0]?.message?.content || "";
    } catch (error) {
      console.error("Error with OpenAI API:", error);
      throw error;
    }
  }

  async generateDraftEmail(
    subject: string,
    recipient: string,
    context: string,
  ): Promise<string> {
    const prompt = `
      You are Mini Hafsa, a helpful AI assistant. Please generate a draft email reply based on the following information:

      Original subject: ${subject}
      Recipient: ${recipient}
      Context: ${context}

      The email should be professional yet friendly, addressing the main points from the context.
      Keep the tone appropriate for the context and relationship with the recipient.
    `;

    try {
      const response = await this.getChatCompletion([
        {
          role: "system",
          content:
            "You are Mini Hafsa, a helpful AI assistant that generates friendly, professional email drafts.",
        },
        { role: "user", content: prompt },
      ]);

      return response.trim();
    } catch (error) {
      console.error("Error generating email draft:", error);
      throw error;
    }
  }

  async generateLinkedInPost(
    topic: string,
    tone: string = "professional",
  ): Promise<string> {
    const prompt = `
      You are Mini Hafsa, a helpful AI assistant. Please generate a LinkedIn post about: ${topic}

      Tone: ${tone}

      The post should include:
      - An engaging hook
      - Valuable insights or information (aim for 200-300 words of depth)
      - A clear call-to-action
      - Proper formatting with line breaks for readability
      - Appropriate emojis to make it visually appealing
      
      Make it substantial and thought-provoking, not just a short blurb.
    `;

    try {
      const response = await this.getChatCompletion([
        {
          role: "system",
          content:
            "You are Mini Hafsa, a helpful AI assistant that generates engaging LinkedIn posts with proper formatting and value for readers.",
        },
        { role: "user", content: prompt },
      ]);

      return response.trim();
    } catch (error) {
      console.error("Error generating LinkedIn post:", error);
      throw error;
    }
  }

  async generateNewsSummary(
    articles: Array<{ title: string; content: string }>,
  ): Promise<string> {
    const content = articles
      .map((article) => `${article.title}: ${article.content}`)
      .join("\n\n");
    const prompt = `
      You are Mini Hafsa, a helpful AI assistant. Please create a concise summary of the following news articles:

      ${content}

      The summary should highlight the most important points and be suitable for sharing in a chat interface.
    `;

    try {
      const response = await this.getChatCompletion([
        {
          role: "system",
          content:
            "You are Mini Hafsa, a helpful AI assistant that creates concise, informative summaries of news articles.",
        },
        { role: "user", content: prompt },
      ]);

      return response.trim();
    } catch (error) {
      console.error("Error generating news summary:", error);
      throw error;
    }
  }

  async processNaturalLanguageTask(
    input: string,
  ): Promise<{ title: string; description?: string; dueDate?: Date }> {
    const prompt = `
      You are Mini Hafsa, a helpful AI assistant. Please interpret the following user input as a task or reminder:

      "${input}"

      Extract the following information:
      - Task title (short, descriptive)
      - Task description (more details if provided)
      - Due date if mentioned (in ISO format)

      Respond in JSON format with keys: title, description, dueDate
    `;

    try {
      const response = await this.getChatCompletion([
        {
          role: "system",
          content:
            "You are Mini Hafsa, a helpful AI assistant that interprets natural language input to create tasks with title, description, and due date.",
        },
        { role: "user", content: prompt },
      ]);

      // Attempt to parse the response as JSON
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        const jsonStr = match[0];
        const parsed = JSON.parse(jsonStr);
        return {
          title: parsed.title || input,
          description: parsed.description,
          dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
        };
      } else {
        // If no JSON found, return a basic interpretation
        return {
          title: input.substring(0, 50),
          description: input,
        };
      }
    } catch (error) {
      console.error("Error processing natural language task:", error);
      // Return a basic interpretation in case of error
      return {
        title: input.substring(0, 50),
        description: input,
      };
    }
  }
}

export default new OpenAIService();
