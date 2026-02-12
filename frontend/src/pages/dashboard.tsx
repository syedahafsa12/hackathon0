import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// Components
import ApprovalPanel from '../components/approval/ApprovalPanel';
import ReminderPanel from '../components/reminders/ReminderPanel';
import KnowledgeVault from '../components/knowledge/KnowledgeVault';
import NewsDigest from '../components/news/NewsDigest';
import LinkedInPanel from '../components/linkedin/LinkedInPanel';
import CalendarView from '../components/calendar/CalendarView';

// New Hackathon 0 Agent Components
import PriorityPanel from '../components/priority/PriorityPanel';
import CEOBriefingBanner from '../components/briefing/CEOBriefingBanner';
import { RalphTaskExecutor } from '../components/ralph/RalphLoopProgress';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

type Tab = 'priorities' | 'calendar' | 'approvals' | 'reminders' | 'knowledge' | 'news' | 'linkedin' | 'ralph';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('priorities');
  const [messages, setMessages] = useState<any[]>([
    {
      id: '1',
      sender: 'assistant',
      content: "Hey! I'm Mini Hafsa 2.0, your AI employee with superpowers! Try:\n• \"What's my priority today?\"\n• \"Get me today's news\"\n• \"Show me weekly briefing\"\n• \"Research competitors and create a summary\"\n• \"Send email to...\"",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBriefingBanner, setShowBriefingBanner] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const messageContent = inputValue.trim();

    // Add user message
    const userMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content: messageContent,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'dev-user-001',
          content: messageContent
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      if (data.success && data.data?.assistantMessage) {
        setMessages(prev => [...prev, {
          id: data.data.assistantMessage.id,
          sender: 'assistant',
          content: data.data.assistantMessage.content,
          timestamp: new Date(data.data.assistantMessage.timestamp),
          intent: data.data.intent
        }]);

        // Auto-switch tabs based on intent
        if (data.data.intent) {
          const intent = data.data.intent.intent;
          if (intent === 'SEND_EMAIL') {
            setTimeout(() => setActiveTab('approvals'), 500);
          } else if (intent === 'CREATE_REMINDER' || intent === 'CREATE_TASK') {
            setTimeout(() => setActiveTab('reminders'), 500);
          } else if (intent === 'CHECK_CALENDAR' || intent === 'CREATE_CALENDAR_EVENT') {
            setTimeout(() => setActiveTab('calendar'), 500);
          } else if (intent === 'GET_NEWS' || intent === 'FETCH_NEWS') {
            setTimeout(() => setActiveTab('news'), 500);
          } else if (intent === 'GET_PRIORITIES' || intent === 'PRIORITIZE') {
            setTimeout(() => setActiveTab('priorities'), 500);
          } else if (intent === 'RALPH_LOOP_START') {
            setTimeout(() => setActiveTab('ralph'), 500);
          }
        }

        // Check for agent-specific keywords in message
        const lowerContent = messageContent.toLowerCase();
        if (lowerContent.includes('priorit') || lowerContent.includes('today') || lowerContent.includes('plan')) {
          setTimeout(() => setActiveTab('priorities'), 500);
        } else if (lowerContent.includes('news') || lowerContent.includes('headlines')) {
          setTimeout(() => setActiveTab('news'), 500);
        } else if (lowerContent.includes('briefing') || lowerContent.includes('weekly report')) {
          // Keep on current tab, briefing modal will show
        } else if (lowerContent.includes('research and') || lowerContent.includes('analyze and')) {
          setTimeout(() => setActiveTab('ralph'), 500);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        content: "I'm having trouble connecting right now. Please try again.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'priorities', label: 'Priorities', icon: '🎯' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'approvals', label: 'Approvals', icon: '✓' },
    { id: 'reminders', label: 'Reminders', icon: '⏰' },
    { id: 'knowledge', label: 'Vault', icon: '📝' },
    { id: 'news', label: 'News', icon: '📰' },
    { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
    { id: 'ralph', label: 'Ralph', icon: '🤖' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'priorities':
        return <PriorityPanel autoRefresh={true} refreshInterval={30000} />;
      case 'calendar':
        return <CalendarView />;
      case 'approvals':
        return <ApprovalPanel />;
      case 'reminders':
        return <ReminderPanel />;
      case 'knowledge':
        return <KnowledgeVault />;
      case 'news':
        return <NewsDigest autoRefresh={false} />;
      case 'linkedin':
        return <LinkedInPanel />;
      case 'ralph':
        return <RalphTaskExecutor />;
      default:
        return <PriorityPanel />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <Head>
        <title>Mini Hafsa 2.0 - Dashboard</title>
        <meta name="description" content="Your AI employee dashboard - Hackathon 0 Edition" />
      </Head>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-pink-100 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-600">
              Mini Hafsa 2.0
            </h1>
            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
              Hackathon 0
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/vault" className="text-sm text-pink-600 hover:text-pink-800 transition-colors flex items-center gap-1">
              <span>📁</span>
              <span>Vault</span>
            </Link>
            <Link href="/logs" className="text-sm text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1">
              <span>📝</span>
              <span>Logs</span>
            </Link>
            <span className="text-sm text-gray-500">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* CEO Briefing Banner */}
        {showBriefingBanner && (
          <CEOBriefingBanner onDismiss={() => setShowBriefingBanner(false)} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">

          {/* Left Panel - Chat */}
          <div className="lg:col-span-1 flex flex-col bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg overflow-hidden border border-pink-100">
            <div className="p-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white">
              <h2 className="text-lg font-bold">Chat with Mini Hafsa</h2>
              <p className="text-xs opacity-80">Natural language for everything</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-sm ${message.sender === 'user'
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-br-sm'
                      : 'bg-white border border-pink-100 rounded-bl-sm'
                      }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    <div className={`text-xs mt-1 ${message.sender === 'user' ? 'text-pink-100' : 'text-gray-400'}`}>
                      {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-pink-100 p-3 rounded-2xl rounded-bl-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce"></div>
                      <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce delay-75"></div>
                      <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce delay-150"></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-pink-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-white border border-pink-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  Send
                </button>
              </div>
            </form>
          </div>

          {/* Right Panel - Tabs & Content */}
          <div className="lg:col-span-2 flex flex-col">
            {/* Tabs */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
                    : 'bg-white/80 text-gray-600 hover:bg-pink-50'
                    }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-pink-100 py-2 z-30">
        <div className="container mx-auto px-4 flex justify-center items-center gap-4 text-xs text-gray-400">
          <span>Mini Hafsa 2.0</span>
          <span>•</span>
          <span>Hackathon 0 Compliant</span>
          <span>•</span>
          <span>Local-First + HITL</span>
        </div>
      </footer>
    </div>
  );
}
