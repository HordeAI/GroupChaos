import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Constants
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

// Helper functions
const generateUsername = () => `User${Math.floor(Math.random() * 1000)}`;
const generateRandomColor = () => `#${Math.floor(Math.random() * 16777215).toString(16)}`;

interface Message {
  username: string;
  text: string;
  timestamp: number;
  userColor?: string;
  isAI?: boolean;
}

export default function Page() {
  const [socketId, setSocketId] = useState('');
  const [username, setUsername] = useState('');
  const [userColor, setUserColor] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      console.log('Connected to server');
      setSocketId(socket.id || '');
      
      // Generate a random username and color for the user
      const username = generateUsername();
      const color = generateRandomColor();
      
      setUsername(username);
      setUserColor(color);
      
      socket.emit('user:join', { username, color });
    });

    socket.on('chat:message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('system:message', (message: Message) => {
      setMessages((prev) => [...prev, { ...message, userColor: '#FF0000' }]);
    });

    socket.on('ai:response', (response) => {
      const aiMessage: Message = {
        username: response.username || 'AI',
        text: response.message,
        timestamp: response.timestamp,
        userColor: '#00FF00',
        isAI: true
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    });

    socket.on('ai:error', (error) => {
      const errorMessage: Message = {
        username: 'System',
        text: error.message,
        timestamp: Date.now(),
        userColor: '#FF0000'
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
    });

    socket.on('ai:queued', (data) => {
      const queueMessage: Message = {
        username: 'System',
        text: `You are in position ${data.position} in the queue. Please wait...`,
        timestamp: Date.now(),
        userColor: '#FF8800'
      };
      setMessages((prev) => [...prev, queueMessage]);
    });

    setSocket(socket);

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !input.trim()) return;

    const trimmedInput = input.trim();

    // Handle AI command
    if (trimmedInput.startsWith('/ai ')) {
      const aiMessage = trimmedInput.slice(4);
      setIsLoading(true);
      socket.emit('ai:message', {
        text: aiMessage,
        userId: socketId,
      });
    } else {
      // Regular chat message
      socket.emit('user:message', {
        text: trimmedInput,
        username,
        color: userColor,
      });
    }

    setInput('');
  };

  return (
    <div className="flex flex-col h-screen bg-black text-green-400 font-mono p-4">
      <div className="flex-1 overflow-y-auto mb-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-2 ${msg.isAI ? 'pl-4 border-l-2 border-green-500' : ''}`}
          >
            <span
              className="font-bold"
              style={{ color: msg.userColor || '#00FF00' }}
            >
              {msg.username}:
            </span>{' '}
            <span className="whitespace-pre-wrap">{msg.text}</span>
          </div>
        ))}
        {isLoading && (
          <div className="mb-2">
            <span className="text-yellow-400">AI is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-black border border-green-400 text-green-400 p-2 focus:outline-none focus:border-green-600"
          placeholder="Type a message... (use /ai for AI chat)"
        />
        <button
          type="submit"
          className="bg-green-600 text-black px-4 py-2 hover:bg-green-500"
          disabled={!socket || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
} 