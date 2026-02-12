/**
 * Vault Utility Functions
 *
 * Helper functions for parsing, generating, and validating vault files.
 */

import matter from "gray-matter";
import {
  ApprovalFile,
  ApprovalFileFrontmatter,
  ActionType,
  ApprovalStatus,
  Priority,
  DEFAULT_APPROVAL_TIMEOUTS,
  CreateApprovalFileOptions,
} from "../../types/vault";

/**
 * Parse a Markdown file with YAML frontmatter into an ApprovalFile
 */
export function parseApprovalFile(
  content: string,
  filePath: string,
): ApprovalFile {
  const { data, content: markdownContent } = matter(content);

  const frontmatter: ApprovalFileFrontmatter = {
    type: data.type as ActionType,
    actionId: data.actionId,
    userId: data.userId,
    priority: (data.priority || "medium") as Priority,
    status: data.status as ApprovalStatus,
    createdAt: data.createdAt,
    correlationId: data.correlationId,
    expiresAt: data.expiresAt,
    approvedAt: data.approvedAt,
    rejectedAt: data.rejectedAt,
    rejectionReason: data.rejectionReason,
    executedAt: data.executedAt,
    executionStatus: data.executionStatus,
    executionError: data.executionError,
  };

  return {
    frontmatter,
    content: markdownContent.trim(),
    filePath,
  };
}

/**
 * Serialize an ApprovalFile back to Markdown with YAML frontmatter
 */
export function serializeApprovalFile(approvalFile: ApprovalFile): string {
  const { frontmatter, content } = approvalFile;

  // Filter out undefined values from frontmatter
  const cleanFrontmatter: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value !== undefined) {
      cleanFrontmatter[key] = value;
    }
  }

  return matter.stringify(content, cleanFrontmatter);
}

/**
 * Generate a unique filename for an approval file
 * Format: {ACTION_TYPE}_{identifier}_{timestamp}.md
 */
export function generateApprovalFilename(
  actionType: ActionType,
  identifier: string,
  timestamp?: Date,
): string {
  const date = timestamp || new Date();
  const isoTimestamp = date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeIdentifier = identifier
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);

  return `${actionType}_${safeIdentifier}_${isoTimestamp}.md`;
}

/**
 * Extract identifier from approval filename
 */
export function parseApprovalFilename(filename: string): {
  actionType: string;
  identifier: string;
  timestamp: string;
} | null {
  const match = filename.match(
    /^([A-Z_]+)_(.+)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.md$/,
  );
  if (!match) return null;

  return {
    actionType: match[1],
    identifier: match[2],
    timestamp: match[3].replace(/-/g, (m, i) => (i > 9 ? ":" : m)),
  };
}

/**
 * Validate frontmatter against required fields
 */
