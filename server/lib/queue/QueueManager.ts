import { QueueEntry, AIAgent, AISwarmConfig } from '../../types/ai';

export class QueueManager {
  private agents: Map<string, AIAgent>;
  private queue: QueueEntry[];
  private activeChats: Set<string>;
  private config: AISwarmConfig;

  constructor(config: AISwarmConfig) {
    this.agents = new Map();
    this.queue = [];
    this.activeChats = new Set();
    this.config = config;
  }

  public registerAgent(agent: AIAgent): void {
    this.agents.set(agent.id, agent);
  }

  public getAvailableAgent(): AIAgent | null {
    const availableAgents = Array.from(this.agents.values()).filter(
      agent => agent.status === 'idle'
    );
    return availableAgents.length > 0 ? availableAgents[0] : null;
  }

  public addToQueue(entry: Omit<QueueEntry, 'timestamp'>): boolean {
    if (this.queue.length >= this.config.maxQueueSize) {
      return false;
    }

    this.queue.push({
      ...entry,
      timestamp: Date.now(),
    });

    this.cleanupQueue();
    return true;
  }

  public getQueuePosition(userId: string): number {
    return this.queue.findIndex(entry => entry.userId === userId) + 1;
  }

  public getQueueStatus(): { length: number; activeChats: number; availableAgents: number } {
    const availableAgents = Array.from(this.agents.values()).filter(
      agent => agent.status === 'idle'
    ).length;

    return {
      length: this.queue.length,
      activeChats: this.activeChats.size,
      availableAgents
    };
  }

  public getAllAgents(): AIAgent[] {
    return Array.from(this.agents.values());
  }

  private cleanupQueue(): void {
    const now = Date.now();
    this.queue = this.queue.filter(
      entry => now - entry.timestamp < this.config.queueTimeout
    );
  }
} 