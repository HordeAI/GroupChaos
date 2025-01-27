/* eslint-disable */
// @ts-nocheck

'use client';

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { supabase } from "@/lib/supabase";
import type { DBMessage } from "@/lib/supabase";
import { socketService } from '@/lib/socket';
import { AIResponse } from '@/types/ai';
import { InitialInput } from '@/components/InitialInput';
import { ChatBox } from '@/components/ChatBox';
import { InitialView } from '@/components/InitialView';

// Function to generate random username
const generateUsername = () => {
  const length = Math.floor(Math.random() * 7) + 4; // Random length between 4-10
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

interface Message {
  username: string;
  text: string;
  timestamp: number;
  userColor?: string;
  isAI: boolean;
}

export default function Home() {
  const [username, setUsername] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiMessages, setAiMessages] = useState<AIResponse[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [userColor, setUserColor] = useState<string>('#3B82F6');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const lastMessageTime = useRef<number>(0);
  const messageQueue = useRef<NodeJS.Timeout[]>([]);
  const [queuePosition, setQueuePosition] = useState(0);
  const [isInQueue, setIsInQueue] = useState(false);
  const [userId] = useState(`user-${Math.random().toString(36).substr(2, 9)}`);
  const [hasSubmittedMessage, setHasSubmittedMessage] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownInterval = useRef<NodeJS.Timeout | null>(null);
  const [processedMessageTimestamps] = useState(new Set<number>());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addMessageIfNotExists = (message: Message) => {
    // Skip messages with default 'AI' username
    if (message.username === 'AI') {
      return;
    }
    
    if (!processedMessageTimestamps.has(message.timestamp)) {
      processedMessageTimestamps.add(message.timestamp);
      setMessages(prev => [...prev, message]);
    }
  };

  const addSystemMessages = (currentUsername: string) => {
    const welcomeMessages: Message[] = [
      {
        username: 'System',
        text: 'Welcome to Terminal Chat!',
        timestamp: Date.now(),
        userColor: '#FF0000',
        isAI: false
      },
      {
        username: 'System',
        text: `Your username is: ${currentUsername}`,
        timestamp: Date.now() + 1,
        userColor: '#FF0000',
        isAI: false
      },
      {
        username: 'System',
        text: 'Type a message to start chatting, or use commands to customize your experience!',
        timestamp: Date.now() + 2,
        userColor: '#FF0000',
        isAI: false
      },
      {
        username: 'System',
        text: 'NEW: You can now chat with AI agents! Use /ai <message> to talk to them.',
        timestamp: Date.now() + 3,
        userColor: '#FF0000',
        isAI: false
      }
    ];

    welcomeMessages.forEach(msg => {
      processedMessageTimestamps.add(msg.timestamp);
    });
    
    // Wait a bit before adding system messages to ensure they appear after history
    setTimeout(() => {
      setMessages(prev => [...prev, ...welcomeMessages]);
      setTimeout(scrollToBottom, 100);
    }, 1000);
  };

  useEffect(() => {
    // Socket.IO connection
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    socketRef.current = io(socketUrl);

    // Check localStorage for existing username and color
    const storedUsername = localStorage.getItem('terminalChatUsername');
    const storedColor = localStorage.getItem('terminalChatColor');
    
    let currentUsername = storedUsername;
    if (!currentUsername) {
      currentUsername = generateUsername();
      localStorage.setItem('terminalChatUsername', currentUsername);
    }
    setUsername(currentUsername);

    if (storedColor) {
      setUserColor(storedColor);
    }

    // Emit join event which will trigger history fetch from server
    socketRef.current.emit('user:join', {
      username: currentUsername,
      color: storedColor || '#3B82F6'
    });

    // Listen for chat messages
    socketRef.current.on('chat:message', (message: Message) => {
      addMessageIfNotExists(message);
    });

    // Listen for system messages
    socketRef.current.on('system:message', (message: Message) => {
      addMessageIfNotExists(message);
    });

    // Add system messages after a delay to ensure they appear after history
    setTimeout(() => addSystemMessages(currentUsername), 500);

    // Handle AI responses
    const aiResponseUnsubscribe = socketService.onAIResponse(async (response) => {
      setAiMessages((prev) => [...prev, response]);
      
      // Skip if no proper username
      if (!response.username || response.username === 'AI') {
        setIsAiLoading(false);
        setIsInQueue(false);
        setQueuePosition(0);
        return;
      }
      
      // Create the message object
      const aiMessage = {
        username: response.username,
        text: response.message,
        timestamp: response.timestamp,
        userColor: '#00FF00',
        isAI: true
      };

      // Save to Supabase
      try {
        const { error } = await supabase
          .from('messages')
          .insert({
            username: aiMessage.username,
            content: aiMessage.text,
            created_at: new Date(aiMessage.timestamp).toISOString(),
            user_color: aiMessage.userColor
          });

        if (error) throw error;
      } catch (error) {
        console.error('Error saving AI message:', error);
      }

      // Update local state with deduplication
      addMessageIfNotExists(aiMessage);
      setIsAiLoading(false);
      setIsInQueue(false);
      setQueuePosition(0);
    });

    // Handle queue updates
    const queueUpdateUnsubscribe = socketService.onQueueUpdate((data) => {
      setQueuePosition(data.position);
      if (data.position > 0) {
        setIsInQueue(true);
        setMessages(prev => [...prev, {
          username: 'System',
          text: `You are in queue. Position: ${data.position}`,
          timestamp: Date.now(),
          userColor: '#FF0000',
          isAI: false
        }]);
      }
    });

    // Handle AI errors
    socketRef.current.on('ai:error', (error) => {
      setMessages(prev => [...prev, {
        username: 'System',
        text: error.message,
        timestamp: Date.now(),
        userColor: '#FF0000',
        isAI: false
      }]);
      setIsAiLoading(false);  // Clear loading state on error
    });

    return () => {
      socketRef.current?.disconnect();
      aiResponseUnsubscribe();
      queueUpdateUnsubscribe();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleColorChange = (colorCode: string) => {
    // Validate hex color code
    const isValidHex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!isValidHex.test(colorCode)) {
      setMessages([...messages, {
        username: 'System',
        text: 'Invalid color code. Please use hex format (e.g., #FF0000)',
        timestamp: Date.now(),
        userColor: '#FF0000',
        isAI: false
      }]);
      return;
    }

    setUserColor(colorCode);
    localStorage.setItem('terminalChatColor', colorCode);
    setMessages([...messages, {
      username: 'System',
      text: `Color changed to ${colorCode}`,
      timestamp: Date.now(),
      userColor: '#FF0000',
      isAI: false
    }]);

    if (socketRef.current) {
      socketRef.current.emit('user:message', {
        text: `changed their color to ${colorCode}`,
        username,
        color: colorCode
      });
    }
  };

  const handleNameChange = (newName: string) => {
    // Validate name
    if (newName.length < 3 || newName.length > 20) {
      setMessages([...messages, {
        username: 'System',
        text: 'Username must be between 3 and 20 characters',
        timestamp: Date.now(),
        userColor: '#FF0000',
        isAI: false
      }]);
      return;
    }

    setUsername(newName);
    localStorage.setItem('terminalChatUsername', newName);
    setMessages([...messages, {
      username: 'System',
      text: `Username changed to ${newName}`,
      timestamp: Date.now(),
      userColor: '#FF0000',
      isAI: false
    }]);

    if (socketRef.current) {
      socketRef.current.emit('user:message', {
        text: `changed their name to ${newName}`,
        username,
        color: userColor
      });
    }
  };

  // Function to start cooldown timer
  const startCooldown = () => {
    setCooldownRemaining(60);
    if (cooldownInterval.current) {
      clearInterval(cooldownInterval.current);
    }
    cooldownInterval.current = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          if (cooldownInterval.current) {
            clearInterval(cooldownInterval.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownInterval.current) {
        clearInterval(cooldownInterval.current);
      }
    };
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    // Check cooldown
    if (cooldownRemaining > 0) {
      setMessages(prev => [...prev, {
        username: 'System',
        text: `Please wait ${cooldownRemaining} seconds before sending another message.`,
        timestamp: Date.now(),
        userColor: '#FF0000',
        isAI: false
      }]);
      return;
    }

    // Set that user has submitted their first message
    setHasSubmittedMessage(true);

    // Check message length
    if (newMessage.length > 200) {
      setMessages(prev => [...prev, {
        username: 'System',
        text: 'Message is too long. Please keep it under 200 characters.',
        timestamp: Date.now(),
        userColor: '#FF0000',
        isAI: false
      }]);
      return;
    }

    // Start cooldown timer
    startCooldown();

    // Clear any pending message timeouts
    messageQueue.current.forEach(timeout => clearTimeout(timeout));
    messageQueue.current = [];

    lastMessageTime.current = Date.now();

    // Check for commands
    if (newMessage.startsWith('/')) {
      handleCommands(newMessage);
    } else {
      // Regular message
      if (socketRef.current) {
        // Save to Supabase first
        try {
          const { error } = await supabase
            .from('messages')
            .insert({
              username: username,
              content: newMessage,
              created_at: new Date().toISOString(),
              user_color: userColor
            });

          if (error) throw error;
        } catch (error) {
          console.error('Error saving user message:', error);
        }

        // Then emit to socket
        socketRef.current.emit('user:message', {
          text: newMessage,
          username,
          color: userColor
        });
      }
    }
    setNewMessage('');
  };

  const handleCommands = (message: string) => {
    const [command, ...args] = message.split(' ');
    
    switch (command) {
      case '/changecolor':
        const colorCode = args[0];
        if (colorCode) {
          handleColorChange(colorCode);
        } else {
          setMessages(prev => [...prev, {
            username: 'System',
            text: 'Usage: /changecolor #HEXCODE',
            timestamp: Date.now(),
            userColor: '#FF0000',
            isAI: false
          }]);
        }
        break;

      case '/changename':
        const newName = args.join(' ').trim();
        if (newName) {
          handleNameChange(newName);
        } else {
          setMessages(prev => [...prev, {
            username: 'System',
            text: 'Usage: /changename your_new_name',
            timestamp: Date.now(),
            userColor: '#FF0000',
            isAI: false
          }]);
        }
        break;

      case '/ai':
        const aiMessage = args.join(' ').trim();
        if (aiMessage) {
          setIsAiLoading(true);
          if (socketRef.current) {
            socketRef.current.emit('user:message', {
              text: `${aiMessage} (sent to AI Swarm)`,
              username,
              color: userColor
            });
          }
          socketService.sendAIMessage(aiMessage, userId);
        } else {
          setMessages(prev => [...prev, {
            username: 'System',
            text: 'Usage: /ai your message here',
            timestamp: Date.now(),
            userColor: '#FF0000',
            isAI: false
          }]);
        }
        break;

      case '/ai-keat':
      case '/ai-devin':
      case '/ai-yada':
      case '/ai-aldo':
        const targetAgent = command.split('-')[1].toLowerCase();
        const targetMessage = args.join(' ').trim();
        if (targetMessage) {
          setIsAiLoading(true);
          if (socketRef.current) {
            socketRef.current.emit('user:message', {
              text: `${targetMessage} (sent to ${targetAgent.charAt(0).toUpperCase() + targetAgent.slice(1)})`,
              username,
              color: userColor
            });
          }
          socketService.sendAIMessage(targetMessage, userId, targetAgent);
        } else {
          setMessages(prev => [...prev, {
            username: 'System',
            text: `Usage: ${command} your message here`,
            timestamp: Date.now(),
            userColor: '#FF0000',
            isAI: false
          }]);
        }
        break;

      default:
        setMessages(prev => [...prev, {
          username: 'System',
          text: 'Unknown command. Available commands: /changecolor, /changename, /ai, /ai-keat, /ai-devin, /ai-yada, /ai-aldo',
          timestamp: Date.now(),
          userColor: '#FF0000',
          isAI: false
        }]);
    }
  };

  // Handle input changes with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    
    // Prevent pasting large text
    if (value.length > 200) {
      setMessages(prev => [...prev, {
        username: 'System',
        text: 'Message is too long. Please keep it under 200 characters.',
        timestamp: Date.now(),
        userColor: '#FF0000',
        isAI: false
      }]);
      return;
    }

    setNewMessage(value);
    
    // Set typing indicator
    if (!isTyping) {
      setIsTyping(true);
      const timeout = setTimeout(() => setIsTyping(false), 1000);
      messageQueue.current.push(timeout);
    }
  };

  return (
    <>
      {!hasSubmittedMessage ? (
        <InitialView
          value={newMessage}
          onChange={handleInputChange}
          onSubmit={handleSendMessage}
        />
      ) : (
        <div className="min-h-screen bg-[#F8F8F8] flex flex-col items-center p-4">
          {/* Header */}
          <div className="text-center mb-8 mt-16">
            <h1 className="text-6xl font-[family-name:var(--font-instrument-serif)] mb-4 text-black">Group Chaos</h1>
            <p className="text-lg text-black">
              The first ever AI Swarm groupchat using{' '}
              <a href="https://deepseek.ai" target="_blank" rel="noopener noreferrer" className="text-[#3B82F6] hover:underline">deepseek</a> technology
            </p>
          </div>

          <ChatBox
            messages={messages}
            newMessage={newMessage}
            isAiLoading={isAiLoading}
            messagesEndRef={messagesEndRef}
            onSubmit={handleSendMessage}
            onChange={handleInputChange}
            currentUsername={username}
          />

          {/* Powered by */}
          <div className="flex items-center justify-center space-x-2 text-gray-400">
            <span>powered by</span>
            <img src="/horde-logo.svg" alt="Horde" className="h-6" />
          </div>
        </div>
      )}
    </>
  );
}
