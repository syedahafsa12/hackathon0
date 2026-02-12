# Mini Hafsa 2.0 API Documentation

## Base URL
```
http://localhost:8080
```

## Authentication
Currently using development mode with default user `dev-user-001`. In production, implement JWT or session-based auth.

---

## Health Check

### GET /health
System health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-02-10T14:30:00.000Z",
  "uptime": 3600.5
}
```

---

## Priority Sorter Agent

### POST /api/priority/generate
Generate today's priority plan.

**Request:**
```bash
curl -X POST http://localhost:8080/api/priority/generate
```

**Response:**
```json
{
  "success": true,
  "message": "Priority plan generated successfully",
  "filePath": ".obsidian-vault/Plans/Daily_Priority_2024-02-10.md",
  "priorities": {
    "doNow": 3,
    "doNext": 5,
    "canWait": 7
  },
  "conflicts": [
    {
      "type": "overloaded_day",
      "description": "Total estimated work (10 hours) exceeds 8 hours",
      "affectedItems": []
    }
  ]
}
```

### GET /api/priority/today
Get today's priority plan.

**Request:**
```bash
curl http://localhost:8080/api/priority/today
```

**Response (exists):**
```json
{
  "success": true,
  "plan": {
    "doNow": [
      { "id": "task-1", "title": "Submit tax documents", "priority": "critical" }
    ],
    "doNext": [
      { "id": "task-2", "title": "Review proposal", "priority": "high" }
    ],
    "canWait": [
      { "id": "task-3", "title": "Organize photos", "priority": "low" }
    ]
  }
}
```

**Response (no plan):**
```json
{
  "success": true,
  "plan": null,
  "message": "No priority plan for today. Use POST /api/priority/generate to create one."
}
```

### POST /api/priority/resort
Re-prioritize with current data (preserves manual edits).

**Request:**
```bash
curl -X POST http://localhost:8080/api/priority/resort
```

**Response:** Same as POST /api/priority/generate

---

## Ralph Loop Executor

### POST /api/ralph/execute
Execute a multi-step task autonomously.

**Request:**
```bash
curl -X POST http://localhost:8080/api/ralph/execute \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Research AI competitors and create a summary document",
    "maxIterations": 10
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| prompt | string | Yes | Task description |
| maxIterations | number | No | Max iterations (default: 10) |

**Response (success):**
```json
{
  "success": true,
  "taskId": "abc-123-def",
  "iterations": 3,
  "status": "completed",
  "output": "Task analysis complete. All steps processed.",
  "filePath": ".obsidian-vault/Done/TASK_abc-123-def.md"
}
```

**Response (not multi-step):**
```json
{
  "success": false,
  "error": "This doesn't appear to be a multi-step task.",
  "hint": "Multi-step tasks typically include phrases like 'research and create', 'analyze and report', etc."
}
```

### GET /api/ralph/status/:taskId
Get status of a running task.

**Request:**
```bash
curl http://localhost:8080/api/ralph/status/abc-123-def
```

**Response:**
```json
{
  "success": true,
  "status": {
    "taskId": "abc-123-def",
    "prompt": "Research AI competitors...",
    "currentIteration": 2,
    "maxIterations": 10,
    "status": "running",
    "startedAt": "2024-02-10T14:30:00.000Z",
    "lastIterationAt": "2024-02-10T14:31:00.000Z",
    "iterationCount": 2
  }
}
```

### POST /api/ralph/stop/:taskId
Emergency stop for a running task.

**Request:**
```bash
curl -X POST http://localhost:8080/api/ralph/stop/abc-123-def
```

**Response:**
```json
{
  "success": true,
  "message": "Task abc-123-def has been stopped"
}
```

---

## News Agent

### POST /api/news/fetch
Fetch today's news (bypasses cache).

**Request:**
```bash
curl -X POST http://localhost:8080/api/news/fetch
```

