import React, { useState } from 'react';
import { Brain, FileText, Package, Building2, DollarSign, Calendar, MapPin, Phone, Mail, ExternalLink, Info } from 'lucide-react';

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
    // Split content into sections
    const sections = content.split(/\*\*(.*?)\*\*/g);
    const elements: React.ReactNode[] = [];
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      
      if (i % 2 === 1) {
        // This is a header (between **)
        elements.push(
          <div key={i} className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-lg border-b border-gray-200 pb-2">
            {getHeaderIcon(section)}
            <span>{section}</span>
          </div>
        );
      } else {
        // This is content - check if it's an items list
        if (section.includes('1.') && section.includes('2.') && section.includes('3.')) {
          // This looks like an items list - format it properly
          elements.push(
            <div key={i} className="mb-4">
              {renderItemsList(section)}
            </div>
          );
        } else {
          // Regular content
          elements.push(
            <div key={i} className="mb-3 leading-relaxed">
              {renderInteractiveContent(section)}
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
          <div key={i} className="flex items-start gap-3 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              {number.replace('.', '').trim()}
            </div>
            <div className="flex-1 pt-1">
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
    if (header.includes('ITEMS') || header.includes('PRODUCTS')) {
      return <Package className="w-4 h-4 text-green-600" />;
    }
    if (header.includes('CUSTOMER')) {
      return <Building2 className="w-4 h-4 text-purple-600" />;
    }
    if (header.includes('FINANCIAL') || header.includes('TOTAL')) {
      return <DollarSign className="w-4 h-4 text-emerald-600" />;
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

  return (
    <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-5xl px-6 py-4 rounded-xl ${
          message.type === 'user'
            ? 'bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-lg'
            : 'bg-white border border-gray-200 shadow-md text-gray-900'
        }`}
      >
        <div className="flex items-start space-x-3">
          {message.type === 'assistant' && (
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            {message.type === 'assistant' ? (
              <div className="space-y-3">
                {parseAndRenderContent(message.content)}
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            )}
            
            {/* Sources */}
            {message.sources && message.sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {message.sources.map((source, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md"
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      {source}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Confidence indicator for assistant messages */}
            {message.type === 'assistant' && message.confidence && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Confidence: {Math.round(message.confidence * 100)}%</span>
                </div>
                <span className="text-gray-400">•</span>
                <span>{message.timestamp.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
          
          {message.type === 'user' && (
            <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">U</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
