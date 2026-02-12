import { Mistral } from "@mistralai/mistralai";
import { config } from "../../config";
import { MistralResponse, IntentEntities, DEFAULT_CONFIG } from "./intentTypes";
import { getSystemPrompt } from "./systemPrompt";

/**
 * Wrapper for Mistral AI client for intent classification
 */
export class MistralClient {
  private client: Mistral | null = null;
  private model: string;
  private timeoutMs: number;

  constructor(
    model: string = DEFAULT_CONFIG.mistralModel,
    timeoutMs: number = DEFAULT_CONFIG.timeoutMs,
  ) {
    this.model = model;
    this.timeoutMs = timeoutMs;

    if (config.mistralApiKey) {
      this.client = new Mistral({ apiKey: config.mistralApiKey });
      console.log("MistralClient initialized successfully");
    } else {
      console.warn(
        "MISTRAL_API_KEY not configured - MistralClient will use fallback mode",
      );
    }
  }

  /**
   * Classify user message and extract intent + entities
   */
  async classify(
    userMessage: string,
    conversationContext?: string[],
  ): Promise<MistralResponse> {
    if (!this.client) {
      // Fallback when no API key configured
      return this.fallbackClassify(userMessage);
    }

    try {
      // Get current date/time in Karachi for the prompt
      const currentDate = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Karachi",
        dateStyle: "full",
        timeStyle: "short",
      });

      const systemPrompt = getSystemPrompt({ currentDate });

