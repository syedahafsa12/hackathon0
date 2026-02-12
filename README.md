# Mini Hafsa 2.0: AI Employee with Obsidian Nerve Center

## What It Is

Mini Hafsa 2.0 is a comprehensive AI employee system that automates routine tasks while maintaining human oversight. The system uses Obsidian as its "nerve center" for all AI reasoning, approvals, and knowledge management, ensuring complete transparency and auditability.

**Hackathon 0 Compliant**: Built with local-first architecture, human-in-the-loop approval for all sensitive operations, and observable execution.

## Key Features

### Core System
- **Obsidian Vault Integration**: All AI actions create Markdown files before database records
- **File-Based Approvals**: Approve actions by moving files between folders in Obsidian
- **Real-Time Dashboard**: Dashboard.md auto-updates with system state

### Autonomous Agents
- **Priority Sorter**: Daily at 6 AM - organizes tasks into Do Now, Do Next, Can Wait
- **Ralph Loop Executor**: Completes multi-step tasks autonomously after approval
- **News Agent**: On-demand curated news with 24-hour caching
- **CEO Briefing**: Weekly Sunday 8 PM - performance analysis with actionable insights

### Human-in-the-Loop (HITL)
- Email sending requires approval
- Calendar events require approval
- LinkedIn posting requires approval
- All sensitive operations logged

## Quick Start

### Prerequisites
- Node.js 18+
- npm
- Obsidian (optional, for vault viewing)

### Installation

```bash
# Clone and install dependencies
cd backend && npm install
cd ../frontend && npm install

# Set up database
cd backend
npx prisma migrate dev

# Configure environment
cp .env.example .env
# Edit .env with your API keys
```

### Running

```bash
# Terminal 1: Backend
cd backend
npm run dev
# Server runs on http://localhost:8080

# Terminal 2: Frontend
cd frontend
npm run dev
# UI opens on http://localhost:3000
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                         │
│  (Chat, Dashboard, Approval Queue, News Panel)              │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                  Fastify Backend                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Intent Router & Orchestrator                │   │
│  └──────────┬───────────────────────────────────────────┘   │
│             │                                               │
│  ┌──────────▼──────────┐  ┌──────────────┐                 │
│  │  Watchers           │  │   Agents     │                 │
│  │  - Email            │  │  - Priority  │                 │
│  │  - Calendar         │  │  - Ralph     │                 │
│  │  - Task             │  │  - News      │                 │
│  │  - Reminder         │  │  - CEO Brief │                 │
│  │  - LinkedIn         │  └──────────────┘                 │
│  │  - Knowledge        │                                   │
│  └─────────────────────┘                                   │
└────────────┬──────────────────────┬────────────────────────┘
             │                      │
┌────────────▼──────────┐  ┌────────▼─────────────────────┐
│  SQLite Database      │  │  Obsidian Vault              │
│  - Tasks              │  │  - Pending_Approval/         │
│  - Events             │  │  - Approved/                 │
│  - Approvals          │  │  - Done/                     │
│  - Knowledge          │  │  - Plans/                    │
│  - NewsCache          │  │  - Briefings/                │
└───────────────────────┘  │  - Logs/                     │
                           └──────────────────────────────┘
```

## API Endpoints

### Priority Sorter
- `POST /api/priority/generate` - Generate today's priority plan
- `GET /api/priority/today` - Get today's plan
- `POST /api/priority/resort` - Re-prioritize with current data

### Ralph Loop (Autonomous Tasks)
- `POST /api/ralph/execute` - Execute multi-step task
- `GET /api/ralph/status/:taskId` - Get task status
- `POST /api/ralph/stop/:taskId` - Emergency stop

### News Agent
- `POST /api/news/fetch` - Fetch today's news
- `GET /api/news/today` - Get cached or fetch new
- `GET /api/news/search?q=...` - Search past digests

### CEO Briefing
- `POST /api/briefing/generate` - Generate weekly briefing
- `GET /api/briefing/latest` - Get most recent briefing
- `GET /api/briefing/history` - List all briefings

### Health Check
- `GET /health` - System status with uptime

## Obsidian Vault Structure

