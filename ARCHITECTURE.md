# Mini Hafsa 2.0 Architecture

## System Overview

Mini Hafsa 2.0 is a local-first AI employee system with human-in-the-loop (HITL) approval for all sensitive operations. The system uses Obsidian as its "nerve center" for transparent, auditable AI reasoning.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐            │
│  │   Chat    │  │ Dashboard │  │ Approvals │  │   News    │            │
│  │  Panel    │  │   Panel   │  │   Queue   │  │   Panel   │            │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘            │
└────────┼──────────────┼──────────────┼──────────────┼───────────────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FASTIFY BACKEND                                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                    INTENT ROUTER                                │     │
│  │  - Classifies user intent from natural language                 │     │
│  │  - Routes to appropriate agent or watcher                       │     │
│  └────────────────────────┬───────────────────────────────────────┘     │
│                           │                                              │
│  ┌────────────────────────▼───────────────────────────────────────┐     │
│  │                    ORCHESTRATOR                                 │     │
│  │  - Central autonomous loop                                      │     │
│  │  - Polls for approved actions                                   │     │
│  │  - Dispatches to appropriate watcher                            │     │
│  │  - Handles execution results                                    │     │
│  └─────────────┬─────────────────────────────────────┬────────────┘     │
│                │                                     │                   │
│  ┌─────────────▼─────────────┐     ┌─────────────────▼──────────────┐   │
│  │        WATCHERS           │     │          AGENTS                 │   │
│  │  ┌──────────────────┐     │     │  ┌──────────────────────┐      │   │
│  │  │ EmailWatcher     │     │     │  │ PrioritySorterAgent  │      │   │
│  │  │ CalendarWatcher  │     │     │  │ - Daily at 6 AM      │      │   │
│  │  │ TaskWatcher      │     │     │  │ - Multi-source tasks │      │   │
│  │  │ LinkedInWatcher  │     │     │  └──────────────────────┘      │   │
│  │  │ KnowledgeWatcher │     │     │  ┌──────────────────────┐      │   │
│  │  │ ReminderWatcher  │     │     │  │ RalphLoopExecutor    │      │   │
│  │  └──────────────────┘     │     │  │ - Multi-step tasks   │      │   │
│  └───────────────────────────┘     │  │ - Autonomous loops   │      │   │
│                                     │  └──────────────────────┘      │   │
│                                     │  ┌──────────────────────┐      │   │
│                                     │  │ NewsAgentV2          │      │   │
│                                     │  │ - On-demand fetch    │      │   │
│                                     │  │ - 24h cache          │      │   │
│                                     │  └──────────────────────┘      │   │
│                                     │  ┌──────────────────────┐      │   │
│                                     │  │ CEOBriefingAgent     │      │   │
│                                     │  │ - Sunday 8 PM        │      │   │
│                                     │  │ - Weekly metrics     │      │   │
│                                     │  └──────────────────────┘      │   │
│                                     └────────────────────────────────┘   │
└───────────────┬───────────────────────────────────────┬─────────────────┘
                │                                       │
┌───────────────▼───────────────┐     ┌─────────────────▼─────────────────┐
│       SQLite DATABASE         │     │        OBSIDIAN VAULT             │
│  ┌─────────────────────────┐  │     │  ┌─────────────────────────────┐  │
│  │ User                    │  │     │  │ Dashboard.md                │  │
│  │ Task                    │  │     │  │ Company_Handbook.md         │  │
│  │ CalendarEvent           │  │     │  │ Business_Goals.md           │  │
│  │ Approval                │  │     │  └─────────────────────────────┘  │
│  │ KnowledgeEntry          │  │     │  ┌─────────────────────────────┐  │
│  │ NewsCache               │  │     │  │ Pending_Approval/           │  │
│  │ CEOBriefing             │  │     │  │ Approved/                   │  │
│  │ RalphState              │  │     │  │ Rejected/                   │  │
│  │ PriorityPlan            │  │     │  │ Done/                       │  │
│  └─────────────────────────┘  │     │  │ Plans/                      │  │
└───────────────────────────────┘     │  │ Briefings/                  │  │
                                      │  │ Logs/                       │  │
                                      │  └─────────────────────────────┘  │
                                      └───────────────────────────────────┘
```

## Data Flow

### 1. User Message Flow

```
User Types Message
       │
       ▼
┌──────────────┐
│ Intent Router │ ──► Classify intent (email, task, calendar, etc.)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Approval   │ ──► Create approval record in DB
│   Service    │ ──► Create .md file in Pending_Approval/
└──────┬───────┘
       │
       ▼
User Reviews & Approves (moves file to Approved/)
       │
       ▼
┌──────────────┐
│ Orchestrator │ ──► Polls for approved actions
└──────┬───────┘     ──► Finds appropriate watcher
       │
       ▼
┌──────────────┐
│   Watcher    │ ──► Executes action (send email, create event, etc.)
└──────┬───────┘     ──► Logs result to Logs/
       │
       ▼
