# Full Stack Testing Guide: Mini Hafsa (Hackathon 0)

This guide provides the exact commands and steps to test the autonomous backend and premium frontend.

## 1. Start the Backend (Autonomous AI Node)

Open a terminal in `E:\hack0\hackkk\backend` and run:

```powershell
# Install dependencies if you haven't recently
npm install

# Start the autonomous backend
npm run dev
```

_You should see output like: `[Server] Orchestrator started`, `[Server] FileWatcher started`._

## 2. Start the Frontend (CEO Dashboard)

Open a NEW terminal in `E:\hack0\hackkk\frontend` and run:

```powershell
# Install dependencies
npm install

# Start the development server
npm run dev
```

_The dashboard will be available at `http://localhost:3000`._

---

## 3. Core Test Scenarios (The Demo)

### A. Observable Execution (Requirement #5)

1. In the Dashboard header, click **📝 Logs**.
2. Browse the `system` or `loop` logs.
3. Verify that every internal action is timestamped and audit-available.

### B. Obsidian Nerve Center & File HITL (Requirement #3)

1. Ensure the backend is running.
2. Open your Obsidian vault at `E:\hack0\hackkk\backend\vault`.
3. Create a file in the `Approved/` folder (e.g., `test.md`).
4. **Observe**: Within seconds, the file moves to `In_Progress/` and then `Done/`.
5. This proves the system is controlled via your local filesystem.

### C. Company Handbook & HITL (Requirement #2)

1. View `backend/vault/Company_Handbook.md` for current rules.
2. **Auto-Approve Test**: Type "Remind me in 10 minutes to grab water" in the chat.
   - Result: It should auto-approve and execute (Check notifications).
3. **Manual Approval Test**: Move a complex task (e.g., "Delete production database") to the queue.
   - Result: It will wait for your manual click or Obsidian file movement.

### D. Local-First & Cloud Toggles (Requirement #1)

1. Open `backend/.env`.
2. Set `USE_CLOUD_SERVICES=false`.
3. Restart the backend.
4. Try to interact. The system will switch to local heuristics and you'll see logging about "Offline Mode" fallbacks.

## 4. Database Audit (Optional)

To see the internal state of approvals, tasks, and agents:

```powershell
cd E:\hack0\hackkk\backend
npx prisma studio
```

Visit `http://localhost:5555` to explore the SQLite data.