```
.obsidian-vault/
├── Dashboard.md              # Real-time system state
├── Company_Handbook.md       # AI behavior rules
├── Business_Goals.md         # Objectives and metrics
├── Needs_Action/             # Incoming tasks from watchers
├── In_Progress/              # Tasks being processed
├── Pending_Approval/         # Awaiting human decision
├── Approved/                 # Ready for execution
├── Rejected/                 # User said no
├── Done/                     # Completed actions
├── Plans/                    # Daily priority plans
├── Knowledge_Vault/          # User notes and ideas
├── Briefings/                # Weekly CEO reports, News digests
├── Logs/                     # Daily JSON logs
└── Backups/                  # System backups
```

## User Journeys

### Daily Priority Workflow
1. User wakes up, opens Obsidian
2. Sees `Plans/Daily_Priority_YYYY-MM-DD.md` already generated at 6 AM
3. Knows exactly what to focus on first (no decision paralysis)
4. Works through "Do Now" section
5. Can re-prioritize anytime: "Re-prioritize my tasks"

### Approval Workflow
1. User: "Send email to john@example.com about the project update"
2. AI creates `Pending_Approval/EMAIL_john_2024-02-10.md`
3. User opens Obsidian, reads file, sees it's correct
4. User drags file to `Approved/` folder
5. Orchestrator detects move, triggers EmailWatcher
6. Email sent, file moved to `Done/`, Dashboard.md updated

### Multi-Step Task (Ralph Loop)
1. User: "Research competitors and create spreadsheet"
2. Ralph Loop executes multiple iterations autonomously
3. Each step logged to `Logs/YYYY-MM-DD_ralph.json`
4. Completed task appears in `Done/`
5. User reviews completed work without any "continue" prompts

## Environment Variables

```bash
# Database
DATABASE_URL=file:./dev.db

# Mistral AI (for priority analysis)
MISTRAL_API_KEY=your_mistral_api_key

# NewsAPI (optional, falls back to placeholders)
NEWS_API_KEY=your_newsapi_key

# Google OAuth (for email/calendar)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Server
PORT=8080
NODE_ENV=development
```

## Success Criteria

- [ ] Vault created with 10+ folders on first run
- [ ] All AI actions create Markdown files before database records
- [ ] Dashboard.md updates in real-time (within 5 seconds)
- [ ] Can approve actions by moving files in Obsidian
- [ ] Priority list generated by 6:01 AM every day
- [ ] CEO briefing generated every Sunday at 8:00 PM
- [ ] Multi-step tasks complete without user intervention (after approval)
- [ ] All past knowledge searchable from chat interface

## Quick Test Commands

After starting both servers, run these commands to verify everything works:

```bash
# 1. Check system health
curl http://localhost:8080/api/system/health

# 2. Test chat (should respond with greeting)
curl -X POST http://localhost:8080/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"userId":"dev-user-001","content":"Hello"}'

# 3. Create an email approval
curl -X POST http://localhost:8080/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"userId":"dev-user-001","content":"Send email to test@example.com saying hello"}'

# 4. Check pending approvals
curl http://localhost:8080/api/approvals/pending

# 5. Generate priority plan
curl -X POST http://localhost:8080/api/priority/generate

# 6. Fetch news
curl -X POST http://localhost:8080/api/news/fetch

# 7. Check vault structure
curl http://localhost:8080/vault/structure
```

## Frontend Pages

| Page | URL | Purpose |
|------|-----|---------|
| Home | http://localhost:3000 | Landing page with status |
| Dashboard | http://localhost:3000/dashboard | Main chat + 8 agent tabs |
| Control Panel | http://localhost:3000/control | Agent status & manual triggers |
| Vault Browser | http://localhost:3000/vault | Obsidian file explorer |
| Logs | http://localhost:3000/logs | Structured log viewer |

## Troubleshooting

**Backend won't start:**
```bash
npx kill-port 8080
npm run dev
```

**Prisma errors:**
```bash
npx prisma generate
npx prisma migrate dev
```

**Vault not initializing:**
- Check write permissions on `.obsidian-vault/` directory
- Ensure NODE_ENV is not blocking file operations

**Scheduled tasks not running:**
- Check server logs for scheduler initialization
- Verify system time/timezone settings

## License

MIT

## Credits

Built for Hackathon Zero with local-first architecture and human-in-the-loop principles.
#   h a c k a t h o n 0  
 #   h a c k a t h o n 0  
 #   h a c k a t h o n 0  
 #   h a c k a t h o n 0  
 #   h a c k a t h o n 0  
 