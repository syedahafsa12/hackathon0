<!--
Version: N/A → 1.0.0
Modified Principles:
- Local-First Architecture (new)
- Human-in-the-Loop (HITL) Mandatory (new)
- Obsidian as Nerve Center (new)
- Autonomous After Approval (new)
- Observable Execution (new)
Added Sections:
- Additional Constraints (new)
- Development Workflow (new)
Removed Sections:
- (none)
Templates Updated:
✅ .specify/memory/constitution.md
⚠ .specify/templates/plan-template.md (may need alignment)
⚠ .specify/templates/spec-template.md (may need alignment)
⚠ .specify/templates/tasks-template.md (may need alignment)
⚠ .specify/templates/commands/constitution.md (this file updated)
Follow-up TODOs:
- RATIFICATION_DATE: TODO(FILL_DATE): Fill actual ratification date
- CONSTITUTION_VERSION: Initial version set to 1.0.0
-->

# Mini Hafsa 2.0 - Hackathon 0 AI Employee Constitution
<!-- Example: Spec Constitution, TaskFlow Constitution, etc. -->

## Core Principles

### Local-First Architecture
All sensitive data (credentials, personal info) stored locally, never in cloud
Rationale: Ensures privacy and security by keeping data under user control.

### Human-in-the-Loop (HITL) Mandatory
Every write operation requires explicit approval, read operations can auto-execute
Rationale: Prevents unintended changes and ensures user oversight.

### Obsidian as Nerve Center
All AI reasoning and state management flows through local Markdown files
Rationale: Leverages Obsidian for persistent, versionable knowledge.

### Autonomous After Approval
Once approved, AI executes completely without interruption
Rationale: Guarantees swift autonomous operation while maintaining safety.

### Observable Execution
Every action logged with timestamps to both database and Obsidian vault
Rationale: Provides full auditability and traceability.

## Additional Constraints
### Code Quality Standards
- TypeScript strict mode enabled
- All async operations have proper error handling with try-catch
- No console.log in production, use structured logger
- All database operations use Prisma ORM
- All external API calls implement retry logic with exponential backoff
- Every watcher extends `BaseWatcher` abstract class
- All agents write to Obsidian vault before database

### Testing Standards
- Unit tests for all utility functions
- Integration tests for each watcher
- End-to-end test for full approval flow
- Mock all external APIs in tests
- Minimum 70% code coverage

### User Experience Consistency
- Kawaii aesthetic: pastel colors, rounded corners, friendly microcopy
- Maximum 2 clicks to approve any action
- All panels auto-refresh every 30 seconds
- Loading states for all async operations
- Toast notifications for all state changes
- Mobile-responsive design

### Performance Requirements
- Chat response streaming starts within 500ms
- Database queries under 100ms
- Obsidian file operations under 50ms
- Page load under 2 seconds
- Support up to 10,000 tasks/events without degradation

### Graceful Degradation
If external services fail, system continues with reduced functionality
Rationale: Maintains availability and user experience during outages.

### No Silent Failures
All errors create approval requests or notifications
Rationale: Ensures visibility of issues for timely resolution.

### Conversational Interface
Natural language everywhere, no rigid command syntax
Rationale: Lowers barrier to interaction and enhances usability.

### Single User, Deep Personalization
Built for one user (Hafsa), not multi-tenant
Rationale: Enables tailored features and deep integration.

## Development Workflow
All changes are committed via PRs, require at least one approval, run automated tests on CI, and must pass linting. Hotfixes require immediate approval. Release candidates are tagged and undergo final validation.

## Governance
All amendments must be documented in the constitution, approved by the user, and include a migration plan. Versioning follows semantic versioning: MAJOR for backward incompatible changes, MINOR for new principle/section additions, PATCH for clarifications. Ratification date: 2026-02-10. Compliance reviews occur quarterly.

**Version**: 1.0.0 | **Ratified**: 2026-02-10 | **Last Amended**: 2026-02-10