/**
 * Intent types for Mini Hafsa command understanding
 */

// Enum for all supported intent types
export enum IntentType {
  // Conversational intents (respond immediately, no Event created)
  GREETING = "GREETING",
  CHAT = "CHAT",

  // Actionable intents (create Event for approval workflow)
  SEND_EMAIL = "SEND_EMAIL",
  CREATE_TASK = "CREATE_TASK",
  CREATE_REMINDER = "CREATE_REMINDER",
  CHECK_CALENDAR = "CHECK_CALENDAR",
  CREATE_CALENDAR_EVENT = "CREATE_CALENDAR_EVENT",
  SEARCH = "SEARCH",
  RESEARCH = "RESEARCH",

  // New features
  FETCH_NEWS = "FETCH_NEWS",
  RALPH_LOOP_START = "RALPH_LOOP_START",
  GET_QUOTE = "GET_QUOTE",

  // Fallback
  UNKNOWN = "UNKNOWN",
}

// Entities extracted from user message
export interface IntentEntities {
  // Email-related
  recipient?: string;
  emailSubject?: string;
  emailBody?: string;

  // Task-related
  taskDescription?: string;
  taskPriority?: "low" | "medium" | "high" | "critical";

  // Calendar-related
  eventTitle?: string;
  eventDate?: string; // ISO 8601 date
  eventTime?: string; // HH:MM format
  eventDuration?: number; // minutes
  eventAttendees?: string[];

  // Search/Research-related
  searchQuery?: string;

  // Ralph-related
  ralphPrompt?: string;

  // General
  mentionedPerson?: string;
  mentionedDate?: string;
}

// Result of intent classification
export interface IntentClassification {
  intent: IntentType;
  confidence: number; // 0.0 to 1.0
  entities: IntentEntities;
  conversationalResponse?: string; // Only for GREETING/CHAT intents
  rawUserMessage: string;
  timestamp: string; // ISO 8601
}

// Response from IntentRouter
export interface IntentRouterResponse {
  // What to show the user
  message: string;

  // Classification result
  classification: IntentClassification;

  // Whether an Event was created (for actionable intents)
  eventCreated: boolean;
  eventId?: string;

  // Whether clarification is needed
  needsClarification: boolean;
}

// Request to Mistral for classification
export interface MistralRequest {
  userMessage: string;
  userId: string;
  conversationContext?: string[]; // Last N messages for context
}

// Response from Mistral (parsed JSON)
export interface MistralResponse {
  intent: string;
  confidence: number;
  entities: IntentEntities;
  conversational_response?: string;
}

// Configuration for IntentRouter
export interface IntentRouterConfig {
  confidenceThreshold: number;
  mistralModel: string;
  timeoutMs: number;
}

// Default configuration
export const DEFAULT_CONFIG: IntentRouterConfig = {
  confidenceThreshold: 0.7,
  mistralModel: "mistral-small-latest",
  timeoutMs: 5000,
};

// Helper to check if an intent is actionable (requires approval)
export function isActionableIntent(intent: IntentType): boolean {
  return [
    IntentType.SEND_EMAIL,
    IntentType.CREATE_TASK,
    IntentType.CREATE_REMINDER,
    IntentType.CHECK_CALENDAR,
    IntentType.CREATE_CALENDAR_EVENT,
    IntentType.SEARCH,
    IntentType.RESEARCH,
    IntentType.FETCH_NEWS,
    IntentType.RALPH_LOOP_START,
    IntentType.GET_QUOTE,
  ].includes(intent);
}

// Helper to check if an intent is conversational (immediate response)
export function isConversationalIntent(intent: IntentType): boolean {
  return [IntentType.GREETING, IntentType.CHAT].includes(intent);
}

// Map intent to approval action type
export function intentToActionType(intent: IntentType): string {
  switch (intent) {
    case IntentType.SEND_EMAIL:
      return "email_send";
    case IntentType.CREATE_TASK:
      return "task_create";
    case IntentType.CREATE_REMINDER:
      return "reminder_create";
    case IntentType.CREATE_CALENDAR_EVENT:
      return "calendar_create";
    case IntentType.CHECK_CALENDAR:
      return "calendar_check";
    case IntentType.SEARCH:
      return "search";
    case IntentType.RESEARCH:
      return "research";
    case IntentType.FETCH_NEWS:
      return "news_fetch";
    case IntentType.RALPH_LOOP_START:
      return "ralph_start";
    case IntentType.GET_QUOTE:
      return "quote_get";
    default:
      return "unknown";
  }
}

// Helper to check if an intent requires approval (write operations)
export function requiresApproval(intent: IntentType): boolean {
  // Read-only operations don't require approval
  const readOnlyIntents = [
    IntentType.CHECK_CALENDAR,
    IntentType.SEARCH,
    IntentType.GREETING,
    IntentType.CHAT,
    IntentType.UNKNOWN,
    IntentType.FETCH_NEWS,
    IntentType.GET_QUOTE,
  ];

  return !readOnlyIntents.includes(intent);
}
