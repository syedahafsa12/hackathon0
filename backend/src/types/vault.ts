/**
 * Vault Type Definitions
 *
 * Type definitions for the Obsidian vault integration system.
 * Implements Constitution Principle III: Obsidian as Nerve Center.
 */

// Action types requiring approval (matches existing ActionType enum)
export type ActionType =
  | 'EMAIL_SEND'
  | 'CALENDAR_CREATE'
  | 'TASK_CREATE'
  | 'LINKEDIN_POST'
  | 'KNOWLEDGE_SAVE'
  | 'REMINDER_CREATE';

// Approval file status
export type ApprovalStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'done'
  | 'failed'
  | 'expired';

// Priority levels
export type Priority = 'low' | 'medium' | 'high' | 'critical';

// Vault folder types
export type FolderType = 'workflow' | 'content' | 'system';

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Execution status for completed actions
export type ExecutionStatus = 'success' | 'failed' | 'partial';

/**
 * YAML frontmatter for approval files
 */
export interface ApprovalFileFrontmatter {
  type: ActionType;
  actionId: string;
  userId: string;
  priority: Priority;
  status: ApprovalStatus;
  createdAt: string;
  expiresAt?: string;
  correlationId: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  executedAt?: string;
  executionStatus?: ExecutionStatus;
  executionError?: string;
}

/**
 * Complete approval file representation
 */
export interface ApprovalFile {
  frontmatter: ApprovalFileFrontmatter;
  content: string;
  filePath: string;
}

/**
 * Vault configuration
 */
export interface VaultConfig {
  path: string;
  folders: VaultFolder[];
  watchedFolders: string[];
}

/**
 * Individual folder definition
 */
export interface VaultFolder {
  name: string;
  purpose: string;
  type: FolderType;
  filePattern: RegExp;
  watched: boolean;
  readmeContent: string;
}

/**
 * Dashboard state computed from system data
 */
export interface DashboardState {
  lastUpdated: Date;
  todaySummary: {
    pendingApprovals: number;
    completedToday: number;
    failedToday: number;
    upcomingReminders: number;
  };
  pendingApprovals: {
    id: string;
    type: string;
    summary: string;
    createdAt: Date;
    expiresAt?: Date;
  }[];
  recentActions: {
    id: string;
    type: string;
    summary: string;
    completedAt: Date;
    status: 'success' | 'failed';
  }[];
  activeProjects: {
    name: string;
    taskCount: number;
    completedCount: number;
  }[];
  quickStats: {
    totalEmails: number;
    totalTasks: number;
    totalKnowledgeEntries: number;
  };
  userContent: Record<string, string>;
}

/**
 * Structured log entry for vault logs
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: string;
  action: string;
  correlationId: string;
  userId: string;
  data: {
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    duration_ms?: number;
  };
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

/**
 * Handbook configuration parsed from Company_Handbook.md
 */
export interface HandbookConfig {
  autoApproveRules: {
    actionType: string;
    condition: string;
    enabled: boolean;
  }[];
  approvalTimeouts: {
    actionType: string;
    timeout: number; // hours
  }[];
  communicationStyle: {
    tone: 'formal' | 'casual' | 'friendly';
    signOff: string;
    language: string;
  };
  priorities: {
    name: string;
    description: string;
    weight: number;
  }[];
  blockedActions: string[];
}

/**
 * Vault status for health checks
 */
export interface VaultStatus {
  healthy: boolean;
  path: string;
  lastChecked: Date;
  folders: {
    name: string;
    fileCount: number;
    exists: boolean;
  }[];
  pendingWrites: number;
}

/**
 * Knowledge search result
 */
export interface KnowledgeSearchResult {
  id: string;
  title: string;
  snippet: string;
  category?: string;
  tags: string[];
  filePath?: string;
  score: number;
  createdAt: Date;
}

/**
 * Queued write operation for graceful degradation
 */
export interface QueuedWriteOperation {
  path: string;
  content: string;
  retries: number;
  lastAttempt: Date;
  operation: 'write' | 'move' | 'delete';
}

/**
 * File watcher event
 */
export interface FileWatcherEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  folder: string;
  filename: string;
  timestamp: Date;
}

/**
 * Approval action data (subset of what's stored in actionData JSON)
 */
export interface ApprovalActionData {
  intent: string;
  entities: Record<string, unknown>;
  rawMessage?: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Result of vault file operation
 */
export interface VaultOperationResult {
  success: boolean;
  path?: string;
  error?: string;
  duration_ms?: number;
}

/**
 * Options for creating approval files
 */
export interface CreateApprovalFileOptions {
  actionType: ActionType;
  actionId: string;
  userId: string;
  priority?: Priority;
  correlationId: string;
  expiresIn?: number; // hours
  content: string;
  summary: string;
}

/**
 * Timeout configuration defaults
 */
export const DEFAULT_APPROVAL_TIMEOUTS: Record<ActionType, number> = {
  EMAIL_SEND: 24,
  CALENDAR_CREATE: 4,
  TASK_CREATE: 4,
  LINKEDIN_POST: 24,
  KNOWLEDGE_SAVE: 24,
  REMINDER_CREATE: 4,
};

/**
 * Folder names as constants
 */
export const VAULT_FOLDERS = {
  PENDING_APPROVAL: 'Pending_Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  IN_PROGRESS: 'In_Progress',
  DONE: 'Done',
  FAILED: 'Failed',
  NEEDS_ACTION: 'Needs_Action',
  EXPIRED: 'Expired',
  PLANS: 'Plans',
  KNOWLEDGE_VAULT: 'Knowledge_Vault',
  BRIEFINGS: 'Briefings',
  LOGS: 'Logs',
  CONVERSATIONS: 'Conversations',
} as const;

export type VaultFolderName = typeof VAULT_FOLDERS[keyof typeof VAULT_FOLDERS];
