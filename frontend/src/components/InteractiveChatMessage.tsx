import React, { useState } from 'react';
import { Brain, FileText, Package, Building2, DollarSign, Calendar, MapPin, Phone, Mail, ExternalLink, Info, User } from 'lucide-react';

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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };


  const parseAndRenderContent = (content: string) => {
    // Match AI response format: **QUERY TYPE: X** followed by - **Label:** value blocks
    const queryTypeMatch = content.match(/^\s*\*\*QUERY TYPE:\s*(.+?)\*\*/i);
    const elements: React.ReactNode[] = [];

    if (queryTypeMatch) {
      const queryType = queryTypeMatch[1].trim();
      let rest = content.slice(queryTypeMatch[0].length).trim();

      elements.push(
        <div key="query-type" className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-base border-b-2 border-violet-200 pb-3">
          {getHeaderIcon(queryType)}
          <span>{queryType}</span>
        </div>
      );

      // Parse "- **Label:** value" blocks (value runs until next "- **" or end)
      const blockRegex = /-\s*\*\*([^:*]+):\*\*\s*([\s\S]*?)(?=-\s*\*\*|$)/g;
      let blockMatch;
      const blocks: Array<{ label: string; value: string }> = [];
      while ((blockMatch = blockRegex.exec(rest)) !== null) {
        blocks.push({ label: blockMatch[1].trim(), value: blockMatch[2].trim() });
      }

      if (blocks.length > 0) {
        blocks.forEach((block, idx) => {
          elements.push(
            <div key={`block-${idx}`} className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{block.label}</div>
              <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                {block.value.includes('1.') && block.value.includes('2.') ? renderItemsList(block.value) : renderInteractiveContent(block.value)}
              </div>
            </div>
          );
        });
      } else {
        elements.push(
          <div key="rest" className="text-sm leading-relaxed text-slate-700">
            {renderInteractiveContent(rest)}
          </div>
        );
      }
    } else {
      // Fallback: original **header** / content parsing
      const sections = content.split(/\*\*(.*?)\*\*/g);
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        if (i % 2 === 1) {
          elements.push(
            <div key={i} className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-base border-b border-slate-200 pb-2">
              {getHeaderIcon(section)}
              <span>{section}</span>
            </div>
          );
        } else if (section.trim()) {
          elements.push(
            <div key={i} className="mb-3 leading-relaxed">
              {section.includes('1.') && section.includes('2.') && section.includes('3.') ? renderItemsList(section) : renderInteractiveContent(section)}
            </div>
          );
        }
      }
    }

    return elements;
  };

  const renderItemsList = (content: string) => {
    // Split by numbered items and format each one
    const items = content.split(/(\d+\.\s)/).filter(item => item.trim());
    const formattedItems: React.ReactNode[] = [];
    
    for (let i = 0; i < items.length; i += 2) {
      const number = items[i];
      const itemContent = items[i + 1];
      
      if (number && itemContent && number.match(/^\d+\.\s$/)) {
        formattedItems.push(
          <div key={i} className="flex items-start gap-3 mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex-shrink-0 w-8 h-8 bg-violet-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
              {number.replace('.', '').trim()}
            </div>
            <div className="flex-1 pt-0.5">
              {renderInteractiveContent(itemContent)}
            </div>
          </div>
        );
      }
    }
    
    return formattedItems.length > 0 ? formattedItems : renderInteractiveContent(content);
  };

  const getHeaderIcon = (header: string) => {
    if (header.includes('ORDER DETAILS') || header.includes('SALES ORDER')) {
      return <FileText className="w-4 h-4 text-blue-600" />;
    }
    if (header.includes('ITEMS') || header.includes('PRODUCTS') || header.includes('INVENTORY') || header.includes('STOCK')) {
      return <Package className="w-4 h-4 text-green-600" />;
    }
    if (header.includes('CUSTOMER')) {
      return <Building2 className="w-4 h-4 text-purple-600" />;
    }
    if (header.includes('FINANCIAL') || header.includes('TOTAL') || header.includes('AR ') || header.includes('METRICS')) {
      return <DollarSign className="w-4 h-4 text-emerald-600" />;
    }
    if (header.includes('QUERY TYPE') || header.includes('MANUFACTURING') || header.includes('MO ')) {
      return <Info className="w-4 h-4 text-violet-600" />;
    }
    return null;
  };

  const renderInteractiveContent = (content: string) => {
    // Enhanced regex patterns for better detection
    const patterns = [
      // SO Numbers - more comprehensive
      {
        regex: /(?:SO|Sales Order|Order)\s*#?\s*(\d{3,5})/gi,
        render: (match: string, soNumber: string) => (
          <button
            key={`so-${soNumber}`}
            onClick={() => onSOClick?.(soNumber)}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md text-sm font-medium transition-colors cursor-pointer"
          >
            <FileText className="w-3 h-3" />
            SO #{soNumber}
            <ExternalLink className="w-3 h-3" />
          </button>
        )
      },
      // Full item descriptions - capture complete product names for easy copying
      {
        regex: /([A-Z]{2,4}\s+[A-Z0-9\-_]+(?:\s+[A-Z0-9\-_]+)*(?:\s+[A-Za-z]+(?:\s+[A-Za-z]+)*)?)/g,
        render: (match: string) => {
          const trimmed = match.trim();
          // Skip common words and patterns that aren't item codes
          if (/^(SO|ORDER|SALES|TOTAL|STATUS|DATE|QTY|EACH|CASE|DRUM|PAIL|KG|LB|CANADA|LTD|INC|CORP|CO|THE|AND|FOR|WITH|FROM|ITEMS|PRODUCTS|CUSTOMER|AMOUNT|VELAN)$/i.test(trimmed)) {
            return match;
          }
          // Skip if it's too short (likely not a full item)
          if (trimmed.length < 6) {
            return match;
          }
          return (
            <button
              key={`item-${trimmed}`}
              onClick={() => {
                // Copy to chat input instead of opening modal
                const chatInput = document.querySelector('input[placeholder*="Ask me anything"]') as HTMLInputElement;
                if (chatInput) {
                  chatInput.value = `Tell me about ${trimmed}`;
                  chatInput.focus();
                }
              }}
              className="inline-flex items-center gap-2 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md border border-green-200 hover:border-green-300"
              title={`Click to ask about ${trimmed}`}
            >
              <Package className="w-3 h-3" />
              {trimmed}
            </button>
          );
        }
      },
      // Customer names (companies with Co., Inc., Ltd., etc.)
      {
        regex: /([A-Z][a-zA-Z\s&]+(?:Co\.?|Inc\.?|Ltd\.?|LLC|Corporation|Corp\.?|Company))/g,
        render: (match: string) => (
          <button
            key={`customer-${match}`}
            onClick={() => onCustomerClick?.(match.trim())}
            className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-md text-sm font-medium transition-colors cursor-pointer"
          >
            <Building2 className="w-3 h-3" />
            {match.trim()}
            <ExternalLink className="w-3 h-3" />
          </button>
        )
      },
      // Money amounts
      {
        regex: /\$[\d,]+\.?\d*/g,
        render: (match: string) => (
          <span key={`money-${match}`} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 rounded-md text-sm font-semibold">
            <DollarSign className="w-3 h-3" />
            {match}
          </span>
        )
      },
      // Dates
      {
        regex: /\d{1,2}\/\d{1,2}\/\d{2,4}/g,
        render: (match: string) => (
          <span key={`date-${match}`} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">
            <Calendar className="w-3 h-3" />
            {match}
          </span>
        )
      }
    ];

    let processedContent = content;
    const replacements: Array<{ start: number; end: number; element: React.ReactNode }> = [];

    // Find all matches and their positions
    patterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.regex);
      while ((match = regex.exec(content)) !== null) {
        const matchText = match[0];
        const captureGroup = match[1] || matchText;
        
        replacements.push({
          start: match.index,
          end: match.index + matchText.length,
          element: pattern.render(matchText, captureGroup)
        });
      }
    });

    // Sort replacements by position (reverse order to avoid index shifting)
    replacements.sort((a, b) => b.start - a.start);

    // Apply replacements
    const elements: React.ReactNode[] = [];
    let lastIndex = content.length;

    replacements.forEach((replacement, index) => {
      // Add text after this replacement
      if (lastIndex > replacement.end) {
        const textAfter = content.slice(replacement.end, lastIndex);
        if (textAfter.trim()) {
          elements.unshift(textAfter);
        }
      }
      
      // Add the replacement element
      elements.unshift(replacement.element);
      
      lastIndex = replacement.start;
    });

    // Add any remaining text at the beginning
    if (lastIndex > 0) {
      const textBefore = content.slice(0, lastIndex);
      if (textBefore.trim()) {
        elements.unshift(textBefore);
      }
    }

    return elements.length > 0 ? elements : content;
  };

  const isUser = message.type === 'user';
  const AvatarEl = (
    <div
      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ring-2 ring-white shadow-md ${
        isUser
          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
          : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
      }`}
    >
      {isUser ? (
        <User className="w-5 h-5" strokeWidth={2.5} />
      ) : (
        <Brain className="w-5 h-5" strokeWidth={2.5} />
      )}
    </div>
  );

  return (
    <div className={`flex items-start gap-4 mb-5 ${isUser ? 'flex-row-reverse' : ''}`}>
      {AvatarEl}
      <div
        className={`max-w-[90%] sm:max-w-3xl px-5 py-4 rounded-2xl shadow-sm ${
          isUser
            ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white'
            : 'bg-white border border-slate-200/80 text-slate-800'
        }`}
      >
        {message.type === 'assistant' ? (
          <div className="space-y-4 text-sm leading-relaxed">
            {parseAndRenderContent(message.content)}
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className={`mt-4 pt-3 ${isUser ? 'border-white/25' : 'border-slate-200'} border-t`}>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((source, index) => (
                <span
                  key={index}
                  className={`inline-flex items-center px-2.5 py-1 text-xs rounded-lg font-medium ${
                    isUser ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <FileText className="w-3 h-3 mr-1.5 flex-shrink-0" />
                  {source}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Confidence + timestamp for assistant */}
        {message.type === 'assistant' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            {message.confidence && (
              <>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  <span>{Math.round(message.confidence * 100)}%</span>
                </div>
                <span>·</span>
              </>
            )}
            <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </div>
    </div>
  );
};
