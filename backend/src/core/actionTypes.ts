/**
 * Centralized action type definitions for Mini Hafsa
 * Maps intent types to action types and Watchers
 */

export enum ActionType {
  EMAIL_SEND = "email_send",
  CALENDAR_CREATE = "calendar_create",
  TASK_CREATE = "task_create",
  LINKEDIN_POST = "linkedin_post",
  KNOWLEDGE_SAVE = "knowledge_save",
  REMINDER_CREATE = "reminder_create",
  RALPH_EXECUTE = "ralph_execute",
  NEWS_FETCH = "news_fetch",
}

export const ACTION_TYPE_TO_WATCHER: Record<ActionType, string> = {
  [ActionType.EMAIL_SEND]: "emailWatcher",
  [ActionType.CALENDAR_CREATE]: "calendarWatcher",
  [ActionType.TASK_CREATE]: "taskWatcher",
  [ActionType.LINKEDIN_POST]: "linkedinWatcher",
  [ActionType.KNOWLEDGE_SAVE]: "knowledgeWatcher",
  [ActionType.REMINDER_CREATE]: "reminderWatcher",
  [ActionType.RALPH_EXECUTE]: "ralphWatcher",
  [ActionType.NEWS_FETCH]: "newsWatcher",
};

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executedAt: Date;
  durationMs?: number;
  message?: string;
}
