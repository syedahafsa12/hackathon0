import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api';
const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:8080';

export default function ChatPage() {
  const [messages, setMessages] = useState([
    {
      id: '1',
      sender: 'assistant',
      content: 'Hey! I\'m Mini Hafsa, your personal AI assistant. What can I help you with today?',
      timestamp: new Date(Date.now() - 300000),
      status: 'read'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const userId = 'user-1'; // TODO: Get from auth context

  // Initialize WebSocket connection - TEMPORARILY DISABLED
  useEffect(() => {
    // WebSocket is temporarily disabled on the backend
    // Chat works via HTTP requests instead
    console.log('WebSocket disabled - using HTTP polling');

    /* 
    socketRef.current = io(WEBSOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('WebSocket connected');
      socketRef.current?.emit('join', { userId });
    });

    socketRef.current.on('assistant_response', (data) => {
      const assistantMessage = {
        id: data.messageId,
        sender: 'assistant',
        content: data.content,
        timestamp: new Date(data.timestamp),
        status: 'sent',
        intent: data.intent
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    });

    socketRef.current.on('approval_request', (data) => {
      console.log('Approval request received:', data);
      // TODO: Show approval in UI
    });

    return () => {
      socketRef.current?.disconnect();
    };
    */
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim()) return;

    const messageContent = inputValue;

    // Add user message
    const userMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content: messageContent,
      timestamp: new Date(),
      status: 'sent'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Call backend API
      const response = await fetch(`${API_BASE_URL}/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add auth token
        },
        body: JSON.stringify({
          userId,
          content: messageContent
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      // If WebSocket didn't already add the response, add it here
      if (data.success && data.data.assistantMessage) {
        setMessages(prev => {
          // Check if message already exists (from WebSocket)
          const exists = prev.some(m => m.id === data.data.assistantMessage.id);
          if (exists) return prev;

          return [...prev, {
            id: data.data.assistantMessage.id,
            sender: 'assistant',
            content: data.data.assistantMessage.content,
            timestamp: new Date(data.data.assistantMessage.timestamp),
            status: 'sent'
          }];
        });
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message
      setMessages(prev => [...prev, {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        content: "I'm having trouble connecting right now. Please try again.",
        timestamp: new Date(),
        status: 'sent'
      }]);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <Head>
        <title>Mini Hafsa - Chat</title>
        <meta name="description" content="Chat with your personal AI assistant" />
      </Head>

      <div className="container mx-auto px-4 py-8 h-[calc(100vh-8rem)] flex flex-col">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-600">
            Mini Hafsa
          </h1>
          <p className="text-gray-600">Your personal AI assistant</p>
        </div>

        <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-3xl ${message.sender === 'user'
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-br-none'
                    : 'bg-white border border-pink-100 rounded-tl-none'
                    }`}
                >
                  <div className="text-sm">{message.content}</div>
                  <div className={`text-xs mt-2 ${message.sender === 'user' ? 'text-pink-100' : 'text-gray-500'}`}>
                    {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-pink-100 p-4 rounded-3xl rounded-tl-none">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce delay-75"></div>
                    <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce delay-150"></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="border-t border-pink-100 p-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your message here..."
                className="flex-1 bg-white border border-pink-200 rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
                disabled={isLoading}
              />
              <button
                type="submit"
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full px-6 py-3 font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                disabled={isLoading || !inputValue.trim()}
              >
                Send
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Mini Hafsa can help with tasks, emails, calendar, reminders, and more
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}