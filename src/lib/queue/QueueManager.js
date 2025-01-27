"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueManager = void 0;
class QueueManager {
    constructor(config) {
        this.agents = new Map();
        this.queue = [];
        this.activeChats = new Set();
        this.config = config;
    }
    registerAgent(agent) {
        this.agents.set(agent.id, agent);
    }
    getAvailableAgent() {
        const availableAgents = Array.from(this.agents.values()).filter(agent => agent.status === 'idle');
        return availableAgents.length > 0 ? availableAgents[0] : null;
    }
    addToQueue(entry) {
        if (this.queue.length >= this.config.maxQueueSize) {
            return false;
        }
        this.queue.push(Object.assign(Object.assign({}, entry), { timestamp: Date.now() }));
        this.cleanupQueue();
        return true;
    }
    getQueuePosition(userId) {
        return this.queue.findIndex(entry => entry.userId === userId) + 1;
    }
    getQueueStatus() {
        const availableAgents = Array.from(this.agents.values()).filter(agent => agent.status === 'idle').length;
        return {
            length: this.queue.length,
            activeChats: this.activeChats.size,
            availableAgents
        };
    }
    getAllAgents() {
        return Array.from(this.agents.values());
    }
    cleanupQueue() {
        const now = Date.now();
        this.queue = this.queue.filter(entry => now - entry.timestamp < this.config.queueTimeout);
    }
}
exports.QueueManager = QueueManager;
