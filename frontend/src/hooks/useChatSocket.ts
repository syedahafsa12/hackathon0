import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChatMessage } from '../../../shared/types';

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080';

interface UseChatSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  messages: ChatMessage[];
  sendMessage: (message: string) => void;
}

export const useChatSocket = (userId: string): UseChatSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    // Create socket connection
    const newSocket = io(WEBSOCKET_URL, {
      transports: ['websocket'],
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to chat socket');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from chat socket');
    });

    // Listen for new messages
    newSocket.on('new_message', (data: ChatMessage) => {
      setMessages(prev => [...prev, data]);
    });

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);

  const sendMessage = (content: string) => {
    if (socket && isConnected) {
      socket.emit('chat_message', {
        userId,
        content,
        timestamp: new Date().toISOString()
      });
    }
  };

  return {
    socket,
    isConnected,
    messages,
    sendMessage
  };
};