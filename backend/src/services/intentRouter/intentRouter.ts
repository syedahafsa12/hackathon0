import { mistralClient } from "./mistralClient";
import {
  IntentType,
  IntentClassification,
  IntentRouterResponse,
  IntentRouterConfig,
  DEFAULT_CONFIG,
  isActionableIntent,
  isConversationalIntent,
  intentToActionType,
  requiresApproval,
} from "./intentTypes";
import approvalService from "../approval/approvalService";

/**
 * Main IntentRouter service for processing user messages
 */
export class IntentRouter {
  private config: IntentRouterConfig;

  constructor(config: Partial<IntentRouterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log(
      `IntentRouter initialized with confidence threshold: ${this.config.confidenceThreshold}`,
    );
  }

  /**
   * Process a user message and return appropriate response
   */
  async processMessage(
    userId: string,
    userMessage: string,
    conversationContext?: string[],
  ): Promise<IntentRouterResponse> {
    const timestamp = new Date().toISOString();

    console.log(`[IntentRouter] ===== PROCESSING MESSAGE =====`);
    console.log(`[IntentRouter] User ID: ${userId}`);
    console.log(`[IntentRouter] Message: "${userMessage}"`);

    try {
      // Step 0: Fast Heuristic Check for specific commands (bypass Mistral)
      // This ensures "fetch news", "run ralph", "get quote" work instantly
      const lowerMsg = userMessage.toLowerCase();
      let heuristicIntent: IntentType | null = null;
      let heuristicEntities: any = {};

      if (
        lowerMsg.includes("fetch news") ||
        lowerMsg.includes("get news") ||
        lowerMsg.includes("show news") ||
        lowerMsg.includes("headlines")
      ) {
        heuristicIntent = IntentType.FETCH_NEWS;
      } else if (
        lowerMsg.includes("run ralph") ||
        lowerMsg.includes("start ralph") ||
        lowerMsg.includes("execute loop")
      ) {
        heuristicIntent = IntentType.RALPH_LOOP_START;
        heuristicEntities = {
          ralphPrompt: userMessage
            .replace(/run ralph/i, "")
            .replace(/start ralph/i, "")
            .trim(),
        };
      } else if (
        lowerMsg.includes("quote") ||
        lowerMsg.includes("inspire me") ||
        lowerMsg.includes("motivation")
      ) {
        heuristicIntent = IntentType.GET_QUOTE;
      }

      let mistralResponse;

      if (heuristicIntent) {
        console.log(
          `[IntentRouter] Heuristic match: ${heuristicIntent} (bypassing Mistral)`,
        );
        mistralResponse = {
          intent: heuristicIntent,
          confidence: 1.0,
          entities: heuristicEntities,
          conversational_response: undefined,
        };
      } else {
        // Step 1: Classify intent using Mistral
        mistralResponse = await mistralClient.classify(
          userMessage,
          conversationContext,
        );
      }

      // Log intent and confidence for debugging
      console.log(
        `[IntentRouter] User: "${userMessage.substring(0, 50)}..." -> Intent: ${mistralResponse.intent}, Confidence: ${mistralResponse.confidence.toFixed(2)}`,
      );

      // Step 2: Create classification object
      const classification: IntentClassification = {
        intent: mistralResponse.intent as IntentType,
        confidence: mistralResponse.confidence,
        entities: mistralResponse.entities,
        conversationalResponse: mistralResponse.conversational_response,
        rawUserMessage: userMessage,
        timestamp,
      };

      // Step 3: Route based on intent type and confidence
      return await this.routeIntent(userId, classification);
    } catch (error) {
      console.error("[IntentRouter] Error processing message:", error);

      // Return friendly error response
      return {
        message:
          "I'm having a little trouble right now. Could you try that again?",
        classification: {
          intent: IntentType.UNKNOWN,
          confidence: 0,
          entities: {},
          rawUserMessage: userMessage,
          timestamp,
        },
        eventCreated: false,
        needsClarification: true,
      };
    }
  }

