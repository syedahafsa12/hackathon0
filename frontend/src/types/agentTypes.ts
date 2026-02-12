// Type definitions for Hackathon 0 agents

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "completed" | "failed" | "running" | "snoozed";
  priority: "low" | "medium" | "high";
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface PriorityItem {
  id?: string;
  text: string;
  checked: boolean;
  priority?: "do-now" | "do-next" | "can-wait";
}

export interface PriorityPlan {
  id: string;
  date: string;
  sections: {
    doNow: PriorityItem[];
    doNext: PriorityItem[];
    canWait: PriorityItem[];
  };
  lastUpdated: string;
}

export interface NewsArticle {
  title: string;
  summary: string;
  url?: string;
  source?: string;
  category: "Tech" | "AI" | "World-Impacting";
}

export interface NewsDigest {
  categories: {
    Tech: NewsArticle[];
    AI: NewsArticle[];
    "World-Impacting": NewsArticle[];
  };
  fetchedAt: string;
  totalArticles: number;
}

export interface Briefing {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  weekStart: string;
  weekEnd: string;
  type: "weekly" | "monthly" | "quarterly";
}

export interface RalphStatus {
  taskId: string;
  status: "running" | "completed" | "failed" | "stopped" | "idle";
  currentIteration: number;
  maxIterations: number;
  progress: number; // 0-100
  message?: string;
  result?: any;
  startedAt: string;
  completedAt?: string;
}

export interface AgentResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
