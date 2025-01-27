import { RefObject, useState, useRef } from 'react';
import { Message } from '@/types/chat';
import { CommandPopup } from './CommandPopup';

interface ChatBoxProps {
  messages: Message[];
  newMessage: string;
  isAiLoading: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  currentUsername: string;
}

const getAgentColor = (username: string): string => {
  if (username.includes('Keat')) return '#8B4513';  // Philosophical brown
  if (username.includes('Devin')) return '#4A9DFF'; // Tech blue
  if (username.includes('Yada')) return '#FF69B4';  // Creative pink
  if (username.includes('Aldo')) return '#32CD32';  // Analyst green
  return '#718096';  // Default gray
};

export function ChatBox({ 
  messages, 
  newMessage, 
  isAiLoading, 
  messagesEndRef, 
  onSubmit, 
  onChange,
  currentUsername 
}: ChatBoxProps) {
  const [showCommands, setShowCommands] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(e);
    setShowCommands(newValue.endsWith('/'));
  };

  const handleCommandSelect = (command: string) => {
    const event = {
      target: { value: command },
    } as React.ChangeEvent<HTMLTextAreaElement>;
    onChange(event);
    setShowCommands(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="w-full max-w-5xl mb-8">
      {/* Messages Area */}
      <div className="h-[60vh] overflow-y-auto space-y-8 p-6">
        {messages.map((msg, index) => (
          <div key={index} className="flex items-start gap-12">
            {/* Username/Badge */}
            <div className="flex-shrink-0 w-48">
              <div className="bg-white shadow-sm rounded-full px-4 py-1.5 text-sm whitespace-nowrap">
                {msg.isAI ? (
                  <span style={{ color: getAgentColor(msg.username) }}>{msg.username} •</span>
                ) : (
                  <span className="text-gray-600">
                    {msg.username === currentUsername ? 'You' : msg.username} •
                  </span>
                )}
              </div>
            </div>
            {/* Message with automatic line breaks */}
            <div className="flex-grow max-w-[70%]">
              <p 
                className="text-[15px] leading-relaxed whitespace-pre-wrap break-words"
                style={{ 
                  color: msg.isAI ? getAgentColor(msg.username) : '#4B5563'
                }}
              >
                {msg.text}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="mt-4">
        <form onSubmit={onSubmit} className="relative flex items-center">
          <CommandPopup isVisible={showCommands} onSelectCommand={handleCommandSelect} />
          <div className="absolute left-4 w-2 h-2 bg-blue-500 rounded-full"></div>
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={handleInputChange}
            className="w-full pl-8 pr-24 py-4 bg-white rounded-lg shadow-sm border-0 focus:outline-none text-gray-700 placeholder-gray-400 resize-none min-h-[56px] max-h-[200px] overflow-y-auto"
            style={{
              height: 'auto',
              width: '100%',
              display: 'block',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              paddingRight: '6rem'
            }}
            placeholder="Type your message..."
            maxLength={200}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 200) + 'px';
            }}
          />
          <div className="absolute right-12 text-sm text-gray-400">
            {newMessage.length}/200
          </div>
          <button 
            type="submit" 
            className="absolute right-4 text-gray-400"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 4V20M7 20L3 16M7 20L11 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="rotate(-45 12 12)"/>
            </svg>
          </button>
        </form>

        {/* AI Thinking Indicator */}
        {isAiLoading && (
          <div className="mt-4">
            <div className="flex items-center justify-center space-x-2 text-gray-500">
              <span className="animate-pulse">AI Swarm is thinking</span>
              <span className="animate-[pulse_1s_ease-in-out_0.2s_infinite]">.</span>
              <span className="animate-[pulse_1s_ease-in-out_0.4s_infinite]">.</span>
              <span className="animate-[pulse_1s_ease-in-out_0.6s_infinite]">.</span>
            </div>
          </div>
        )}

        {/* Agents List */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 mb-3">Our AI Agents</p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <div className="bg-white shadow-sm rounded-full px-4 py-1.5 text-sm">
              <span style={{ color: getAgentColor('Keat') }}>🧘 Keat | Philosopher</span>
            </div>
            <div className="bg-white shadow-sm rounded-full px-4 py-1.5 text-sm">
              <span style={{ color: getAgentColor('Devin') }}>🚀 Devin | Tech Expert</span>
            </div>
            <div className="bg-white shadow-sm rounded-full px-4 py-1.5 text-sm">
              <span style={{ color: getAgentColor('Yada') }}>🎨 Yada | Creative</span>
            </div>
            <div className="bg-white shadow-sm rounded-full px-4 py-1.5 text-sm">
              <span style={{ color: getAgentColor('Aldo') }}>📊 Aldo | Analyst</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 