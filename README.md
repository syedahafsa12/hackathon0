# 🧠 Mini Hafsa 2.0: AI Employee with Obsidian Nerve Center

**Mini Hafsa 2.0** is a comprehensive AI employee system that automates routine tasks while maintaining human oversight. It uses **Obsidian** as its "nerve center" for all AI reasoning, approvals, and knowledge management, ensuring complete transparency and auditability.

> [!IMPORTANT]
> **Hackathon 0 Compliant**: Built with local-first architecture, human-in-the-loop (HITL) approval for all sensitive operations, and observable execution.

---

## ✨ Key Features

### 🛠 Core System
- **Obsidian Vault Integration**: All AI actions create Markdown files before database records.
- **File-Based Approvals**: Approve actions by moving files between folders in Obsidian.
- **Real-Time Dashboard**: `Dashboard.md` auto-updates with current system state.

### 🤖 Autonomous Agents
- **Priority Sorter**: Daily at 6 AM - Organizes tasks into *Do Now*, *Do Next*, and *Can Wait*.
- **Ralph Loop Executor**: Completes multi-step tasks autonomously after initial approval.
- **News Agent**: On-demand curated news with 24-hour smart caching.
- **CEO Briefing**: Weekly Sunday 8 PM - Performance analysis with actionable insights.

### 🤝 Human-in-the-Loop (HITL)
- 📧 Email sending requires manual approval.
- 📅 Calendar events require manual approval.
- 🔗 LinkedIn posting requires manual approval.
- 📝 All sensitive operations are logged to the vault.

---

## 🏗 Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                         │
│   (Chat, Dashboard, Approval Queue, News Panel)             │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                  Fastify Backend                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Intent Router & Orchestrator               │   │
│  └──────────┬───────────────────────────────────────────┘   │
│             │                                               │
│  ┌──────────▼──────────┐  ┌──────────────┐                  │
│  │      Watchers       │  │    Agents    │                  │
│  │ - Email             │  │ - Priority   │                  │
│  │ - Calendar          │  │ - Ralph      │                  │
│  │ - Task              │  │ - News       │                  │
│  │ - Reminder          │  │ - CEO Brief  │                  │
│  │ - LinkedIn          │  └──────────────┘                  │
│  │ - Knowledge         │                                    │
│  └─────────────────────┘                                    │
└────────────┬──────────────────────┬────────────────────────┘
             │                      │
┌────────────▼──────────┐  ┌────────▼─────────────────────┐
│    SQLite Database    │  │       Obsidian Vault         │
│ - Tasks               │  │ - Pending_Approval/          │
│ - Events              │  │ - Approved/                  │
│ - Approvals           │  │ - Done/                      │
│ - Knowledge           │  │ - Plans/                     │
│ - NewsCache           │  │ - Briefings/                 │
└───────────────────────┘  │ - Logs/                      │
                           └──────────────────────────────┘