┌──────────────┐
│   Cleanup    │ ──► Move file to Done/
└──────────────┘     ──► Update Dashboard.md
```

### 2. Scheduled Agent Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      AGENT SCHEDULER                              │
│                                                                   │
│  ┌──────────────────┐          ┌───────────────────────────────┐ │
│  │ node-cron        │          │ Priority Sorter               │ │
│  │ "0 6 * * *"      │ ──6AM──► │ - Collect tasks from DB       │ │
│  │                  │          │ - Collect from vault          │ │
│  └──────────────────┘          │ - Analyze priorities          │ │
│                                │ - Generate plan file          │ │
│                                │ - Update Dashboard.md         │ │
│                                └───────────────────────────────┘ │
│                                                                   │
│  ┌──────────────────┐          ┌───────────────────────────────┐ │
│  │ node-cron        │          │ CEO Briefing                  │ │
│  │ "0 20 * * 0"     │ ──Sun──► │ - Collect week's metrics      │ │
│  │                  │          │ - Detect bottlenecks          │ │
│  └──────────────────┘          │ - Generate suggestions        │ │
│                                │ - Create briefing file        │ │
│                                └───────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 3. Ralph Loop Flow

```
User: "Research competitors and create spreadsheet"
       │
       ▼
┌──────────────────┐
│ Detect Multi-Step │ ──► Keywords: "research and create"
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Create State    │ ──► RALPH_STATE_{taskId}.json in In_Progress/
│    File          │ ──► TASK_{taskId}.md in In_Progress/
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                      ITERATION LOOP                               │
│                                                                   │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐│
│   │ Iteration 1 │ → │ Iteration 2 │ → │ ... up to maxIterations ││
│   │ - Research  │   │ - Analyze   │   │                         ││
│   │ - Log result│   │ - Log result│   │                         ││
│   └──────┬──────┘   └──────┬──────┘   └────────────────────────┘│
│          │                 │                                      │
│          └────────┬────────┘                                      │
│                   │                                               │
│                   ▼                                               │
│          ┌───────────────┐                                        │
│          │ Check Complete│ ──► <completion>TASK_COMPLETE</...>    │
│          └───────────────┘                                        │
│                                                                   │
│   Safety Checks:                                                  │
│   - Max 10 iterations                                             │
│   - Max 5 minutes total                                           │
│   - Check for manual stop (file in Rejected/)                     │
│   - 3 consecutive errors = fail                                   │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ Move to Done/    │
│ Log completion   │
└──────────────────┘
```

## Database Schema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              ENTITIES                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User ─────────┬────────────────────────────────────────────────────────│
│  │ id          │                                                         │
│  │ email       │                                                         │
│  │ name        │                                                         │
│  └─────────────┘                                                         │
│        │                                                                 │
│        │ 1:N                                                             │
│        ▼                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Task        │  │ CalendarEvt │  │ Approval    │  │ Knowledge   │    │
│  │ - title     │  │ - title     │  │ - actionType│  │ - title     │    │
│  │ - status    │  │ - startTime │  │ - actionData│  │ - content   │    │
│  │ - priority  │  │ - endTime   │  │ - status    │  │ - category  │    │
│  │ - dueDate   │  │ - location  │  │ - obsidian  │  │ - filePath  │    │
│  └─────────────┘  └─────────────┘  │   Path      │  └─────────────┘    │
│                                     └─────────────┘                      │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ NewsCache   │  │ CEOBriefing │  │ RalphState  │  │ PriorityPln│    │
│  │ - date      │  │ - weekStart │  │ - taskId    │  │ - date      │    │
│  │ - category  │  │ - metrics   │  │ - prompt    │  │ - doNow     │    │
│  │ - items     │  │ - bottlenck │  │ - status    │  │ - doNext    │    │
│  │ - expiresAt │  │ - suggest   │  │ - iterations│  │ - canWait   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Orchestrator
- Polls database every 2 seconds for approved actions
- Selects appropriate watcher based on action type
- Handles execution results and updates approval status
- Prevents double execution (idempotency)

### Watchers (BaseWatcher interface)
- `canHandle(approval)`: Check if watcher handles this action type
- `execute(approval)`: Execute the action
- `report(result)`: Log the result
- `safeExecute(approval)`: Wrapper with try-catch

### Agents
- **PrioritySorterAgent**: Multi-source task collection, AI priority analysis
- **RalphLoopExecutor**: Multi-step task execution with persistence
- **NewsAgentV2**: News fetching with filtering and caching
- **CEOBriefingAgent**: Weekly metrics collection and analysis

### VaultManager
- Thread-safe file operations
- Frontmatter parsing (gray-matter)
- File movement between folders
- Plan and briefing file generation

### DashboardManager
- Auto-updates every 30 seconds
- Counts pending approvals
- Tracks recent activity
- Shows system health

### AgentScheduler
- node-cron based scheduling
- Priority Sorter: 6 AM daily
- CEO Briefing: Sunday 8 PM
- Startup checks for missing daily plans

## Security Considerations

### Local-First
- All data stored locally (SQLite + filesystem)
- No cloud dependencies for core functionality
- Optional external APIs (NewsAPI, Google OAuth)

### Human-in-the-Loop
- All sensitive actions require approval
- File-based approval enables auditability
- No silent failures

### Audit Trail
- All actions logged to Logs/ with timestamps
- Structured JSON format for parsing
- 90-day retention policy

## Performance Targets

| Metric | Target |
|--------|--------|
| Chat response streaming start | < 500ms |
| Database queries | < 100ms |
| File operations | < 50ms |
| Page load | < 2 seconds |
| Support capacity | 10,000+ tasks |

## Extension Points

### Adding New Watcher
1. Create class extending `BaseWatcher`
2. Implement `canHandle()` and `execute()`
3. Register in orchestrator: `orchestrator.registerWatcher(newWatcher)`

### Adding New Agent
1. Create agent class with appropriate methods
2. Add API routes in `routes/`
3. Register routes in `main.ts`
4. Add to scheduler if needed

### Custom Approval Rules
Edit `Company_Handbook.md` in the vault to customize:
- Auto-approve thresholds
- Review requirements
- Emergency overrides
