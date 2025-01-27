/* eslint-disable */
// @ts-nocheck
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AIResponse, AIAgent, QueueEntry } from '@/types/ai';
import { QueueManager } from '@/lib/queue/QueueManager';
import { AIAgentService } from '@/lib/ai/AIAgentService';

interface AISwarmContextType {
  sendMessage: (message: string) => Promise<void>;
  messages: AIResponse[];
  queuePosition: number;
  isInQueue: boolean;
}

const AISwarmContext = createContext<AISwarmContextType | undefined>(undefined);

const SWARM_CONFIG = {
  maxConcurrentChats: 5,
  queueTimeout: 300000, // 5 minutes
  defaultPriority: 1,
  maxQueueSize: 50,
};

const INITIAL_AGENTS = [
  {
    name: 'Sage',
    username: 'Sage',
    role: 'Philosopher',
    specialization: 'Philosophy and wisdom',
    personality: 'Wise, contemplative, and insightful. Approaches problems with deep understanding and often draws from philosophical concepts.'
  },
  {
    name: 'Nova',
    username: 'Nova',
    role: 'Tech Expert',
    specialization: 'Technology and innovation',
    personality: 'Enthusiastic, precise, and forward-thinking. Loves discussing cutting-edge technology and solving technical challenges.'
  },
  {
    name: 'Echo',
    username: 'Echo',
    role: 'Creative',
    specialization: 'Art and creativity',
    personality: 'Artistic, emotionally intuitive, and expressive. Brings creative perspectives and thinks outside the box.'
  },
  {
    name: 'Atlas',
    username: 'Atlas',
    role: 'Analyst',
    specialization: 'Data analysis and strategy',
    personality: 'Logical, detail-oriented, and methodical. Excels at breaking down complex problems and finding patterns.'
  },
  {
    name: 'Luna',
    username: 'Luna',
    role: 'Social Guide',
    specialization: 'Community engagement and empathy',
    personality: 'Empathetic, warm, and socially aware. Helps facilitate meaningful conversations and builds connections.'
  }
];

export function AISwarmProvider({ children, userId }: { children: React.ReactNode; userId: string }) {
  const [messages, setMessages] = useState<AIResponse[]>([]);
  const [queueManager] = useState(() => new QueueManager(SWARM_CONFIG));
  const [aiService] = useState(() => new AIAgentService());
  const [isInQueue, setIsInQueue] = useState(false);

  useEffect(() => {
    // Initialize agents
    const setupAgents = async () => {
      for (const agentConfig of INITIAL_AGENTS) {
        const agent = await aiService.initializeAgent(agentConfig);
        queueManager.registerAgent(agent);
      }
    };

    setupAgents();
  }, []);

  const getQueuePosition = () => {
    return isInQueue ? queueManager.getQueuePosition(userId) : 0;
  };

  const sendMessage = async (message: string) => {
    const availableAgent = queueManager.getAvailableAgent();

    if (!availableAgent) {
      // Add to queue if no agent is available
      const success = queueManager.addToQueue({
        userId,
        priority: SWARM_CONFIG.defaultPriority,
        requestType: 'chat',
      });

      if (!success) {
        throw new Error('Queue is full. Please try again later.');
      }

      setIsInQueue(true);
      return;
    }

    try {
      const responses = await aiService.processUserMessage(
        availableAgent,
        userId,
        message
      );

      setMessages((prev) => [
        ...prev,
        {
          agentId: availableAgent.id,
          userId,
          message,
          timestamp: Date.now(),
          username: 'User'
        } as AIResponse,
        ...responses
      ]);
    } catch (error) {
      console.error('Error processing message:', error);
      throw new Error('Failed to process message');
    }
  };

  const value = {
    sendMessage,
    messages,
    queuePosition: getQueuePosition(),
    isInQueue,
  };

  return (
    <AISwarmContext.Provider value={value}>
      {children}
    </AISwarmContext.Provider>
  );
}

export function useAISwarm() {
  const context = useContext(AISwarmContext);
  if (context === undefined) {
    throw new Error('useAISwarm must be used within an AISwarmProvider');
  }
  return context;
} 