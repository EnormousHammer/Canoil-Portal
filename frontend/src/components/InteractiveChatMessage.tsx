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

  // Parse a pipe-delimited cell row → array of cell strings
  const parseCells = (line: string): string[] =>
    line.split('|')
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
      .map(c => c.trim());

  // Markdown: **bold**, *italic*, ## header, -, 1., `code`, | tables |
  const parseMarkdown = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const trimmed = lines[i].trim();
      const mt = elements.length === 0 ? '' : ' mt-3';

      // ── TABLE ──────────────────────────────────────────────────────────────
      // Detect: current line is a pipe row AND next line is a separator row
      if (
        /^\|.*\|$/.test(trimmed) &&
        i + 1 < lines.length &&
        /^\|[\s\-:]+[\-]+[\s\-:|]*\|/.test(lines[i + 1].trim())
      ) {
        const headerCells = parseCells(trimmed);
        // skip separator row
        let j = i + 2;
        const dataRows: string[][] = [];
        while (j < lines.length && /^\|.*\|$/.test(lines[j].trim())) {
          dataRows.push(parseCells(lines[j].trim()));
          j++;
        }
        elements.push(
          <div key={i} className={`overflow-x-auto${mt} mb-2 rounded-lg border border-slate-200 shadow-sm`}>
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {headerCells.map((h, hi) => (
                    <th key={hi} className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {renderInlineMarkdown(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, ri) => (
                  <tr key={ri} className={`border-b border-slate-100 transition-colors ${ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/30`}>
                    {row.map((cell, ci) => (
                      <td key={ci} className={`px-3 py-2 text-slate-700 ${ci === 0 ? 'font-medium text-slate-800' : ''}`}>
                        {renderInlineMarkdown(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        i = j;
        continue;
      }

      // ── HEADINGS ────────────────────────────────────────────────────────────
      if (/^###\s/.test(trimmed)) {
        elements.push(<h3 key={i} className={`font-semibold text-slate-900 mb-1 text-sm${mt}`}>{renderWithClickables(trimmed.replace(/^###\s+/, ''))}</h3>);
      } else if (/^##\s/.test(trimmed)) {
        elements.push(<h2 key={i} className={`font-semibold text-slate-900 mb-2 text-base border-b border-slate-200 pb-1${mt}`}>{renderWithClickables(trimmed.replace(/^##\s+/, ''))}</h2>);
      } else if (/^#\s/.test(trimmed)) {
        elements.push(<h1 key={i} className={`font-bold text-slate-900 mb-2 text-lg border-b-2 border-slate-300 pb-1${mt}`}>{renderWithClickables(trimmed.replace(/^#\s+/, ''))}</h1>);

      // ── HORIZONTAL RULE ─────────────────────────────────────────────────────
      } else if (/^---+$/.test(trimmed)) {
        elements.push(<hr key={i} className="border-slate-200 my-3" />);

      // ── BULLET LIST ─────────────────────────────────────────────────────────
      } else if (/^[-*]\s/.test(trimmed)) {
        elements.push(
          <div key={i} className="flex gap-2 mt-1 items-start">
            <span className="text-slate-400 mt-0.5 leading-5">•</span>
            <span className="leading-relaxed">{renderInlineMarkdown(trimmed.replace(/^[-*]\s+/, ''))}</span>
          </div>
        );

      // ── NUMBERED LIST ───────────────────────────────────────────────────────
      } else if (/^\d+\.\s/.test(trimmed)) {
        const num = trimmed.match(/^(\d+)\./)?.[1] ?? '';
        elements.push(
          <div key={i} className="flex gap-2 mt-1 items-start">
            <span className="text-slate-500 font-semibold mt-0.5 leading-5 min-w-[1.2rem]">{num}.</span>
            <span className="leading-relaxed">{renderInlineMarkdown(trimmed.replace(/^\d+\.\s+/, ''))}</span>
          </div>
        );

      // ── BLANK LINE ──────────────────────────────────────────────────────────
      } else if (trimmed === '') {
        if (elements.length > 0) elements.push(<div key={i} className="h-2" />);

      // ── PARAGRAPH ───────────────────────────────────────────────────────────
      } else {
        elements.push(<p key={i} className="mt-1 leading-relaxed">{renderInlineMarkdown(trimmed)}</p>);
      }

      i++;
    }
    return elements;
  };

  const renderInlineMarkdown = (text: string) => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Find the earliest inline token: **bold**, *italic*, `code`
      const boldMatch   = remaining.match(/\*\*([^*]+)\*\*/);
      const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
      const codeMatch   = remaining.match(/`([^`]+)`/);

      // Pick the earliest match
      const candidates: { match: RegExpMatchArray; type: string }[] = [];
      if (boldMatch)   candidates.push({ match: boldMatch,   type: 'bold' });
      if (italicMatch) candidates.push({ match: italicMatch, type: 'italic' });
      if (codeMatch)   candidates.push({ match: codeMatch,   type: 'code' });
      candidates.sort((a, b) => (a.match.index ?? 0) - (b.match.index ?? 0));

      const chosen = candidates[0];

      if (chosen && chosen.match.index !== undefined) {
        if (chosen.match.index > 0) {
          parts.push(<span key={key++}>{renderWithClickables(remaining.slice(0, chosen.match.index))}</span>);
        }
        if (chosen.type === 'bold') {
          parts.push(<strong key={key++} className="font-semibold text-slate-900">{chosen.match[1]}</strong>);
        } else if (chosen.type === 'italic') {
          parts.push(<em key={key++} className="italic text-slate-700">{chosen.match[1]}</em>);
        } else {
          parts.push(<code key={key++} className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-800 font-mono text-[13px]">{chosen.match[1]}</code>);
        }
        remaining = remaining.slice(chosen.match.index + chosen.match[0].length);
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
