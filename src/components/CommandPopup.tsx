interface CommandPopupProps {
  isVisible: boolean;
  onSelectCommand: (command: string) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

const commands = [
  {
    command: '/ai',
    description: 'Send a message to all AI agents'
  },
  {
    command: '/ai-keat',
    description: 'Send a message to Keat (Philosopher - Existential analysis & ethics)'
  },
  {
    command: '/ai-devin',
    description: 'Send a message to Devin (Tech Expert - Blockchain & AI)'
  },
  {
    command: '/ai-yada',
    description: 'Send a message to Yada (Creative - Surreal storytelling & memes)'
  },
  {
    command: '/ai-aldo',
    description: 'Send a message to Aldo (Analyst - Data & patterns)'
  },
  {
    command: '/changename',
    description: 'Change your username'
  }
];

export function CommandPopup({ isVisible, onSelectCommand, inputRef }: CommandPopupProps) {
  if (!isVisible) return null;

  const handleCommandClick = (command: string) => {
    onSelectCommand(command + ' ');
    // Focus the input field after selecting a command
    if (inputRef?.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-lg shadow-lg border border-gray-100 max-h-[300px] overflow-y-auto">
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Available Commands</h3>
        <div className="space-y-2">
          {commands.map((cmd) => (
            <div 
              key={cmd.command} 
              className="flex items-start space-x-3 text-sm p-2 hover:bg-gray-50 rounded-md cursor-pointer transition-colors"
              onClick={() => handleCommandClick(cmd.command)}
            >
              <span className="text-blue-500 font-mono whitespace-nowrap">{cmd.command}</span>
              <span className="text-gray-600">{cmd.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 