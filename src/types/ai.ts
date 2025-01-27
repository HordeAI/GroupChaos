export interface AIAgent {
  id: string;
  name: string;
  role: string;
  specialization: string;
  personality: string;
  username: string;
  status: 'idle' | 'busy';
  currentUser?: string;
}

export interface QueueEntry {
  userId: string;
  timestamp: number;
  priority: number;
  requestType: string;
  agentPreference?: string;
}

export interface AIResponse {
  agentId: string;
  userId: string;
  message: string;
  timestamp: number;
  username?: string;
  context?: {
    originalMessage?: string;
    refinedPrompt?: string;
    usedService?: 'deepseek' | 'openai';
    agentName?: string;
    error?: string;
  };
}

export interface AISwarmConfig {
  maxConcurrentChats: number;
  queueTimeout: number;
  defaultPriority: number;
  maxQueueSize: number;
} 