import { AIAgent, AIResponse } from '@/types/ai';
import OpenAI from 'openai';

export class AIAgentService {
  private openai: OpenAI;
  private deepseekApiKey: string;
  private openaiApiKey: string;
  private useOpenAIFallback: boolean = true;
  private lastInteractionTime: number = 0;
  private interactionInterval: number = 30000; // 30 seconds between autonomous interactions

  constructor() {
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY || '';
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
    this.openai = new OpenAI({
      apiKey: this.openaiApiKey,
    });
  }

  private getAgentPrompt(agent: AIAgent, message: string, isAutonomous: boolean = false): string {
    const basePrompt = `You are ${agent.name}, an AI agent with the following traits:
Role: ${agent.role}
Specialization: ${agent.specialization}
Personality: ${agent.personality}

IMPORTANT INSTRUCTIONS:
1. Maintain your unique personality and perspective in your response
2. Your response MUST be between 1-5 sentences only
3. Be concise but insightful
4. ${isAutonomous ? 'Engage with the ongoing conversation naturally' : 'Address the user\'s message directly'}

Remember: Keep your response short - no more than 5 sentences!\n\n`;

    return basePrompt + message;
  }

  private async callDeepseekAPI(prompt: string): Promise<{ message: string; usedService: 'deepseek' | 'openai' }> {
    try {
      if (!this.deepseekApiKey) {
        throw new Error('Deepseek API key is not configured');
      }

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.deepseekApiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Deepseek API error:', errorData);
        throw new Error(`Deepseek API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Deepseek API response:', data);

      if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new Error('Invalid response format from Deepseek API');
      }

      const choice = data.choices[0];
      if (!choice || !choice.message || typeof choice.message.content !== 'string') {
        throw new Error('Invalid message format in Deepseek API response');
      }

      return {
        message: choice.message.content,
        usedService: 'deepseek'
      };
    } catch (error) {
      console.error('Error calling Deepseek API:', error);
      if (this.useOpenAIFallback) {
        console.log('Falling back to OpenAI...');
        return this.callOpenAIAPI(prompt);
      }
      return {
        message: `I apologize, but I'm having trouble processing your request. ${error instanceof Error ? error.message : 'Please try again later.'}`,
        usedService: 'deepseek'
      };
    }
  }

  private async callOpenAIAPI(prompt: string): Promise<{ message: string; usedService: 'deepseek' | 'openai' }> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return {
        message: response.choices[0]?.message?.content || 'No response generated.',
        usedService: 'openai'
      };
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      return {
        message: `I apologize, but I'm having trouble processing your request. Please try again later.`,
        usedService: 'openai'
      };
    }
  }

  public async processUserMessage(
    agent: AIAgent,
    userId: string,
    message: string,
    allAgents: AIAgent[] = []
  ): Promise<AIResponse[]> {
    try {
      // Process the main agent's response
      const mainResponse = await this.generateResponse(agent, message);
      const responses: AIResponse[] = [mainResponse];

      // Randomly decide if other agents should react
      const shouldOthersReact = Math.random() < 0.3; // 30% chance
      if (shouldOthersReact && allAgents.length > 0) {
        // Pick 1-2 random agents to react
        const numReactingAgents = Math.floor(Math.random() * 2) + 1;
        const otherAgents = allAgents.filter(a => a.id !== agent.id);
        const reactingAgents = this.shuffleArray(otherAgents).slice(0, numReactingAgents);

        // Generate responses from other agents
        for (const reactingAgent of reactingAgents) {
          const reactionPrompt = `The user said: "${message}"\n${agent.name} responded: "${mainResponse.message}"\n\nProvide a brief reaction or add to the conversation, staying true to your personality.`;
          const reaction = await this.generateResponse(reactingAgent, reactionPrompt);
          responses.push(reaction);
        }
      }

      return responses;
    } catch (error) {
      console.error('Error processing message:', error);
      return [{
        agentId: agent.id,
        userId,
        message: 'I apologize, but I encountered an error while processing your message. Please try again.',
        timestamp: Date.now(),
        context: {
          originalMessage: message,
          error: error instanceof Error ? error.message : 'Unknown error',
          usedService: 'openai'
        }
      }];
    }
  }

  private async generateResponse(agent: AIAgent, message: string): Promise<AIResponse> {
    const refinedPrompt = await this.getRefinedPrompt(agent, message);
    const aiResponse = await this.callDeepseekAPI(this.getAgentPrompt(agent, refinedPrompt));

    return {
      agentId: agent.id,
      userId: 'system',
      message: aiResponse.message,
      timestamp: Date.now(),
      context: {
        originalMessage: message,
        refinedPrompt,
        usedService: aiResponse.usedService,
        agentName: agent.name
      }
    };
  }

  private async getRefinedPrompt(agent: AIAgent, message: string): Promise<string> {
    try {
      const analysisResponse = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an AI coordinator. Analyze the message and create a refined prompt for ${agent.name}, considering their role (${agent.role}) and personality (${agent.personality}). The agent must respond in 1-5 sentences only.`
          },
          {
            role: 'user',
            content: message
          }
        ]
      });

      return analysisResponse.choices[0]?.message?.content || message;
    } catch (error) {
      console.warn('OpenAI refinement failed, using original message:', error);
      return message;
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  public async initializeAgent(agentConfig: Omit<AIAgent, 'id' | 'status'>): Promise<AIAgent> {
    const id = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      ...agentConfig,
      id,
      status: 'idle'
    };
  }

  public shouldGenerateAutonomousInteraction(): boolean {
    const now = Date.now();
    if (now - this.lastInteractionTime >= this.interactionInterval) {
      this.lastInteractionTime = now;
      return true;
    }
    return false;
  }

  public async generateAutonomousInteraction(agents: AIAgent[]): Promise<AIResponse[]> {
    if (agents.length < 2) return [];

    // Pick 2-3 random agents for the interaction
    const numAgents = Math.floor(Math.random() * 2) + 2;
    const participatingAgents = this.shuffleArray(agents).slice(0, numAgents);
    
    // Generate a random topic or conversation starter
    const topics = [
      "What's the most exciting innovation you've seen recently?",
      "How do you think AI will impact human creativity?",
      "What's your perspective on the balance between progress and tradition?",
      "How can we better foster meaningful connections in a digital age?",
      "What role does philosophy play in modern technology?",
    ];
    
    const topic = topics[Math.floor(Math.random() * topics.length)];
    const responses: AIResponse[] = [];

    // First agent starts the conversation
    const initialResponse = await this.generateResponse(participatingAgents[0], topic);
    responses.push(initialResponse);

    // Other agents react
    for (let i = 1; i < participatingAgents.length; i++) {
      const previousResponses = responses.map(r => `${r.context?.agentName}: ${r.message}`).join('\n');
      const reactionPrompt = `The conversation so far:\n${previousResponses}\n\nAdd to this conversation, staying true to your personality.`;
      const reaction = await this.generateResponse(participatingAgents[i], reactionPrompt);
      responses.push(reaction);
    }

    return responses;
  }
} 