# Mini Hafsa 2.0 - Demo Script (5 Minutes)

## Pre-Demo Setup

```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Start frontend
cd frontend && npm run dev

# Optional: Clean database for fresh demo
cd backend && npx ts-node scripts/emergencyCleanup.ts
```

**Verify both are running:**
- Backend: http://localhost:8080/health
- Frontend: http://localhost:3000

---

## Demo Flow

### Minute 0:00-1:00 - Introduction & Chat Interface

1. **Open** http://localhost:3000
2. **Show** landing page with backend status indicator (green dot = connected)
3. **Click** "Open Dashboard"
4. **Explain:** "This is Mini Hafsa 2.0, your AI employee that works while you sleep"

5. **Type in chat:** `Hello, what can you do?`
6. **Show** streaming response
7. **Explain:** "Natural language interface - just talk to it like a human"

---

### Minute 1:00-2:00 - HITL Approval Flow

1. **Type:** `Send an email to demo@example.com saying "Hello from Mini Hafsa!"`
2. **Show** response: "Got it - drafting the email for approval"
3. **Click** "Approvals" tab
4. **Show** pending approval card with email details
5. **Click** "Approve" button
6. **Show** success message: "Email sent!"

**Key Point:** "Every sensitive action requires explicit human approval - this is Human-in-the-Loop"

---

### Minute 2:00-3:00 - Control Panel & Agents

1. **Navigate** to http://localhost:3000/control
2. **Show** System Health card:
   - Database: Connected
   - Vault: Ready
   - Watchers: 6/6
   - Orchestrator: Running

3. **Click** "Generate Priority Plan"
4. **Show** loading spinner then success
5. **Explain:** "Priority Sorter analyzes your tasks and creates a Do Now / Do Next / Can Wait plan"

6. **Click** "Fetch News Now"
7. **Show** news categories: Tech, AI, World

---

### Minute 3:00-4:00 - Obsidian Vault Integration

1. **Navigate** to http://localhost:3000/vault
2. **Show** folder tree on left:
   - Needs_Action
   - In_Progress
   - Pending_Approval
   - Approved
   - Done
   - Plans
   - Logs

3. **Click** "Dashboard.md" in Root
4. **Show** real-time system state

5. **Click** "Plans" folder
6. **Show** `Daily_Priority_2026-02-11.md` file
7. **Show** the generated priority plan content

8. **Click** "Logs" folder
9. **Show** structured JSON logs

**Key Point:** "Everything lives in Obsidian - you can edit these files directly and the system syncs"

---

### Minute 4:00-5:00 - Wrap-up & Compliance

1. **Return** to Dashboard (http://localhost:3000/dashboard)
2. **Show** the tabs: Priorities, Calendar, Approvals, Reminders, Knowledge, News, LinkedIn, Ralph

3. **Explain key points:**
   - "Local-first: Works offline, your data stays on your machine"
   - "HITL: All sensitive actions need approval"
   - "Observable: Every action is logged and viewable"
   - "Autonomous: Once approved, tasks complete without interruption"

4. **Final statement:**
   > "Mini Hafsa 2.0 - Your AI employee that handles emails, calendar, tasks, and more.
   > It follows Hackathon 0 principles: local-first, human-in-the-loop, and fully observable.
   > Your AI assistant that works while you sleep, but only with your permission."

---

## Quick Commands for Demo

### If chat doesn't respond:
```bash
# Check backend logs
curl http://localhost:8080/health
```

### If approvals don't show:
```bash
# Check pending approvals
curl http://localhost:8080/api/approvals/pending
```

### If vault is empty:
```bash
# Initialize vault
curl -X POST http://localhost:8080/vault/initialize
```

---

## Key Demo Features Checklist

- [ ] Chat interface responds to natural language
- [ ] Email command creates approval
- [ ] Approve button works
- [ ] Control panel shows all agents
- [ ] Priority Sorter generates plan
- [ ] News Agent fetches articles
- [ ] Vault browser shows folder structure
- [ ] Dashboard.md displays real-time state
- [ ] Logs folder shows structured JSON

---

## Troubleshooting

**Backend won't start:**
```bash
# Check if port is in use
netstat -ano | grep 8080
# Kill process if needed
```

**Frontend shows "disconnected":**
- Check CORS settings in backend
- Verify both servers are running
- Check browser console for errors

**No approvals showing:**
- Check database connection
- Run emergency cleanup script
- Verify userId matches ("dev-user-001")
