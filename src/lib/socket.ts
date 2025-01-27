/* eslint-disable */
// @ts-nocheck

import { io, Socket } from 'socket.io-client';
import { AIResponse } from '@/types/ai';

interface ServerToClientEvents {
  'chat:message': (message: any) => void;
  'system:message': (message: any) => void;
  'ai:response': (response: AIResponse) => void;
  'ai:error': (error: { message: string }) => void;
  'ai:queued': (data: { position: number }) => void;
  'queue:update': (data: { length: number; activeChats: number; availableAgents: number; position: number }) => void;
}

interface ClientToServerEvents {
  'user:join': (data: { username: string; color: string }) => void;
  'user:message': (data: { text: string; username: string; color: string }) => void;
  'ai:message': (data: { text: string; userId: string; targetAgent?: string }) => void;
  'queue:status': (data: { userId: string }) => void;
}

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private messageHandlers: ((message: any) => void)[] = [];
  private aiResponseHandlers: ((response: AIResponse) => void)[] = [];
  private queueUpdateHandlers: ((data: { position: number }) => void)[] = [];

  constructor() {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    console.log('Connecting to socket URL:', socketUrl);
    
    this.socket = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected successfully');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('chat:message', (message) => {
      console.log('Received chat message:', message);
      this.messageHandlers.forEach((handler) => handler(message));
    });

    this.socket.on('system:message', (message) => {
      console.log('Received system message:', message);
      this.messageHandlers.forEach((handler) => handler(message));
    });

    this.socket.on('ai:response', (response) => {
      console.log('Received AI response:', response);
      this.aiResponseHandlers.forEach((handler) => handler(response));
    });

    this.socket.on('ai:queued', (data) => {
      console.log('Received queue update:', data);
      this.queueUpdateHandlers.forEach((handler) => handler(data));
    });

    this.socket.on('ai:error', (error) => {
      console.error('Received AI error:', error);
    });
  }

  public joinChat(username: string, color: string) {
    console.log('Joining chat as:', username);
    this.socket?.emit('user:join', { username, color });
  }

  public sendMessage(text: string, username: string, color: string) {
    console.log('Sending chat message:', text);
    this.socket?.emit('user:message', { text, username, color });
  }

  public sendAIMessage(text: string, userId: string, targetAgent?: string) {
    console.log('Sending AI message:', { text, userId, targetAgent });
    this.socket?.emit('ai:message', { text, userId, targetAgent });
  }

  public requestQueueStatus(userId: string) {
    console.log('Requesting queue status for:', userId);
    this.socket?.emit('queue:status', { userId });
  }

  public onMessage(handler: (message: any) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  public onAIResponse(handler: (response: AIResponse) => void) {
    this.aiResponseHandlers.push(handler);
    return () => {
      this.aiResponseHandlers = this.aiResponseHandlers.filter((h) => h !== handler);
    };
  }

  public onQueueUpdate(handler: (data: { position: number }) => void) {
    this.queueUpdateHandlers.push(handler);
    return () => {
      this.queueUpdateHandlers = this.queueUpdateHandlers.filter((h) => h !== handler);
    };
  }

  public disconnect() {
    console.log('Disconnecting socket');
    this.socket?.disconnect();
  }
}

export const socketService = new SocketService(); 