  /**
   * Route intent to appropriate handler
   */
  private async routeIntent(
    userId: string,
    classification: IntentClassification,
  ): Promise<IntentRouterResponse> {
    const { intent, confidence } = classification;

    // Handle conversational intents immediately
    if (isConversationalIntent(intent)) {
      return this.handleConversational(classification);
    }

    // Handle actionable intents
    if (isActionableIntent(intent)) {
      // Check confidence threshold
      if (confidence < this.config.confidenceThreshold) {
        return this.handleLowConfidence(classification);
      }
      return await this.handleActionable(userId, classification);
    }

    // Handle unknown intent
    return this.handleUnknown(classification);
  }

  /**
   * Handle conversational intents (GREETING, CHAT)
   */
  private handleConversational(
    classification: IntentClassification,
  ): IntentRouterResponse {
    const message =
      classification.conversationalResponse ||
      this.getDefaultConversationalResponse(classification.intent);

    return {
      message,
      classification,
      eventCreated: false,
      needsClarification: false,
    };
  }

  /**
   * Handle actionable intents with high confidence
   */
  private async handleActionable(
    userId: string,
    classification: IntentClassification,
  ): Promise<IntentRouterResponse> {
    const actionType = intentToActionType(classification.intent);

    console.log(
      `[IntentRouter] Handling actionable intent: ${classification.intent}`,
    );
    console.log(`[IntentRouter] Action type: ${actionType}`);
    console.log(`[IntentRouter] Confidence: ${classification.confidence}`);
    console.log(
      `[IntentRouter] Entities:`,
      JSON.stringify(classification.entities),
    );

    // Check if this action requires approval
    const needsApproval = requiresApproval(classification.intent);

    // Special handling for SEARCH intent - check cache first
    if (classification.intent === IntentType.SEARCH) {
      const searchQuery =
        classification.entities.searchQuery || classification.rawUserMessage;

      try {
        const searchCache = require("../searchCache").default;
        const cachedResult = await searchCache.getCachedSearch(
          searchQuery,
          userId,
        );

        if (cachedResult && searchCache.isFresh(cachedResult.timestamp)) {
          console.log(
            `[IntentRouter] Found cached search results for: "${searchQuery}"`,
          );

          const minutesAgo = Math.round(
            (Date.now() - cachedResult.timestamp.getTime()) / (1000 * 60),
          );
          return {
            message: `I found this in my memory from ${minutesAgo} minutes ago:\n\n${JSON.stringify(cachedResult.results, null, 2)}`,
            classification,
            eventCreated: false,
            needsClarification: false,
          };
        }

        console.log(
          `[IntentRouter] No fresh cache found, will perform new search`,
        );
      } catch (error) {
        console.error("[IntentRouter] Error checking search cache:", error);
      }
    }

    if (!needsApproval) {
      // Execute read-only operations immediately without approval
      console.log(`[IntentRouter] Read-only operation, executing immediately`);

      // Special handling for CHECK_CALENDAR to return real data
      if (classification.intent === IntentType.CHECK_CALENDAR) {
        try {
          const { PrismaClient } = await import("@prisma/client");
          const prisma = new PrismaClient();
          const { default: googleCalendarService } =
            await import("../googleCalendarService");

          const now = new Date();
          const startOfDay = new Date(now.setHours(0, 0, 0, 0));
          const endOfDay = new Date(now.setHours(23, 59, 59, 999));

          const googleEvents = await googleCalendarService.getEvents(
            userId,
            startOfDay,
            endOfDay,
          );
          const pendingTasks = await prisma.task.findMany({
            where: { userId, status: { in: ["pending", "in_progress"] } },
          });
          const reminders = await prisma.reminder.findMany({
            where: { userId, status: "pending", remindAt: { lte: endOfDay } },
          });

          let summary = "Here's your schedule for today:\n";

          if (googleEvents.length > 0) {
            summary +=
              "\n📅 Calendar Events:\n" +
              googleEvents.map((e: any) => `- ${e.summary}`).join("\n");
          } else {
            summary += "\n📅 No calendar events.";
          }

          if (reminders.length > 0) {
            summary +=
              "\n🔔 Reminders:\n" +
              reminders.map((r) => `- ${r.title}`).join("\n");
          }

          if (pendingTasks.length > 0) {
            summary +=
              "\n📝 Tasks:\n" +
              pendingTasks.map((t) => `- ${t.title}`).join("\n");
          }

          return {
            message: summary,
            classification,
            eventCreated: false,
            needsClarification: false,
          };
        } catch (error) {
          console.error("[IntentRouter] Error fetching schedule data:", error);
        }
      }

      // Special handling for FETCH_NEWS
      if (classification.intent === IntentType.FETCH_NEWS) {
        try {
          const { newsAgentV2 } = await import("../../agents/news");
          const result = await newsAgentV2.fetchTodaysNews(userId);

          if (result.success && result.digest) {
            const headlines = [
              ...(result.digest.tech || []).slice(0, 1),
              ...(result.digest.ai || []).slice(0, 1),
              ...(result.digest.world || []).slice(0, 1),
            ];

            let summary = "Here are the top headlines:\n\n";
            headlines.forEach((h) => {
              summary += `• ${h.title}\n`;
            });
            summary += "\nCheck the News tab for more details!";
            return {
              message: summary,
              classification,
              eventCreated: false,
              needsClarification: false,
            };
          }
          return {
            message: "I couldn't fetch the news right now.",
            classification,
            eventCreated: false,
            needsClarification: false,
          };
        } catch (e) {
          console.error(e);
        }
      }

      // Special handling for SEARCH (Vault Search)
      if (classification.intent === IntentType.SEARCH) {
        try {
          const { default: knowledgeService } =
            await import("../knowledge/knowledgeService");
          const searchQuery =
            classification.entities.searchQuery ||
            classification.rawUserMessage;

          console.log(`[IntentRouter] Searching vault for: "${searchQuery}"`);
          const results = await knowledgeService.searchKnowledgeEntries(
            userId,
            searchQuery,
          );

          if (results.length > 0) {
            let summary = `I found ${results.length} items in your vault:\n\n`;
            results.slice(0, 3).forEach((entry) => {
              summary += `📄 **${entry.title}**\n${entry.content.substring(0, 100)}...\n\n`;
            });
            return {
              message: summary,
              classification,
              eventCreated: false,
              needsClarification: false,
            };
          } else {
            return {
              message: `I searched your vault for "${searchQuery}" but didn't find anything matching.`,
              classification,
              eventCreated: false,
              needsClarification: false,
            };
          }
        } catch (error) {
          console.error("[IntentRouter] Error searching vault:", error);
          return {
            message: "I had trouble searching your vault. Please try again.",
            classification,
            eventCreated: false,
            needsClarification: false,
          };
        }
      }

      // Special handling for GET_QUOTE
      if (classification.intent === IntentType.GET_QUOTE) {
        const quotes = [
          "The best way to predict the future is to invent it. – Alan Kay",
          "Code is like humor. When you have to explain it, it’s bad. – Cory House",
          "Simplicity is the soul of efficiency. – Austin Freeman",
          "Talk is cheap. Show me the code. – Linus Torvalds",
        ];
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        return {
          message: `"${randomQuote}"`,
          classification,
          eventCreated: false,
          needsClarification: false,
        };
      }

      // Return immediate response for other read-only operations
      const message = this.getActionConfirmation(
        classification.intent,
        classification.entities,
      );

      return {
        message,
        classification,
        eventCreated: false,
        needsClarification: false,
      };
    }

    try {
      console.log(`[IntentRouter] Creating approval for ${actionType}...`);

      // Create approval request for write operations
      const approval = await approvalService.createApproval(userId, {
        actionType,
        actionData: {
          intent: classification.intent,
          entities: classification.entities,
          rawMessage: classification.rawUserMessage,
          timestamp: classification.timestamp,
        },
      });

      // Get confirmation message based on intent
      const message = this.getActionConfirmation(
        classification.intent,
        classification.entities,
      );

      console.log(
        `[IntentRouter] Approval created for ${classification.intent}: ${approval.id}`,
      );

      return {
        message,
        classification,
        eventCreated: true,
        eventId: approval.id,
        needsClarification: false,
      };
    } catch (error) {
      console.error("[IntentRouter] Error creating approval:", error);
      return {
        message:
          "I understood what you want, but had trouble setting it up. Could you try again?",
        classification,
        eventCreated: false,
        needsClarification: true,
      };
    }
  }