      // Build messages array
      const messages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
      }> = [{ role: "system", content: systemPrompt }];

      // Add conversation context if available
      if (conversationContext && conversationContext.length > 0) {
        for (const ctx of conversationContext.slice(-5)) {
          // Last 5 messages
          messages.push({ role: "user", content: ctx });
        }
      }

      // Add current user message
      messages.push({ role: "user", content: userMessage });

      // Call Mistral API with JSON output format and timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        console.log(
          `[MistralClient] Sending request to Mistral API (model: ${this.model})`,
        );
        console.log(
          `[MistralClient] User message: "${userMessage.substring(0, 100)}..."`,
        );

        const response = await this.client.chat.complete({
          model: this.model,
          messages,
          responseFormat: { type: "json_object" },
        });
        clearTimeout(timeoutId);

        console.log("[MistralClient] Received response from Mistral API");

        // Parse JSON response
        const rawContent = response.choices?.[0]?.message?.content;
        if (!rawContent) {
          throw new Error("Empty response from Mistral");
        }

        // Handle both string and array content types
        const content =
          typeof rawContent === "string"
            ? rawContent
            : JSON.stringify(rawContent);
        const parsed = JSON.parse(content) as MistralResponse;

        // Validate and normalize response
        const normalized = this.normalizeResponse(parsed, userMessage);
        console.log(
          `[MistralClient] Parsed response - Intent: ${normalized.intent}, Confidence: ${normalized.confidence.toFixed(2)}`,
        );
        return normalized;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error("[MistralClient] Error calling Mistral API:", error);
      console.log("[MistralClient] Falling back to local classification");
      // Return fallback on error
      return this.fallbackClassify(userMessage);
    }
  }

  /**
   * Normalize and validate Mistral response
   */
  private normalizeResponse(
    response: MistralResponse,
    userMessage: string,
  ): MistralResponse {
    // Ensure confidence is between 0 and 1
    const confidence = Math.max(0, Math.min(1, response.confidence || 0));

    // Ensure intent is valid
    const validIntents = [
      "GREETING",
      "CHAT",
      "SEND_EMAIL",
      "CREATE_TASK",
      "CREATE_REMINDER",
      "CHECK_CALENDAR",
      "CREATE_CALENDAR_EVENT",
      "SEARCH",
      "RESEARCH",
      "UNKNOWN",
    ];
    const intent = validIntents.includes(response.intent)
      ? response.intent
      : "UNKNOWN";

    // Ensure entities object exists
    const entities: IntentEntities = response.entities || {};

    return {
      intent,
      confidence,
      entities,
      conversational_response: response.conversational_response,
    };
  }

  /**
   * Fallback classification when Mistral is unavailable
   * Enhanced keyword matching for all action types (DEMO_MODE friendly)
   */
  private fallbackClassify(userMessage: string): MistralResponse {
    const lowerMessage = userMessage.toLowerCase().trim();
    console.log(
      `[MistralClient] Using keyword fallback for: "${lowerMessage.substring(0, 50)}..."`,
    );

    // Simple greeting detection
    if (
      /^(hi|hello|hey|good morning|good afternoon|good evening|yo|sup)[\s!.,]*$/i.test(
        lowerMessage,
      )
    ) {
      return {
        intent: "GREETING",
        confidence: 0.95,
        entities: {},
        conversational_response: "Hey! What can I help you with today?",
      };
    }

    // Simple thanks detection
    if (
      /^(thanks|thank you|thx|ty|appreciate it)[\s!.,]*$/i.test(lowerMessage)
    ) {
      return {
        intent: "CHAT",
        confidence: 0.9,
        entities: {},
        conversational_response:
          "Anytime! Let me know if you need anything else.",
      };
    }

    // Email detection - matches "send email", "email to", "mail to"
    if (
      lowerMessage.includes("email") ||
      lowerMessage.includes("mail") ||
      (lowerMessage.includes("send") && lowerMessage.includes("@"))
    ) {
      const emailMatch = userMessage.match(/[\w.-]+@[\w.-]+\.\w+/);
      // Extract subject if present (after "about" or "re:" or "subject:")
      const subjectMatch = userMessage.match(
        /(?:about|re:|subject:)\s*(.+?)(?:$|saying|body|content)/i,
      );
      // Extract body if present
      const bodyMatch = userMessage.match(/(?:saying|body:|content:)\s*(.+)/i);

      return {
        intent: "SEND_EMAIL",
        confidence: 0.85,
        entities: {
          recipient: emailMatch?.[0],
          emailSubject: subjectMatch?.[1]?.trim(),
          emailBody: bodyMatch?.[1]?.trim() || userMessage,
        },
      };
    }

    // LinkedIn post detection
    if (
      lowerMessage.includes("linkedin") ||
      lowerMessage.includes("post") ||
      lowerMessage.includes("social media")
    ) {
      return {
        intent: "SEND_EMAIL", // Maps to linkedin_post via different handler
        confidence: 0.8,
        entities: {
          platform: "linkedin",
          postContent: userMessage,
        },
      };
    }

    // Reminder detection - matches "remind me", "reminder", "don't forget"
    if (
      lowerMessage.includes("remind") ||
      lowerMessage.includes("don't forget") ||
      lowerMessage.includes("reminder")
    ) {
      // Try to extract time
      const timeMatch = userMessage.match(
        /(?:at|in|tomorrow|today|next)\s+(\S+(?:\s+\S+)?)/i,
      );
      return {
        intent: "CREATE_REMINDER",
        confidence: 0.85,
        entities: {
          reminderText: userMessage,
          reminderTime: timeMatch?.[1],
        },
      };
    }

    // Task/todo detection
    if (
      lowerMessage.includes("task") ||
      lowerMessage.includes("todo") ||
      lowerMessage.includes("to-do") ||
      lowerMessage.includes("add to list")
    ) {
      return {
        intent: "CREATE_TASK",
        confidence: 0.8,
        entities: {
          taskDescription: userMessage,
        },
      };
    }

    // Calendar event creation - matches "schedule", "create event", "book meeting"
    if (
      (lowerMessage.includes("schedule") &&
        (lowerMessage.includes("meeting") || lowerMessage.includes("event"))) ||
      lowerMessage.includes("create event") ||
      lowerMessage.includes("book meeting") ||
      lowerMessage.includes("add to calendar")
    ) {
      return {
        intent: "CREATE_CALENDAR_EVENT",
        confidence: 0.8,
        entities: {
          eventDescription: userMessage,
        },
      };
    }

    // Calendar check - matches "check calendar", "what's on my calendar", "am i free"
    if (
      lowerMessage.includes("calendar") ||
      lowerMessage.includes("what's on") ||
      lowerMessage.includes("am i free") ||
      lowerMessage.includes("my schedule")
    ) {
      return {
        intent: "CHECK_CALENDAR",
        confidence: 0.8,
        entities: {},
      };
    }

    // Knowledge/note saving - matches "remember", "note", "save this"
    if (
      lowerMessage.includes("remember this") ||
      lowerMessage.includes("note") ||
      lowerMessage.includes("save this") ||
      lowerMessage.includes("knowledge")
    ) {
      return {
        intent: "RESEARCH", // Maps to knowledge_save
        confidence: 0.75,
        entities: {
          content: userMessage,
        },
      };
    }

    // Search detection
    if (
      lowerMessage.includes("search") ||
      lowerMessage.includes("find") ||
      lowerMessage.includes("look up") ||
      lowerMessage.includes("google")
    ) {
      return {
        intent: "SEARCH",
        confidence: 0.75,
        entities: {
          searchQuery: userMessage,
        },
      };
    }

    // Research detection
    if (
      lowerMessage.includes("research") ||
      lowerMessage.includes("investigate") ||
      lowerMessage.includes("look into")
    ) {
      return {
        intent: "RESEARCH",
        confidence: 0.75,
        entities: {
          topic: userMessage,
        },
      };
    }

    // Unknown intent with friendly response
    console.log(`[MistralClient] No keyword match found, returning UNKNOWN`);
    return {
      intent: "UNKNOWN",
      confidence: 0.5,
      entities: {},
      conversational_response:
        "I'm not quite sure what you'd like me to do. Could you tell me more? Try saying things like 'send email to...', 'remind me to...', or 'schedule a meeting...'",
    };
  }
}

// Singleton instance
export const mistralClient = new MistralClient();
export default mistralClient;
