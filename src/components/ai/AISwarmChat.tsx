/* eslint-disable */
// @ts-nocheck

import { useState, useEffect, useRef } from 'react';
import { AIResponse, QueueEntry } from '@/types/ai';

interface AISwarmChatProps {
  userId: string;
  onSendMessage: (message: string) => Promise<void>;
  queuePosition: number;
  messages: AIResponse[];
  isInQueue: boolean;
}

export default function AISwarmChat({
  userId,
  onSendMessage,
  queuePosition,
  messages,
  isInQueue,
}: AISwarmChatProps) {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    await onSendMessage(inputMessage.trim());
    setInputMessage('');
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 rounded-lg shadow-lg">
      {/* Queue Status */}
      {isInQueue && (
        <div className="bg-blue-100 p-4 text-center">
          <p className="text-blue-800">
            You are in queue. Position: {queuePosition}
          </p>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={`${message.timestamp}-${index}`}
            className={`flex ${
              message.userId === userId ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.userId === userId
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-800'
              }`}
            >
              <p className="text-sm">{message.message}</p>
              <span className="text-xs opacity-75 mt-1 block">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 bg-white border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isInQueue}
          />
          <button
            type="submit"
            disabled={isInQueue || !inputMessage.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
} 