/**
 * Vault Folder Configuration
 *
 * Defines the folder structure and README content for the Obsidian vault.
 * Per Constitution Principle III: All AI reasoning flows through local Markdown files.
 */

import { VaultFolder, VAULT_FOLDERS } from '../../types/vault';

/**
 * Complete folder definitions with README content
 */
export const FOLDER_DEFINITIONS: VaultFolder[] = [
  {
    name: VAULT_FOLDERS.PENDING_APPROVAL,
    purpose: 'Actions awaiting user decision',
    type: 'workflow',
    filePattern: /^[A-Z_]+_.*\.md$/,
    watched: false,
    readmeContent: `# Pending Approval

This folder contains actions proposed by Mini Hafsa that are awaiting your approval.

## How to Use

1. **Review** the action file to see what Mini Hafsa wants to do
2. **Approve**: Move the file to \`/Approved/\` folder
3. **Reject**: Move the file to \`/Rejected/\` folder

## File Format

Each file contains:
- YAML frontmatter with action details
- Human-readable description of the action
- Approval instructions

## Tips

- Files will auto-expire based on their timeout (check the \`expiresAt\` field)
- You can edit the file before approving to modify the action
- Rejected actions are logged for auditing
`,
  },
  {
    name: VAULT_FOLDERS.APPROVED,
    purpose: 'Actions approved for execution',
    type: 'workflow',
    filePattern: /^[A-Z_]+_.*\.md$/,
    watched: true, // FileWatcher monitors this folder
    readmeContent: `# Approved

Actions you have approved will appear here briefly before being executed.

## Workflow

1. You move a file here from \`/Pending_Approval/\`
2. Mini Hafsa detects the approval (within 5 seconds)
3. The action is executed
4. File moves to \`/Done/\` or \`/Failed/\`

## Note

Files in this folder are processed automatically. Do not manually create files here.
`,
  },
  {
    name: VAULT_FOLDERS.REJECTED,
    purpose: 'Actions rejected by user',
    type: 'workflow',
    filePattern: /^[A-Z_]+_.*\.md$/,
    watched: true, // FileWatcher monitors this folder
    readmeContent: `# Rejected

Actions you have rejected are stored here for auditing.

## What Happens on Rejection

1. The action is marked as rejected in the database
2. The rejection is logged
3. You can optionally add a rejection reason by editing the file

## Clean Up

These files are kept indefinitely for audit purposes. You can safely delete old files if no longer needed.
`,
  },
  {
    name: VAULT_FOLDERS.IN_PROGRESS,
    purpose: 'Actions currently executing',
    type: 'workflow',
    filePattern: /^[A-Z_]+_.*\.md$/,
    watched: false,
    readmeContent: `# In Progress

Actions that are currently being executed appear here temporarily.

## Status

Files move here after approval and before completion. This folder should typically be empty.

If a file stays here for more than a few minutes, something may have gone wrong.
`,
  },
  {
    name: VAULT_FOLDERS.DONE,
    purpose: 'Successfully completed actions',
    type: 'workflow',
    filePattern: /^[A-Z_]+_.*\.md$/,
    watched: false,
    readmeContent: `# Done

Successfully completed actions are archived here.

## Contents

Each file includes:
- Original action details
- Execution timestamp
- Execution result/output

## Archive Policy

Files are kept indefinitely. You can safely delete old files if no longer needed.
`,
  },
  {
    name: VAULT_FOLDERS.FAILED,
    purpose: 'Actions that failed during execution',
    type: 'workflow',
    filePattern: /^[A-Z_]+_.*\.md$/,
    watched: false,
    readmeContent: `# Failed

Actions that encountered errors during execution are stored here.

## What to Do

1. Review the error message in the file
2. You can retry by moving the file back to \`/Approved/\`
3. Or delete if the action is no longer needed

## Debugging

Each file includes the error details and stack trace (if available).
`,
  },
  {
    name: VAULT_FOLDERS.NEEDS_ACTION,
    purpose: 'Actions needing user attention',
    type: 'workflow',
    filePattern: /^[A-Z_]+_.*\.md$/,
    watched: false,
    readmeContent: `# Needs Action

Items in this folder require your manual attention.

## Common Reasons

- Failed actions that need review
- Ambiguous requests that need clarification
- System notifications requiring acknowledgment

## Resolution

After addressing the issue, move or delete the file as appropriate.
`,
  },
  {
    name: VAULT_FOLDERS.EXPIRED,
    purpose: 'Actions that timed out',
    type: 'workflow',
    filePattern: /^[A-Z_]+_.*\.md$/,
    watched: false,
    readmeContent: `# Expired

Actions that were not approved/rejected before their timeout are moved here.

## What This Means

- The action was proposed but no decision was made in time
- The action has NOT been executed
- You can review what was missed

## Recovery

If you still want to execute an expired action, you'll need to request it again.
`,
  },
  {
    name: VAULT_FOLDERS.PLANS,
    purpose: 'Multi-step AI plans',
    type: 'content',
    filePattern: /^.*\.md$/,
    watched: false,
    readmeContent: `# Plans

Multi-step plans created by Mini Hafsa are stored here.

## Contents

Each plan includes:
- Goal/objective
- Step-by-step breakdown
- Dependencies between steps
- Expected outcomes

## Usage

Plans serve as a record of Mini Hafsa's reasoning and can be referenced for future similar tasks.
`,
  },
  {
    name: VAULT_FOLDERS.KNOWLEDGE_VAULT,
    purpose: 'User notes and ideas',
    type: 'content',
    filePattern: /^.*\.md$/,
    watched: false,
    readmeContent: `# Knowledge Vault

Your notes, ideas, and reference materials are stored here.

## Organization

- Create subfolders by category
- Use tags in YAML frontmatter for cross-referencing
- Link between notes using standard Obsidian syntax

## Search

All files here are indexed for full-text search. Mini Hafsa can reference this knowledge when answering questions.
`,
  },
  {
    name: VAULT_FOLDERS.BRIEFINGS,
    purpose: 'Weekly CEO reports',
    type: 'content',
    filePattern: /^.*\.md$/,
    watched: false,
    readmeContent: `# Briefings

Periodic summary reports and briefings are stored here.

## Contents

- Weekly summaries
- Monthly reviews
- Important metrics and trends
- Actionable recommendations

## Format

Reports are generated in Markdown format with clear sections and data visualizations where applicable.
`,
  },
  {
    name: VAULT_FOLDERS.LOGS,
    purpose: 'Daily JSON logs',
    type: 'system',
    filePattern: /^\d{4}-\d{2}-\d{2}\.json$/,
    watched: false,
    readmeContent: `# Logs

Daily action logs are stored here in JSON format.

## File Naming

Files are named by date: \`YYYY-MM-DD.json\`

## Format

Each line is a JSON object (JSON Lines format) containing:
- timestamp
- level (debug/info/warn/error)
- source (component name)
- action
- correlationId
- userId
- data

## Retention

Logs older than 90 days are automatically deleted.
`,
  },
  {
    name: VAULT_FOLDERS.CONVERSATIONS,
    purpose: 'Chat history organized by date',
    type: 'content',
    filePattern: /^.*\.md$/,
    watched: false,
    readmeContent: `# Conversations

Chat message history is stored here, organized by date.

## Structure

\`\`\`
Conversations/
├── 2024/
│   ├── 01/
│   │   ├── 2024-01-15_conversation.md
│   │   └── 2024-01-16_conversation.md
│   └── 02/
│       └── ...
\`\`\`

## Contents

Each file contains the full conversation history for that day, including:
- User messages
- Assistant responses
- Detected intents
- Created actions/tasks

## Search

All conversations are indexed for full-text search.
`,
  },
];

/**
 * Get watched folders for file watcher initialization
 */
export function getWatchedFolders(): string[] {
  return FOLDER_DEFINITIONS
    .filter(folder => folder.watched)
    .map(folder => folder.name);
}

/**
 * Get folder definition by name
 */
export function getFolderDefinition(name: string): VaultFolder | undefined {
  return FOLDER_DEFINITIONS.find(folder => folder.name === name);
}

/**
 * Get all folder names
 */
export function getAllFolderNames(): string[] {
  return FOLDER_DEFINITIONS.map(folder => folder.name);
}
