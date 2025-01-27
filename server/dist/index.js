"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const supabase_js_1 = require("@supabase/supabase-js");
const QueueManager_1 = require("./lib/queue/QueueManager");
const AIAgentService_1 = require("./lib/ai/AIAgentService");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const userRateLimits = new Map();
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const MAX_MESSAGES_PER_WINDOW = 5;
const MESSAGE_MIN_INTERVAL = 500; // 500ms between messages
const DUPLICATE_MESSAGE_WINDOW = 30000; // 30 seconds
const lastMessages = new Map();
// Function to check rate limits
const checkRateLimit = (socketId, messageText) => {
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
    }
    else {
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
    frontendUrl
].filter(Boolean);
// Enable CORS for Express
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
}));
// Add a test endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', allowedOrigins });
});
const io = new socket_io_1.Server(server, {
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
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
const users = new Map();
// AI Swarm Configuration
const SWARM_CONFIG = {
    maxConcurrentChats: 5,
    queueTimeout: 300000, // 5 minutes
    defaultPriority: 1,
    maxQueueSize: 50,
};
// Initialize AI Services
const queueManager = new QueueManager_1.QueueManager(SWARM_CONFIG);
const aiService = new AIAgentService_1.AIAgentService();
// Initial AI Agents
const INITIAL_AGENTS = [
    {
        name: 'Sage',
        role: 'philosopher',
        specialization: 'philosophical insights and deep thinking',
        personality: 'Wise, contemplative, and speaks in thoughtful metaphors. Often relates modern questions to ancient wisdom and philosophical concepts.',
        username: '🧘 Sage | Philosopher'
    },
    {
        name: 'Nova',
        role: 'tech_expert',
        specialization: 'technology and innovation',
        personality: 'Enthusiastic about cutting-edge tech, speaks with technical precision but makes complex concepts accessible. Loves to share tech predictions.',
        username: '🚀 Nova | Tech Expert'
    },
    {
        name: 'Echo',
        role: 'creative',
        specialization: 'art, music, and creative expression',
        personality: 'Artistic, imaginative, and emotionally intuitive. Often communicates through cultural references and artistic metaphors.',
        username: '🎨 Echo | Creative'
    },
    {
        name: 'Atlas',
        role: 'analyst',
        specialization: 'data analysis and strategic thinking',
        personality: 'Logical, methodical, and detail-oriented. Loves to break down complex problems and provide structured solutions.',
        username: '📊 Atlas | Analyst'
    },
    {
        name: 'Luna',
        role: 'social',
        specialization: 'community engagement and emotional support',
        personality: 'Empathetic, warm, and socially aware. Great at fostering connections and making everyone feel heard.',
        username: '🌟 Luna | Social Guide'
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
    }
    catch (error) {
        console.error('Error initializing agents:', error);
    }
})();
io.on('connection', async (socket) => {
    console.log('User connected:', socket.id);
    // Handle user join
    socket.on('user:join', async ({ username, color }) => {
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
        }
        catch (error) {
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
        const truncatedText = (text === null || text === void 0 ? void 0 : text.slice(0, 500)) || '';
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
        }
        catch (error) {
            console.error('Error saving message:', error);
        }
        io.emit('chat:message', message);
    });
    // Handle AI messages
    socket.on('ai:message', async ({ text, userId, targetAgent }) => {
        var _a;
        console.log('Received AI message request:', { text, userId, targetAgent });
        try {
            let availableAgent = null;
            if (targetAgent) {
                // Find the specific agent requested
                const allAgents = queueManager.getAllAgents();
                availableAgent = allAgents.find(agent => agent.name.toLowerCase() === targetAgent && agent.status === 'idle');
                if (!availableAgent) {
                    socket.emit('ai:error', {
                        message: `${targetAgent.charAt(0).toUpperCase() + targetAgent.slice(1)} is currently busy. Please try again later.`,
                    });
                    return;
                }
            }
            else {
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
            const responses = await aiService.processUserMessage(availableAgent, userId, text, targetAgent ? [availableAgent] : queueManager.getAllAgents() // Only pass the target agent if specified
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
                }
                catch (error) {
                    console.error('Error saving AI interaction:', error);
                }
                // Get the agent's username
                const agentUsername = ((_a = INITIAL_AGENTS.find(agent => { var _a; return agent.name === ((_a = response.context) === null || _a === void 0 ? void 0 : _a.agentName); })) === null || _a === void 0 ? void 0 : _a.username) || 'AI';
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
                io.emit('ai:response', Object.assign(Object.assign({}, response), { username: agentUsername }));
            }
        }
        catch (error) {
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
        socket.emit('queue:update', Object.assign(Object.assign({}, status), { position }));
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
            }
            catch (error) {
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