export function validateFrontmatter(
  frontmatter: Partial<ApprovalFileFrontmatter>,
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const validActionTypes: ActionType[] = [
    "EMAIL_SEND",
    "CALENDAR_CREATE",
    "TASK_CREATE",
    "LINKEDIN_POST",
    "KNOWLEDGE_SAVE",
    "REMINDER_CREATE",
  ];
  const validStatuses: ApprovalStatus[] = [
    "pending_approval",
    "approved",
    "rejected",
    "executing",
    "done",
    "failed",
    "expired",
  ];
  const validPriorities: Priority[] = ["low", "medium", "high", "critical"];

  // Required fields
  if (!frontmatter.type) {
    errors.push("Missing required field: type");
  } else if (!validActionTypes.includes(frontmatter.type)) {
    errors.push(`Invalid action type: ${frontmatter.type}`);
  }

  if (!frontmatter.actionId) {
    errors.push("Missing required field: actionId");
  } else if (!isValidUUID(frontmatter.actionId)) {
    errors.push("Invalid actionId: must be a valid UUID");
  }

  if (!frontmatter.userId) {
    errors.push("Missing required field: userId");
  }

  if (!frontmatter.status) {
    errors.push("Missing required field: status");
  } else if (!validStatuses.includes(frontmatter.status)) {
    errors.push(`Invalid status: ${frontmatter.status}`);
  }

  if (!frontmatter.createdAt) {
    errors.push("Missing required field: createdAt");
  } else if (!isValidISODate(frontmatter.createdAt)) {
    errors.push("Invalid createdAt: must be ISO 8601 format");
  }

  if (!frontmatter.correlationId) {
    errors.push("Missing required field: correlationId");
  }

  // Optional field validation
  if (frontmatter.priority && !validPriorities.includes(frontmatter.priority)) {
    errors.push(`Invalid priority: ${frontmatter.priority}`);
  }

  if (frontmatter.expiresAt && !isValidISODate(frontmatter.expiresAt)) {
    errors.push("Invalid expiresAt: must be ISO 8601 format");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a string is a valid UUID v4
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Check if a string is a valid ISO 8601 date
 */
export function isValidISODate(str: string): boolean {
  const date = new Date(str);
  return !isNaN(date.getTime());
}

/**
 * Calculate expiration time based on action type
 */
export function calculateExpiresAt(
  actionType: ActionType,
  createdAt: Date,
  customTimeoutHours?: number,
): Date {
  const timeoutHours =
    customTimeoutHours ?? DEFAULT_APPROVAL_TIMEOUTS[actionType] ?? 24;
  const expiresAt = new Date(createdAt);
  expiresAt.setHours(expiresAt.getHours() + timeoutHours);
  return expiresAt;
}

/**
 * Create approval file content from options
 */
export function createApprovalFileContent(
  options: CreateApprovalFileOptions,
): ApprovalFile {
  const createdAt = new Date();
  const expiresAt = calculateExpiresAt(
    options.actionType,
    createdAt,
    options.expiresIn,
  );

  const frontmatter: ApprovalFileFrontmatter = {
    type: options.actionType,
    actionId: options.actionId,
    userId: options.userId,
    priority: options.priority || "medium",
    status: "pending_approval",
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    correlationId: options.correlationId,
  };

  const content = `## Action: ${options.summary}

${options.content}

## Approval Instructions

- Move this file to \`/Approved/\` to proceed
- Move to \`/Rejected/\` to cancel
- This request expires at ${expiresAt.toLocaleString()}

## Execution Log

<!-- SYSTEM: execution_log -->
Awaiting approval...
<!-- /SYSTEM: execution_log -->
`;

  const filename = generateApprovalFilename(
    options.actionType,
    options.summary.slice(0, 30),
    createdAt,
  );

  return {
    frontmatter,
    content,
    filePath: filename, // Just the filename, path will be added by VaultManager
  };
}

/**
 * Update the execution log section of an approval file
 */
export function updateExecutionLog(content: string, logEntry: string): string {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${logEntry}`;

  const executionLogRegex =
    /(<!-- SYSTEM: execution_log -->)([\s\S]*?)(<!-- \/SYSTEM: execution_log -->)/;
  const match = content.match(executionLogRegex);

  if (match) {
    const existingLog = match[2].trim();
    const newLog = existingLog ? `${existingLog}\n${logLine}` : logLine;
    return content.replace(executionLogRegex, `$1\n${newLog}\n$3`);
  }

  // If no execution log section, append it
  return (
    content +
    `\n\n## Execution Log\n\n<!-- SYSTEM: execution_log -->\n${logLine}\n<!-- /SYSTEM: execution_log -->\n`
  );
}

/**
 * Generate a correlation ID
 */
export async function generateCorrelationId(): Promise<string> {
  const { v4: uuidv4 } = await import("uuid");
  return uuidv4();
}

/**
 * Format action type for display
 */
export function formatActionType(actionType: ActionType): string {
  return actionType
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Check if an approval has expired
 */
export function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 30 minutes")
 */
export function getRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = typeof date === "string" ? new Date(date) : date;
  const diffMs = target.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins === 0) return "just now";
  if (diffMins > 0) {
    if (diffMins < 60)
      return `in ${diffMins} minute${diffMins === 1 ? "" : "s"}`;
    if (diffHours < 24)
      return `in ${diffHours} hour${diffHours === 1 ? "" : "s"}`;
    return `in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
  } else {
    const absMins = Math.abs(diffMins);
    const absHours = Math.abs(diffHours);
    const absDays = Math.abs(diffDays);
    if (absMins < 60) return `${absMins} minute${absMins === 1 ? "" : "s"} ago`;
    if (absHours < 24)
      return `${absHours} hour${absHours === 1 ? "" : "s"} ago`;
    return `${absDays} day${absDays === 1 ? "" : "s"} ago`;
  }
}
