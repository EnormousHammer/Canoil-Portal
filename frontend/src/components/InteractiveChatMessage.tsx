import React from 'react';
import { Brain, User } from 'lucide-react';

interface InteractiveChatMessageProps {
  message: {
    id: string;
    type: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    category?: string;
    confidence?: number;
    sources?: string[];
  };
  onItemClick?: (item: any) => void;
  onSOClick?: (soNumber: string) => void;
  onCustomerClick?: (customer: string) => void;
  data?: any; // App data for tooltips
}


export const InteractiveChatMessage: React.FC<InteractiveChatMessageProps> = ({ 
  message, 
  onItemClick, 
  onSOClick, 
  onCustomerClick,
  data 
}) => {
  const parseAndRenderContent = (content: string) => {
    // Simple: **bold** → <strong>, preserve line breaks, minimal structure
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return (
      <div className="whitespace-pre-wrap break-words">
        {parts.map((part, i) => {
          const bold = part.match(/^\*\*(.+)\*\*$/);
          if (bold) return <strong key={i} className="font-semibold text-slate-900">{bold[1]}</strong>;
          return <span key={i}>{renderSimpleContent(part)}</span>;
        })}
      </div>
    );
  };

  const renderSimpleContent = (content: string) => {
    // Only SO numbers clickable; money as subtle highlight. No heavy buttons.
    const soMatch = content.match(/(?:SO|Sales Order|Order)\s*#?\s*(\d{3,5})/gi);
    if (!soMatch) return content;
    const parts: React.ReactNode[] = [];
    let last = 0;
    const regex = /(?:SO|Sales Order|Order)\s*#?\s*(\d{3,5})/gi;
    let m;
    while ((m = regex.exec(content)) !== null) {
      if (m.index > last) parts.push(content.slice(last, m.index));
      parts.push(
        <button
          key={m.index}
          onClick={() => onSOClick?.(m![1])}
          className="text-blue-600 hover:underline font-medium"
        >
          {m[0]}
        </button>
      );
      last = m.index + m[0].length;
    }
    if (last < content.length) parts.push(content.slice(last));
    return parts.length > 0 ? parts : content;
  };

  const isUser = message.type === 'user';
  const AvatarEl = (
    <div
      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white'
      }`}
    >
      {isUser ? <User className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
    </div>
  );

  return (
    <div className={`flex items-start gap-3 mb-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {AvatarEl}
      <div
        className={`max-w-[90%] sm:max-w-2xl px-4 py-3 rounded-xl ${
          isUser
            ? 'bg-indigo-600 text-white'
            : 'bg-white border border-slate-200 text-slate-800'
        }`}
      >
        {message.type === 'assistant' ? (
          <div className="text-sm leading-relaxed text-slate-700">
            {parseAndRenderContent(message.content)}
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        )}

        {message.sources && message.sources.length > 0 && (
          <div className={`mt-2 pt-2 ${isUser ? 'border-white/20' : 'border-slate-100'} border-t`}>
            <div className="flex flex-wrap gap-1.5 text-xs text-slate-500">
              {message.sources.map((s, i) => (
                <span key={i}>{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
