import React from 'react';
import { Brain, User, FileText } from 'lucide-react';

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
  data?: any;
}

export const InteractiveChatMessage: React.FC<InteractiveChatMessageProps> = ({
  message,
  onSOClick,
  onCustomerClick,
}) => {
  // Inline text with clickable entities (SO, customer, money, item) — subtle, professional
  const renderWithClickables = (text: string) => {
    const parts: React.ReactNode[] = [];
    let last = 0;

    // SO numbers: SO #1234, Sales Order 1234
    const soRegex = /(?:SO|Sales Order|Order)\s*#?\s*(\d{3,5})/gi;
    let m;
    const allMatches: { start: number; end: number; type: string; value: string; display: string }[] = [];
    while ((m = soRegex.exec(text)) !== null) {
      allMatches.push({ start: m.index, end: m.index + m[0].length, type: 'so', value: m[1], display: m[0] });
    }

    // Money: $1,234.56
    const moneyRegex = /\$[\d,]+\.?\d*/g;
    while ((m = moneyRegex.exec(text)) !== null) {
      allMatches.push({ start: m.index, end: m.index + m[0].length, type: 'money', value: m[0], display: m[0] });
    }

    // Customer names: Company Inc., Corp., Ltd., Co.
    const custRegex = /([A-Z][a-zA-Z\s&]+(?:Co\.?|Inc\.?|Ltd\.?|LLC|Corp\.?|Company))/g;
    while ((m = custRegex.exec(text)) !== null) {
      allMatches.push({ start: m.index, end: m.index + m[0].length, type: 'customer', value: m[1].trim(), display: m[1].trim() });
    }

    allMatches.sort((a, b) => a.start - b.start);
    // Dedupe overlapping
    const filtered: typeof allMatches = [];
    for (const match of allMatches) {
      if (filtered.length && match.start < filtered[filtered.length - 1].end) continue;
      filtered.push(match);
    }

    for (const match of filtered) {
      if (match.start > last) parts.push(text.slice(last, match.start));
      if (match.type === 'so') {
        parts.push(
          <button key={match.start} onClick={() => onSOClick?.(match.value)} className="text-blue-600 hover:text-blue-700 hover:underline font-medium">
            {match.display}
          </button>
        );
      } else if (match.type === 'customer') {
        parts.push(
          <button key={match.start} onClick={() => onCustomerClick?.(match.value)} className="text-violet-600 hover:text-violet-700 hover:underline font-medium">
            {match.display}
          </button>
        );
      } else if (match.type === 'money') {
        parts.push(<span key={match.start} className="font-semibold text-slate-800">{match.display}</span>);
      }
      last = match.end;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length > 0 ? parts : text;
  };

  // Markdown: **bold**, ## header, -, 1., `code`
  const parseMarkdown = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      const mt = elements.length === 0 ? '' : ' mt-3';
      if (/^###\s/.test(trimmed)) {
        elements.push(<h3 key={i} className={`font-semibold text-slate-900 mb-1 text-sm${mt}`}>{renderWithClickables(trimmed.replace(/^###\s+/, ''))}</h3>);
      } else if (/^##\s/.test(trimmed)) {
        elements.push(<h2 key={i} className={`font-semibold text-slate-900 mb-2 text-base border-b border-slate-200 pb-1${mt}`}>{renderWithClickables(trimmed.replace(/^##\s+/, ''))}</h2>);
      } else if (/^-\s/.test(trimmed) || /^\*\s/.test(trimmed)) {
        elements.push(<div key={i} className="flex gap-2 mt-1"><span className="text-slate-400">•</span><span>{renderInlineMarkdown(trimmed.replace(/^[-*]\s+/, ''))}</span></div>);
      } else if (/^\d+\.\s/.test(trimmed)) {
        const num = trimmed.match(/^(\d+)\./)?.[1] ?? '';
        elements.push(<div key={i} className="flex gap-2 mt-1"><span className="text-slate-500 font-medium">{num}.</span><span>{renderInlineMarkdown(trimmed.replace(/^\d+\.\s+/, ''))}</span></div>);
      } else if (trimmed === '') {
        elements.push(<br key={i} />);
      } else {
        elements.push(<p key={i} className="mt-1">{renderInlineMarkdown(trimmed)}</p>);
      }
    }
    return elements;
  };

  const renderInlineMarkdown = (text: string) => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      const codeMatch = remaining.match(/`([^`]+)`/);
      let match: RegExpMatchArray | null = null;
      let type = '';

      if (boldMatch && (!codeMatch || boldMatch.index! <= codeMatch.index!)) {
        match = boldMatch;
        type = 'bold';
      } else if (codeMatch) {
        match = codeMatch;
        type = 'code';
      }

      if (match && match.index !== undefined) {
        if (match.index > 0) {
          parts.push(<span key={key++}>{renderWithClickables(remaining.slice(0, match.index))}</span>);
        }
        if (type === 'bold') {
          parts.push(<strong key={key++} className="font-semibold text-slate-900">{match[1]}</strong>);
        } else {
          parts.push(<code key={key++} className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-800 font-mono text-[13px]">{match[1]}</code>);
        }
        remaining = remaining.slice(match.index + match[0].length);
      } else {
        parts.push(<span key={key++}>{renderWithClickables(remaining)}</span>);
        break;
      }
    }
    return parts;
  };

  const isUser = message.type === 'user';

  return (
    <div className={`flex items-start gap-3 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar — clean, modern */}
      <div
        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-sm ${
          isUser ? 'bg-slate-600' : 'bg-slate-700'
        }`}
      >
        {isUser ? <User className="w-4 h-4 text-white" /> : <Brain className="w-4 h-4 text-white" />}
      </div>

      {/* Bubble — modern, subtle shadow */}
      <div
        className={`max-w-[85%] sm:max-w-2xl rounded-2xl px-4 py-3 shadow-sm ${
          isUser
            ? 'bg-slate-700 text-white'
            : 'bg-white border border-slate-100 text-slate-800'
        }`}
      >
        {message.type === 'assistant' ? (
          <div className="text-sm leading-relaxed">
            {parseMarkdown(message.content)}
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        )}

        {message.sources && message.sources.length > 0 && (
          <div className={`mt-3 pt-2 border-t ${isUser ? 'border-white/20' : 'border-slate-100'}`}>
            <div className="flex flex-wrap gap-2 text-xs">
              {message.sources.map((s, i) => (
                <span key={i} className={`inline-flex items-center gap-1 ${isUser ? 'text-white/80' : 'text-slate-500'}`}>
                  <FileText className="w-3 h-3" />
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
