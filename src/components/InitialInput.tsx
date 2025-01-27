interface InitialInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function InitialInput({ value, onChange, onSubmit }: InitialInputProps) {
  return (
    <div className="w-full max-w-3xl mb-8">
      <form onSubmit={onSubmit} className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full"></div>
        <input
          type="text"
          value={value}
          onChange={onChange}
          className="w-full pl-8 pr-12 py-4 bg-white rounded-lg shadow-lg border-0 focus:outline-none text-gray-700 placeholder-gray-400"
          placeholder="Type your message..."
          maxLength={500}
        />
        <button 
          type="submit" 
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 4V20M7 20L3 16M7 20L11 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="rotate(-45 12 12)"/>
          </svg>
        </button>
      </form>
    </div>
  );
} 