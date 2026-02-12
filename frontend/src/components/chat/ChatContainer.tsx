import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import EmailNotification from '../notifications/EmailNotification';
import TaskList from '../tasks/TaskList';
import CalendarView from '../calendar/CalendarView';
import DailySummary from '../priority/DailySummary';
import KnowledgeVault from '../knowledge/KnowledgeVault';
import ApprovalPanel from '../approval/ApprovalPanel';
import ReminderPanel from '../reminders/ReminderPanel';
import TodayOverview from '../todayOverview/TodayOverview';
import NewsDigest from '../news/NewsDigest';
import LinkedInPanel from '../linkedin/LinkedInPanel';
import { ChatMessage as ChatMessageType, EmailMessage, Task, CalendarEvent, KnowledgeEntry, Approval } from '../../../../shared/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface ChatContainerProps {
  userId: string;
}

type ActivePanel = 'chat' | 'approvals' | 'reminders' | 'today' | 'calendar' | 'knowledge' | 'news' | 'linkedin';

const ChatContainer: React.FC<ChatContainerProps> = ({ userId }) => {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [emailNotifications, setEmailNotifications] = useState<EmailMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial chat history
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const response = await fetch('/api/chat/history');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setMessages(result.data.messages || []);
          }
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    };

    loadChatHistory();
  }, [userId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch approvals
  const fetchApprovals = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/approvals/pending`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.approvals) {
          setApprovals(result.data.approvals);
        }
      }
    } catch (error) {
      console.error('Error fetching approvals:', error);
    }
  }, []);

  // Auto-refresh approvals
  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 5000);
    return () => clearInterval(interval);
  }, [fetchApprovals]);

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: ChatMessageType = {
      id: `msg-${Date.now()}`,
      userId,
      sender: 'user',
      content,
      timestamp: new Date(),
      status: 'sent'
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Create placeholder for assistant message
    const assistantMessageId = `msg-${Date.now() + 1}`;
    const assistantMessage: ChatMessageType = {
      id: assistantMessageId,
      userId,
      sender: 'assistant',
      content: '',
      timestamp: new Date(),
      status: 'sent'
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Use streaming endpoint
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: content }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'thinking') {
                // Show thinking indicator
                setIsLoading(true);
              } else if (data.type === 'content') {
                // Append content to assistant message
                setIsLoading(false);
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: msg.content + data.content }
                    : msg
                ));
              } else if (data.type === 'done') {
                setIsLoading(false);
              } else if (data.type === 'error') {
                throw new Error(data.content);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);

      // Update assistant message with error
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: "Sorry, I'm having trouble connecting to the server. Please try again." }
          : msg
      ));
    }
  };

  const handleEmailAction = (emailId: string, action: 'approve' | 'reject' | 'edit') => {
    console.log(`Handling email action: ${action} for email ${emailId}`);

    // In a real implementation, this would call the backend API
    // For now, we'll just remove the notification
    setEmailNotifications(prev => prev.filter(email => email.id !== emailId));
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks(prev => prev.map(task => task.id === updatedTask.id ? updatedTask : task));
  };

  const handleTaskDelete = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const handleEventEdit = (event: CalendarEvent) => {
    console.log('Editing event:', event);
    // In a real implementation, this would open an edit modal
  };

  const handleEventDelete = (eventId: string) => {
    setCalendarEvents(prev => prev.filter(event => event.id !== eventId));
  };

  const handleKnowledgeSearch = (query: string) => {
    console.log('Searching knowledge:', query);
    // In a real implementation, this would call the backend API
  };

  const handleSelectKnowledgeEntry = (entry: KnowledgeEntry) => {
    console.log('Selected knowledge entry:', entry);
    // In a real implementation, this would show the full entry details
  };

  // Add LinkedIn functionality
  const [linkedinPosts, setLinkedinPosts] = useState<any[]>([]);

  const handleGenerateLinkedInPost = (topic: string, tone: string) => {
    console.log('Generating LinkedIn post:', { topic, tone });
    // In a real implementation, this would call the backend API

    // Mock LinkedIn post generation
    const mockPost = {
      id: `post-${Date.now()}`,
      title: `LinkedIn Post: ${topic}`,
      content: `This is a sample LinkedIn post about ${topic}. It includes professional insights and engages the audience with relevant content.`,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setLinkedinPosts(prev => [mockPost, ...prev]);
  };

  // Add news functionality
  const [newsArticles, setNewsArticles] = useState<any[]>([]);

  const handleGetNews = (categories: string[] = ['AI', 'tech', 'world-impact']) => {
    console.log('Getting news for categories:', categories);
    // In a real implementation, this would call the backend API

    // Mock news articles
    const mockNews = [
      {
        id: `news-${Date.now()}`,
        source: 'TechCrunch',
        content: 'New breakthrough in neural network efficiency could revolutionize AI computing by reducing power consumption by 50%.',
        category: 'AI',
        publishedAt: new Date()
      },
      {
        id: `news-${Date.now() + 1}`,
        source: 'MIT Technology Review',
        content: 'Quantum computing milestone achieved as researchers demonstrate stable qubit operations for extended periods.',
        category: 'tech',
        publishedAt: new Date()
      }
    ];

    setNewsArticles(mockNews);
  };

  const panelTabs: { id: ActivePanel; label: string; icon: string; badge?: number }[] = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'approvals', label: 'Approvals', icon: '✓', badge: approvals.length },
    { id: 'today', label: 'Today', icon: '📋' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'reminders', label: 'Reminders', icon: '⏰' },
    { id: 'knowledge', label: 'Vault', icon: '📝' },
    { id: 'news', label: 'News', icon: '📰' },
    { id: 'linkedin', label: 'LinkedIn', icon: '💼' }
  ];

  const renderPanel = () => {
    switch (activePanel) {
      case 'approvals':
        return <ApprovalPanel autoRefresh={true} />;
      case 'today':
        return <TodayOverview autoRefresh={true} />;
      case 'calendar':
        return <CalendarView autoRefresh={true} />;
      case 'reminders':
        return <ReminderPanel autoRefresh={true} />;
      case 'knowledge':
        return <KnowledgeVault autoRefresh={true} />;
      case 'news':
        return <NewsDigest />;
      case 'linkedin':
        return <LinkedInPanel autoRefresh={true} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl shadow-lg overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white">
        <h2 className="text-xl font-bold">Mini Hafsa</h2>
        <p className="text-xs opacity-80">Your personal AI assistant</p>
      </div>

      {/* Panel Tabs */}
      <div className="flex gap-1 p-2 bg-white/50 overflow-x-auto">
        {panelTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActivePanel(tab.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${activePanel === tab.id
                ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                : 'bg-white/80 text-gray-600 hover:bg-pink-50'
              }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs px-1.5 rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {activePanel === 'chat' ? (
          <div className="space-y-4">
            {/* Quick Action Buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setActivePanel('today')}
                className="text-xs bg-pink-100 text-pink-700 px-3 py-1 rounded-full hover:bg-pink-200"
              >
                What's my plan today?
              </button>
              <button
                onClick={() => setActivePanel('approvals')}
                className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full hover:bg-purple-200"
              >
                Check approvals
              </button>
              <button
                onClick={() => setActivePanel('news')}
                className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200"
              >
                Get news
              </button>
            </div>

            {/* Email notifications */}
            {emailNotifications.length > 0 && (
              <div className="mb-4">
                <h3 className="font-bold text-pink-600 mb-2 text-sm">Email Notifications</h3>
                {emailNotifications.map(email => (
                  <EmailNotification
                    key={email.id}
                    email={email}
                    onApprove={() => handleEmailAction(email.id, 'approve')}
                    onReject={() => handleEmailAction(email.id, 'reject')}
                    onEdit={() => handleEmailAction(email.id, 'edit')}
                  />
                ))}
              </div>
            )}

            {/* Chat messages */}
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isOwn={message.sender === 'user'}
              />
            ))}

            {isLoading && (
              <div className="kawaii-chat-bubble-assistant kawaii-chat-bubble mr-auto bg-white border border-pink-100">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce delay-75"></div>
                  <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce delay-150"></div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        ) : (
          renderPanel()
        )}
      </div>

      {/* Chat Input - Always visible */}
      <div className="p-3 border-t border-pink-100 bg-white/50">
        <ChatInput onSendMessage={handleSendMessage} />
        <p className="text-xs text-gray-400 text-center mt-1">
          Natural language for everything: email, reminders, calendar, knowledge...
        </p>
      </div>
    </div>
  );
};

export default ChatContainer;