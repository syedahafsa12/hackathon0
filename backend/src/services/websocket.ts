import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

class WebSocketService {
  private io: Server | null = null;
  private static instance: WebSocketService;

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  initialize(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? process.env.FRONTEND_URL
          : ['http://localhost:3000', 'http://127.0.0.1:3000'],
        credentials: true
      }
    });

    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });

      // Join user to their personal room
      socket.on('join', (data: { userId: string }) => {
        const room = `user_${data.userId}`;
        socket.join(room);
        console.log(`User ${data.userId} joined room ${room}`);
      });

      // Listen for chat messages
      socket.on('chat_message', (data) => {
        // Broadcast the message to all other users
        socket.broadcast.emit('new_message', data);
      });

      // Listen for typing indicators
      socket.on('typing_start', (data) => {
        socket.broadcast.emit('user_typing', { userId: data.userId, isTyping: true });
      });

      socket.on('typing_stop', (data) => {
        socket.broadcast.emit('user_typing', { userId: data.userId, isTyping: false });
      });
    });
  }

  emitToRoom(room: string, event: string, data: any) {
    if (this.io) {
      this.io.to(room).emit(event, data);
    }
  }

  emitToUser(userId: string, event: string, data: any) {
    if (this.io) {
      // Join user to their personal room
      this.io.to(`user_${userId}`).emit(event, data);
    }
  }

  getIO(): Server | null {
    return this.io;
  }
}

export default WebSocketService.getInstance();