  /**
   * Handle low confidence actionable intents
   */
  private handleLowConfidence(
    classification: IntentClassification,
  ): IntentRouterResponse {
    const message = this.getClarificationRequest(classification);

    return {
      message,
      classification,
      eventCreated: false,
      needsClarification: true,
    };
  }

  /**
   * Handle unknown intents
   */
  private handleUnknown(
    classification: IntentClassification,
  ): IntentRouterResponse {
    const message =
      classification.conversationalResponse ||
      "I'm not quite sure what you'd like me to do. Could you tell me more?";

    return {
      message,
      classification,
      eventCreated: false,
      needsClarification: true,
    };
  }

  /**
   * Get default conversational response for intent type
   */
  private getDefaultConversationalResponse(intent: IntentType): string {
    switch (intent) {
      case IntentType.GREETING:
        return "Hey! What can I help you with today?";
      case IntentType.CHAT:
        return "I'm here to help! What would you like to do?";
      default:
        return "How can I help you?";
    }
  }

  /**
   * Get confirmation message for actionable intent
   */
  private getActionConfirmation(intent: IntentType, entities: any): string {
    switch (intent) {
      case IntentType.SEND_EMAIL:
        const recipient = entities.recipient ? ` to ${entities.recipient}` : "";
        return `Got it — drafting the email${recipient} for approval`;
      case IntentType.CREATE_TASK:
        return "Added to your task list!";
      case IntentType.CREATE_REMINDER:
        return "I'll remind you!";
      case IntentType.CHECK_CALENDAR:
        return "Let me check your calendar...";
      case IntentType.CREATE_CALENDAR_EVENT:
        return "Setting that up for you!";
      case IntentType.SEARCH:
        return "Searching for that...";
      case IntentType.FETCH_NEWS:
        return "Fetching the latest headlines...";
      case IntentType.RALPH_LOOP_START:
        return "Initializing Ralph Loop sequence...";
      case IntentType.GET_QUOTE:
        return "Here is a quote for you...";
      case IntentType.RESEARCH:
        return "I'll look into that for you!";
      default:
        return "On it!";
    }
  }

  /**
   * Get clarification request for low confidence intent
   */
  private getClarificationRequest(
    classification: IntentClassification,
  ): string {
    switch (classification.intent) {
      case IntentType.SEND_EMAIL:
        if (!classification.entities.recipient) {
          return "Sure! Who should I send the email to?";
        }
        return "I want to help with that email. Could you give me a bit more detail?";
      case IntentType.CREATE_TASK:
        return "I'd love to add that task. What exactly should I add?";
      case IntentType.CREATE_REMINDER:
        return "When should I remind you?";
      case IntentType.CREATE_CALENDAR_EVENT:
        return "I can schedule that! When should it be?";
      default:
        return "I want to help! Could you tell me a bit more about what you need?";
    }
  }
}

// Singleton instance
export const intentRouter = new IntentRouter();
export default intentRouter;
