'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Bot, Loader2 } from 'lucide-react';

interface CodeChatbotProps {
  podcastId: string;
  repoName: string;
}

export default function CodeChatbot({ podcastId, repoName }: CodeChatbotProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podcastId,
          message: userMessage,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + (data.error || 'Failed to get response') }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: Failed to connect to the detective bureau.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#0a0a0a] border border-zinc-800 p-5 shadow-lg h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-2 shrink-0">
        <Bot className="w-4 h-4 text-zinc-500" />
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest font-typewriter">Code Logic Interrogation</h2>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4 custom-scrollbar p-2 bg-[#0f0f0f] border border-zinc-900 rounded-sm min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-zinc-600 text-xs italic py-10 font-courier">
            "I'm ready to answer questions about the code logic, architecture, or specific concepts..."
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-sm text-xs font-mono overflow-hidden break-words whitespace-pre-wrap ${
              msg.role === 'user' 
                ? 'bg-zinc-800 text-zinc-200 border border-zinc-700' 
                : 'bg-[#1a1a1a] text-zinc-400 border border-zinc-800'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#1a1a1a] p-3 rounded-sm border border-zinc-800">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the code logic, architecture, or specific concepts..."
          className="flex-1 bg-[#0f0f0f] border border-zinc-800 text-zinc-300 text-xs p-2 focus:outline-none focus:border-zinc-600 font-mono placeholder:text-zinc-700"
        />
        <button 
          type="submit" 
          disabled={isLoading}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 disabled:opacity-50 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
