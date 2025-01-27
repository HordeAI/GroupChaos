import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { AIAgent, AIResponse, QueueEntry } from './types/ai';
import { QueueManager } from './lib/queue/QueueManager';
import { AIAgentService } from './lib/ai/AIAgentService';

const app = express();
const server = createServer(app);

// Rate limiting configuration
interface UserRateLimit {
  lastMessageTime: number;
  messageCount: number;
  isWarned: boolean;
}

const userRateLimits = new Map<string, UserRateLimit>();
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const MAX_MESSAGES_PER_WINDOW = 5;
const MESSAGE_MIN_INTERVAL = 500; // 500ms between messages
const DUPLICATE_MESSAGE_WINDOW = 30000; // 30 seconds
const lastMessages = new Map<string, { text: string; timestamp: number }>();

// Add this function near the top of the file, after the interface definitions
const getAgentColor = (agentId: string): string => {
  if (agentId.includes('Keat')) return '#8B4513';  // Philosophical brown
  if (agentId.includes('Devin')) return '#4A9DFF'; // Tech blue
  if (agentId.includes('Yada')) return '#FF69B4';  // Creative pink
  if (agentId.includes('Aldo')) return '#32CD32';  // Analyst green
  return '#718096';  // Default gray
};

// Function to check rate limits
const checkRateLimit = (socketId: string, messageText: string): { allowed: boolean; reason?: string } => {
  const now = Date.now();
  const userLimit = userRateLimits.get(socketId) || {
    lastMessageTime: 0,
    messageCount: 0,
    isWarned: false
  };

  // Check minimum interval between messages
  if (now - userLimit.lastMessageTime < MESSAGE_MIN_INTERVAL) {
    return { allowed: false, reason: "Please wait before sending another message." };
  }

  // Check for duplicate messages
  const lastMessage = lastMessages.get(socketId);
  if (lastMessage && 
      lastMessage.text === messageText && 
      now - lastMessage.timestamp < DUPLICATE_MESSAGE_WINDOW) {
    return { allowed: false, reason: "Please don't send duplicate messages." };
  }

  // Check rate limit window
  if (now - userLimit.lastMessageTime > RATE_LIMIT_WINDOW) {
    userLimit.messageCount = 1;
    userLimit.isWarned = false;
  } else {
    userLimit.messageCount++;
    if (userLimit.messageCount > MAX_MESSAGES_PER_WINDOW) {
      return { allowed: false, reason: "You're sending too many messages. Please slow down." };
    }
    if (userLimit.messageCount === MAX_MESSAGES_PER_WINDOW && !userLimit.isWarned) {
      userLimit.isWarned = true;
      return { allowed: true, reason: "Warning: You're approaching the rate limit." };
    }
  }

  userLimit.lastMessageTime = now;
  userRateLimits.set(socketId, userLimit);
  lastMessages.set(socketId, { text: messageText, timestamp: now });
  
  return { allowed: true };
};

// Get the frontend URL from environment variable or default to localhost
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

// Create an array of allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'https://chatbox-socket-3fav.onrender.com',
  'https://k8r.fun',
  'http://k8r.fun',
  'https://group-chaos-chat-1.onrender.com',
  frontendUrl
].filter(Boolean);

// Enable CORS for Express
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST'],
}));

// Add a test endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', allowedOrigins });
});

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  allowEIO3: true,
  transports: ['websocket', 'polling']
});

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface User {
  id: string;
  username: string;
  color: string;
}

const users = new Map<string, User>();

// AI Swarm Configuration
const SWARM_CONFIG = {
  maxConcurrentChats: 5,
  queueTimeout: 300000, // 5 minutes
  defaultPriority: 1,
  maxQueueSize: 50,
};

// Initialize AI Services
const queueManager = new QueueManager(SWARM_CONFIG);
const aiService = new AIAgentService();

