// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  preferences?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Chat Message Types
export interface ChatMessage {
  id: string;
  userId: string;
  sender: "user" | "assistant";
  content: string;
  timestamp: Date;
  status: "sent" | "delivered" | "read";
  parentId?: string;
}

// Task Types
export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: "pending" | "in-progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "critical";
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Calendar Event Types
export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: Array<{ name: string; email: string }>;
  calendarId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Email Message Types
export interface EmailMessage {
  id: string;
  userId: string;
  messageId: string;
  subject: string;
  body: string;
  sender: string;
  recipient: string;
  receivedAt: Date;
  importance: "critical" | "high" | "medium" | "low" | "spam";
  status:
    | "unread"
    | "read"
    | "processed"
    | "action-required"
    | "approved"
    | "rejected";
  draftReply?: string;
}

// Knowledge Entry Types
export interface KnowledgeEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lastAccessed: Date;
}

// LinkedIn Post Types
export interface LinkedInPost {
  id: string;
  userId: string;
  title: string;
  content: string;
  status: "draft" | "scheduled" | "posted" | "rejected";
  scheduledDate?: Date;
  postedDate?: Date;
  engagementMetrics?: any;
  createdAt: Date;
  updatedAt: Date;
}

// News Digest Types
export interface NewsDigest {
  id: string;
  userId?: string;
  content: string;
  source: string;
  publishedAt: Date;
  category: "AI" | "tech" | "world-impact";
  createdAt: Date;
}

// Approval Types
export interface Approval {
  id: string;
  userId: string;
  actionType: string;
  actionData: any;
  status: "pending" | "approved" | "rejected";
  requestedAt: Date;
  respondedAt?: Date;
  responderId?: string;
  rejectionReason?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

// Chat Action Types
export interface ChatAction {
  type: "approve_deny" | "button_group" | "input_request";
  id: string;
  title: string;
  content: string;
  approveText?: string;
  rejectText?: string;
  buttons?: Array<{
    text: string;
    action: string;
    style?: "primary" | "secondary" | "danger";
  }>;
}
