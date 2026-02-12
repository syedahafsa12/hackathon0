import axios from 'axios';
import { ChatMessage, ApiResponse } from '../../../shared/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken'); // or however you store the token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const chatApi = {
  async sendMessage(content: string, parentId?: string): Promise<ApiResponse<ChatMessage>> {
    try {
      const response = await api.post('/chat/send', { content, parentId });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.error?.code || 'NETWORK_ERROR',
          message: error.response?.data?.error?.message || error.message || 'Failed to send message',
        },
        timestamp: new Date().toISOString(),
      };
    }
  },

  async getChatHistory(limit?: number, before?: string, after?: string): Promise<ApiResponse<{ messages: ChatMessage[], hasMore: boolean }>> {
    try {
      const params: any = {};
      if (limit) params.limit = limit;
      if (before) params.before = before;
      if (after) params.after = after;

      const response = await api.get('/chat/history', { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.error?.code || 'NETWORK_ERROR',
          message: error.response?.data?.error?.message || error.message || 'Failed to get chat history',
        },
        timestamp: new Date().toISOString(),
      };
    }
  },

  async updateMessageStatus(messageId: string, status: 'sent' | 'delivered' | 'read'): Promise<ApiResponse<ChatMessage>> {
    try {
      const response = await api.post(`/chat/message/${messageId}/status`, { status });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.error?.code || 'NETWORK_ERROR',
          message: error.response?.data?.error?.message || error.message || 'Failed to update message status',
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
};

export default chatApi;