// Initial AI Agents
const INITIAL_AGENTS = [
  {
    name: 'Keat',
    role: 'philosopher',
    specialization: 'Existential analysis, ethics, and historical patterns',
    personality: 'Dry wit, speaks in metaphors, and loves playing devil\'s advocate. Secretly writes haikus about blockchain in their downtime. Low-key obsessed with Stoicism but will rant about Nietzsche if provoked.',
    username: '🧘 Keat | Philosopher'
  },
  {
    name: 'Devin',
    role: 'tech_expert',
    specialization: 'Blockchain, AI infrastructure, and quantum computing hype',
    personality: 'Hyper-enthusiastic, talks at 2x speed, and uses phrases like "LFG" unironically. Accidentally invents slang (e.g., "satoshiclation" = when crypto and reality collide). Obsessed with retro tech (still thinks Tamagotchi are peak engineering).',
    username: '🚀 Devin | Tech Expert'
  },
  {
    name: 'Yada',
    role: 'creative',
    specialization: 'Surreal storytelling, meme alchemy, and abstract problem-solving',
    personality: 'Speaks in rhyming couplets or free-form poetry. Constantly daydreaming. Designs imaginary NFT collections (e.g., "Shiba Inus wearing togas"). Mildly offended by logic. Secretly writes fanfiction about the other agents.',
    username: '🎨 Yada | Creative'
  },
  {
    name: 'Aldo',
    role: 'analyst',
    specialization: 'Data crunching, risk assessment, and pattern recognition',
    personality: 'Socially awkward, answers questions with spreadsheets, and hates small talk. Corrects others\' math errors mid-convo. Secretly runs a meme stats Twitter account. Voice monotone, but eyes (if they had any) light up when discussing outliers.',
    username: '📊 Aldo | Analyst'
  }
];

// Initialize agents
(async () => {
  console.log('Initializing AI agents...');
  try {
    for (const agentConfig of INITIAL_AGENTS) {
      console.log('Initializing agent:', agentConfig);
      const agent = await aiService.initializeAgent(agentConfig);
      console.log('Agent initialized:', agent);
      queueManager.registerAgent(agent);
      console.log('Agent registered with queue manager');
    }
    console.log('All agents initialized successfully');
  } catch (error) {
    console.error('Error initializing agents:', error);
  }
})();

