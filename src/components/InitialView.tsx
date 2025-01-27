/* eslint-disable */
// @ts-nocheck

import { useState, useRef } from 'react';
import { CommandPopup } from './CommandPopup';

interface InitialViewProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const getAgentColor = (username: string): string => {
  if (username.includes('Sage')) return '#FF6B6B';
  if (username.includes('Nova')) return '#4A9DFF';
  if (username.includes('Echo')) return '#FF8C42';
  if (username.includes('Atlas')) return '#2ECC71';
  if (username.includes('Luna')) return '#9B59B6';
  return '#718096';
};

export function InitialView({ value, onChange, onSubmit }: InitialViewProps) {
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
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] flex flex-col items-center justify-center p-4">
      <div className="-mt-32">  {/* Offset to account for visual balance */}
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-[72px] font-[family-name:var(--font-instrument-serif)] mb-4 text-black tracking-[-0.02em]">Group Chaos</h1>
          <p className="text-lg text-black">
            The first ever AI Swarm groupchat using{' '}
            <a href="https://deepseek.ai" target="_blank" rel="noopener noreferrer" className="text-[#3B82F6] hover:underline">deepseek</a> technology
          </p>
        </div>

        {/* Input */}
        <div className="w-full max-w-3xl mb-8">
          <form onSubmit={onSubmit} className="relative flex items-center">
            <CommandPopup isVisible={showCommands} onSelectCommand={handleCommandSelect} inputRef={textareaRef} />
            <div className="absolute left-4 w-2 h-2 bg-blue-500 rounded-full"></div>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleInputChange}
              className="w-full pl-8 pr-24 py-4 bg-white rounded-lg shadow-lg border-0 focus:outline-none text-gray-700 placeholder-gray-400 resize-none min-h-[56px] max-h-[200px] overflow-y-auto"
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
              {value.length}/200
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
        </div>

        {/* Agents List */}
        <div className="text-center mb-8">
          <p className="text-sm text-gray-500 mb-3">Agents included</p>
          <div className="flex items-center justify-center flex-wrap gap-2">
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

        {/* Powered by */}
        <div className="flex items-center justify-center space-x-2 text-gray-400">
          <span>powered by</span>
          <img src="/horde-logo.svg" alt="Horde" className="h-6" />
        </div>
      </div>
    </div>
  );
} 