**Response:**
```json
{
  "success": true,
  "fromCache": false,
  "digest": {
    "date": "2024-02-10",
    "tech": [
      {
        "title": "OpenAI releases GPT-5",
        "summary": "Major improvements in reasoning capabilities",
        "url": "https://example.com/article1",
        "source": "TechCrunch",
        "publishedAt": "2024-02-10T10:00:00.000Z",
        "category": "tech"
      }
    ],
    "ai": [...],
    "world": [...],
    "fetchedAt": "2024-02-10T14:30:00.000Z"
  }
}
```

### GET /api/news/today
Get today's news (uses cache if available).

**Request:**
```bash
curl http://localhost:8080/api/news/today
```

**Response:** Same as POST /api/news/fetch, but with `"fromCache": true` if cached.

### GET /api/news/search
Search past news digests.

**Request:**
```bash
curl "http://localhost:8080/api/news/search?q=AI&category=ai&date=2024-02-09"
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| q | string | Yes | Search query |
| category | string | No | Filter by category: tech, ai, world |
| date | string | No | Filter by date (YYYY-MM-DD) |

**Response:**
```json
{
  "success": true,
  "query": "AI",
  "category": "ai",
  "date": "2024-02-09",
  "resultCount": 3,
  "results": [
    {
      "title": "AI regulation law passes",
      "summary": "EU comprehensive AI regulation",
      "url": "https://example.com",
      "source": "Reuters",
      "publishedAt": "2024-02-09T10:00:00.000Z",
      "category": "ai"
    }
  ]
}
```

---

## CEO Briefing Agent

### POST /api/briefing/generate
Generate weekly CEO briefing (manual trigger for testing).

**Request:**
```bash
curl -X POST http://localhost:8080/api/briefing/generate
```

**Response:**
```json
{
  "success": true,
  "message": "CEO briefing generated successfully",
  "briefing": {
    "weekStart": "2024-02-04T00:00:00.000Z",
    "weekEnd": "2024-02-10T23:59:59.999Z",
    "filePath": ".obsidian-vault/Briefings/CEO_Briefing_2024-02-10.md",
    "highlights": [
      "Strong week with 85% task completion rate",
      "Good focus time: 34 hours of deep work"
    ],
    "metrics": {
      "taskCompletionRate": 85,
      "meetingHours": 8,
      "deepWorkHours": 34
    },
    "bottleneckCount": 1,
    "suggestionCount": 2
  }
}
```

### GET /api/briefing/latest
Get most recent briefing.

**Request:**
```bash
curl http://localhost:8080/api/briefing/latest
```

**Response:**
```json
{
  "success": true,
  "briefing": {
    "weekStart": "2024-02-04T00:00:00.000Z",
    "weekEnd": "2024-02-10T23:59:59.999Z",
    "metrics": {...},
    "highlights": [...],
    "bottlenecks": [...],
    "upcomingDeadlines": [...],
    "suggestions": [...],
    "filePath": ".obsidian-vault/Briefings/CEO_Briefing_2024-02-10.md"
  }
}
```

### GET /api/briefing/history
List all past briefings.

**Request:**
```bash
curl "http://localhost:8080/api/briefing/history?limit=5"
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| limit | number | No | Max results (default: 10) |

**Response:**
```json
{
  "success": true,
  "count": 3,
  "briefings": [
    {
      "weekStart": "2024-02-04T00:00:00.000Z",
      "weekEnd": "2024-02-10T23:59:59.999Z",
      "createdAt": "2024-02-10T20:00:00.000Z",
      "filePath": ".obsidian-vault/Briefings/CEO_Briefing_2024-02-10.md"
    }
  ]
}
```

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

**HTTP Status Codes:**
- 200: Success
- 400: Bad request (missing required fields)
- 404: Resource not found
- 500: Internal server error

---

## Rate Limits

No rate limits in development mode. For production:
- NewsAPI: 100 requests/day (free tier)
- Mistral AI: Based on your plan

---

## Webhooks (Future)

Planned webhook support for:
- Approval status changes
- Task completion
- Briefing generation
- Error notifications
