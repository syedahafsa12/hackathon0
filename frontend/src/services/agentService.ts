import {
  Task,
  PriorityPlan,
  NewsDigest,
  Briefing,
  RalphStatus,
  AgentResponse,
} from "../types/agentTypes";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

/**
 * Agent Service Layer
 * Centralized API calls for all Hackathon 0 agents
 */

// ============================================================================
// Priority Sorter Agent
// ============================================================================

export async function getPriorityPlan(): Promise<PriorityPlan> {
  const response = await fetch(`${API_BASE_URL}/api/priorities`);
  const result = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch priority plan");
  }

  // If backend already provides sections, use them directly
  if (result.data.sections) {
    return {
      id: "priority-" + Date.now(),
      date: new Date().toISOString().split("T")[0],
      sections: {
        doNow: result.data.sections.doNow || [],
        doNext: result.data.sections.doNext || [],
        canWait: result.data.sections.canWait || [],
      },
      lastUpdated: result.data.lastUpdated || new Date().toISOString(),
    };
  }

  // Fallback for older backend versions (legacy transformation)
  const { todayEvents = [], pendingTasks = [], reminders = [] } = result.data;

  return {
    id: "priority-" + Date.now(),
    date: new Date().toISOString().split("T")[0],
    sections: {
      doNow: [
        ...todayEvents.map((e: any) => ({
          id: e.id,
          text: `📅 ${e.title} (${formatTimestamp(e.startTime)})`,
          checked: false,
          priority: "do-now" as const,
        })),
        ...reminders.map((r: any) => ({
          id: r.id,
          text: `🔔 ${r.title}`,
          checked: false,
          priority: "do-now" as const,
        })),
      ],
      doNext: pendingTasks.map((t: any) => ({
        id: t.id,
        text: `📝 ${t.title}`,
        checked: false,
        priority: "do-next" as const,
      })),
      canWait: [],
    },
    lastUpdated: new Date().toISOString(),
  };
}

export async function resortPriorities(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/priority/resort`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const result: AgentResponse<void> = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || "Failed to resort priorities");
  }
}

// ============================================================================
// News Agent V2
// ============================================================================

export async function fetchNews(
  forceRefresh: boolean = false,
): Promise<NewsDigest> {
  const response = await fetch(`${API_BASE_URL}/api/news/fetch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ forceRefresh }),
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.error?.message || result.error || "Failed to fetch news",
    );
  }

  // Backend returns { success, digest } format - transform to expected structure
  const digest = result.digest || result.data;
  if (!digest) {
    // Return empty digest
    return {
      categories: {
        Tech: [],
        AI: [],
        "World-Impacting": [],
      },
      fetchedAt: new Date().toISOString(),
      totalArticles: 0,
    };
  }

  return {
    categories: digest.categories || {
      Tech: digest.tech || [],
      AI: digest.ai || [],
      "World-Impacting": digest.worldImpacting || digest.world || [],
    },
    fetchedAt: digest.fetchedAt || new Date().toISOString(),
    totalArticles: digest.totalArticles || 0,
  };
}

export async function getTodayNews(): Promise<NewsDigest | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/news/today`);
    const result = await response.json();

    if (!result.success) {
      return null;
    }

    // Backend returns { success, digest } format
    const digest = result.digest || result.data;
    if (!digest) {
      return null;
    }

    return {
      categories: digest.categories || {
        Tech: digest.tech || [],
        AI: digest.ai || [],
        "World-Impacting": digest.worldImpacting || digest.world || [],
      },
      fetchedAt: digest.fetchedAt || new Date().toISOString(),
      totalArticles: digest.totalArticles || 0,
    };
  } catch (error) {
    console.error("Error fetching today news:", error);
    return null;
  }
}

// ============================================================================
// CEO Briefing Agent
// ============================================================================

export async function getBriefingHistory(): Promise<Briefing[]> {
  const response = await fetch(`${API_BASE_URL}/api/briefing/history`);
  const result: AgentResponse<Briefing[]> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(
      result.error?.message || "Failed to fetch briefing history",
    );
  }

  return result.data;
}

export async function getLatestBriefing(): Promise<Briefing | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/briefing/latest`);
    const result: AgentResponse<Briefing> = await response.json();

    if (!result.success) {
      return null;
    }

    return result.data || null;
  } catch (error) {
    console.error("Error fetching latest briefing:", error);
    return null;
  }
}

export async function generateBriefing(): Promise<Briefing> {
  const response = await fetch(`${API_BASE_URL}/api/briefing/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const result: AgentResponse<Briefing> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to generate briefing");
  }

  return result.data;
}

// ============================================================================
// Ralph Loop Agent
// ============================================================================

export async function getRalphStatus(taskId: string): Promise<RalphStatus> {
  const response = await fetch(`${API_BASE_URL}/api/ralph/status/${taskId}`);
  const result: AgentResponse<RalphStatus> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch Ralph status");
  }

  return result.data;
}

export async function stopRalphTask(taskId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/ralph/stop/${taskId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const result: AgentResponse<void> = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || "Failed to stop Ralph task");
  }
}

// ============================================================================
// Task Agent / Pulse
// ============================================================================

export async function getTasks(): Promise<Task[]> {
  const response = await fetch(`${API_BASE_URL}/api/tasks`);
  const result: AgentResponse<{ tasks: Task[] }> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch tasks");
  }

  return result.data.tasks;
}

export async function updateTaskStatus(
  taskId: string,
  status: Task["status"],
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  const result: AgentResponse<void> = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || "Failed to update task status");
  }
}

export async function snoozeTask(
  taskId: string,
  minutes: number,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/snooze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ minutes }),
  });

  const result: AgentResponse<void> = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || "Failed to snooze task");
  }
}

// ============================================================================
// Email Agent
// ============================================================================

export async function getEmails(): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/api/emails`);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || "Failed to fetch emails");
  }

  return result.data.emails;
}

export async function updateEmailStatus(
  id: string,
  status: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/emails/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || "Failed to update email status");
  }
}

export async function generateDraft(id: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/emails/${id}/draft`, {
    method: "POST",
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || "Failed to generate draft");
  }

  return result.data.email;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function isCacheValid(
  timestamp: string,
  maxAgeHours: number = 24,
): boolean {
  const cacheTime = new Date(timestamp).getTime();
  const now = new Date().getTime();
  const ageHours = (now - cacheTime) / (1000 * 60 * 60);

  return ageHours < maxAgeHours;
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