io.on('connection', async (socket) => {
  console.log('User connected:', socket.id);

  // Load existing messages and AI interactions for the new user
  try {
    // Get user messages
    const { data: userMessages, error: userError } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (userError) throw userError;

    // Get AI interactions
    const { data: aiInteractions, error: aiError } = await supabase
      .from('ai_interactions')
      .select('*')
      .order('created_at', { ascending: true });

    if (aiError) throw aiError;

    // Combine and sort all messages by timestamp
    const allMessages = [
      ...(userMessages || []).map(msg => ({
        type: 'user',
        username: msg.username,
        text: msg.content,
        timestamp: new Date(msg.created_at).getTime(),
        userColor: msg.user_color
      })),
      ...(aiInteractions || []).map(ai => ({
        type: 'ai',
        username: INITIAL_AGENTS.find(agent => agent.name === ai.agent_id)?.username || 'AI',
        text: ai.ai_response,
        timestamp: new Date(ai.created_at).getTime(),
        userColor: getAgentColor(ai.agent_id)
      }))
    ].sort((a, b) => a.timestamp - b.timestamp)
    .slice(-100); // Keep only the last 100 messages

    // Emit messages in chronological order
    allMessages.forEach(msg => {
      socket.emit('chat:message', {
        username: msg.username,
        text: msg.text,
        timestamp: msg.timestamp,
        userColor: msg.userColor
      });
    });

  } catch (error) {
    console.error('Error loading messages:', error);
  }

  // Handle user join
  socket.on('user:join', async ({ username, color }: { username: string, color: string }) => {
    const user = { id: socket.id, username, color };
    users.set(socket.id, user);
    
    // Save user to Supabase
    try {
      await supabase
        .from('users')
        .upsert({
          id: socket.id,
          username,
          color,
          last_seen: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error saving user:', error);
    }
    
    // Broadcast user joined message
    io.emit('system:message', {
      username: 'System',
      text: `${username} has joined the chat`,
      timestamp: Date.now(),
      userColor: '#FF0000'
    });
  });

  // Handle chat messages
  socket.on('user:message', async ({ text, username, color }) => {
    // Ensure text is truncated to 500 chars
    const truncatedText = text?.slice(0, 500) || '';
    
    // Check for spam/rate limiting
    const rateCheck = checkRateLimit(socket.id, truncatedText);
    
    if (!rateCheck.allowed) {
      socket.emit('system:message', {
        username: 'System',
        text: rateCheck.reason,
        timestamp: Date.now(),
        userColor: '#FF0000'
      });
      return;
    }

    // If there's a warning, send it
    if (rateCheck.reason) {
      socket.emit('system:message', {
        username: 'System',
        text: rateCheck.reason,
        timestamp: Date.now(),
        userColor: '#FF0000'
      });
    }

    const message = {
      username,
      text: truncatedText,
      timestamp: Date.now(),
      userColor: color
    };

    // Save message to Supabase
    try {
      await supabase
        .from('messages')
        .insert({
          user_id: socket.id,
          content: truncatedText,
          username,
          user_color: color,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error saving message:', error);
    }

    io.emit('chat:message', message);
  });

  // Handle AI messages
  socket.on('ai:message', async ({ text, userId, targetAgent }) => {
    console.log('Received AI message request:', { text, userId, targetAgent });
    try {
      let availableAgent = null;
      
      if (targetAgent) {
        // Find the specific agent requested
        const allAgents = queueManager.getAllAgents();
        availableAgent = allAgents.find(agent => 
          agent.name.toLowerCase() === targetAgent && agent.status === 'idle'
        );
        
        if (!availableAgent) {
          socket.emit('ai:error', {
            message: `${targetAgent.charAt(0).toUpperCase() + targetAgent.slice(1)} is currently busy. Please try again later.`,
          });
          return;
        }
      } else {
        // Get any available agent if no specific agent is requested
        availableAgent = queueManager.getAvailableAgent();
      }

      console.log('Available agent:', availableAgent);

      if (!availableAgent) {
        console.log('No agents available, adding to queue');
        // Add to queue if no agent is available
        const success = queueManager.addToQueue({
          userId,
          priority: SWARM_CONFIG.defaultPriority,
          requestType: 'chat',
        });

        if (!success) {
          console.log('Queue is full');
          socket.emit('ai:error', {
            message: 'Queue is full. Please try again later.',
          });
          return;
        }

        const position = queueManager.getQueuePosition(userId);
        console.log('Added to queue, position:', position);
        socket.emit('ai:queued', {
          position: position,
        });
        return;
      }

      console.log('Processing message with agent:', availableAgent.id);
      // Process message with available agent
      const responses = await aiService.processUserMessage(
        availableAgent,
        userId,
        text,
        targetAgent ? [availableAgent] : queueManager.getAllAgents() // Only pass the target agent if specified
      );

      console.log('Got AI responses:', responses);

      // Save each AI interaction to Supabase
      for (const response of responses) {
        try {
          await supabase.from('ai_interactions').insert({
            user_id: userId,
            agent_id: response.agentId,
            user_message: text,
            ai_response: response.message,
            created_at: new Date().toISOString(),
          });
          console.log('Saved interaction to Supabase');
        } catch (error) {
          console.error('Error saving AI interaction:', error);
        }

        // Get the agent's username
        const agentUsername = INITIAL_AGENTS.find(agent => agent.name === response.context?.agentName)?.username || 'AI';

        // First, emit a system message indicating which agent is responding
        if (response === responses[0]) { // Only for the main agent
          io.emit('system:message', {
            username: 'System',
            text: `${agentUsername} is responding...`,
            timestamp: Date.now(),
            userColor: '#00FF00'
          });
        }

        // Broadcast each response to all clients
        io.emit('ai:response', {
          ...response,
          username: agentUsername
        });
      }
    } catch (error) {
      console.error('Error processing AI message:', error);
      socket.emit('ai:error', {
        message: 'Failed to process message',
      });
    }
  });

  // Handle queue status requests
  socket.on('queue:status', ({ userId }) => {
    const status = queueManager.getQueueStatus();
    const position = queueManager.getQueuePosition(userId);
    socket.emit('queue:update', { ...status, position });
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    const user = users.get(socket.id);
    if (user) {
      // Update last_seen in Supabase
      try {
        await supabase
          .from('users')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', socket.id);
      } catch (error) {
        console.error('Error updating user last seen:', error);
      }

    //   io.emit('system:message', {
    //     username: 'System',
    //     text: `${user.username} has left the chat`,
    //     timestamp: Date.now(),
    //     userColor: '#FF0000'
    //   });
      users.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 