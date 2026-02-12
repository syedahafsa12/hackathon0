# hack0 Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-09

## Active Technologies
- TypeScript 5.x / Node.js 18+ + Fastify 3.29, Prisma 5.22, Socket.io 4.7, Mistral AI SDK (001-natural-language-commands)
- Python 3.13+ + FastAPI, asyncio, structlog, watchdog, websockets (002-hackathon-zero-architecture)
- TypeScript 5.x / Node.js 18+ + Fastify 3.29 (existing), chokidar 3.x (new), gray-matter 4.x (new), Prisma 5.22 (existing) (003-obsidian-vault-integration)
- SQLite with Prisma ORM (existing) + Local filesystem for Obsidian vault (new) (003-obsidian-vault-integration)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.x / Node.js 18+: Follow standard conventions
Python 3.13+: Use type hints, async/await, Pydantic models, Protocol for interfaces

## Recent Changes
- 003-obsidian-vault-integration: Added TypeScript 5.x / Node.js 18+ + Fastify 3.29 (existing), chokidar 3.x (new), gray-matter 4.x (new), Prisma 5.22 (existing)
- 001-natural-language-commands: Added TypeScript 5.x / Node.js 18+ + Fastify 3.29, Prisma 5.22, Socket.io 4.7, Mistral AI SDK
- 002-hackathon-zero-architecture: Added Python 3.13+ for Ralph Wiggum loop, MCP server, Watchers + FastAPI, structlog, watchdog

<!-- MANUAL ADDITIONS START -->

## Project Constitution

See `.speckit/constitution.md` for comprehensive project principles including:
- Architecture patterns (Ralph Wiggum loop, agent structure)
- Code quality standards
- Testing requirements
- HITL (Human-in-the-Loop) approval workflow
- Structured JSON logging
- Agent extensibility guidelines

## Key Architectural Principles

1. **Preserve Agent Code**: Refactor existing agents to Hackathon Zero patterns; never discard working agent logic
2. **HITL Required**: All sensitive actions (email, LinkedIn posts, deletes) require user approval
3. **Structured Logging**: All agent/loop actions logged in JSON format with correlationId
4. **Modular Agents**: Each agent implements `IAgent` interface for consistency
5. **Ralph Wiggum Loop**: Central orchestrator that schedules tasks, invokes agents, updates Dashboard.md

## Agent List

| Agent | Purpose | Approval Required |
|-------|---------|-------------------|
| EmailAgent | Draft and send emails | Yes |
| LinkedInAgent | Generate and track posts | Yes |
| CalendarAgent | Manage calendar events | Medium priority |
| TaskAgent | Create and manage tasks | No |
| KnowledgeAgent | Store and retrieve knowledge | No |
| NewsAgent | Fetch and summarize news | No |
| DailySummaryAgent | Generate daily priorities | No |
| ApprovalAgent | Manage HITL approvals | N/A |

<!-- MANUAL ADDITIONS END -->
