import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getApiUrl } from '../utils/apiConfig';
import { Mail, RefreshCw, LogIn, Truck, FileText, Search, ChevronDown, ChevronRight, ChevronUp, Clock, Paperclip, Quote, Reply, Forward, MoreVertical, Bold, Italic, Link, List, Eye, Download, Brain, MessageSquareText, Sparkles, Copy, Send, BookOpen, Trash2, Loader, CheckCircle, AlertCircle, Loader2, X, Edit } from 'lucide-react';
import { AIEmailAssistant } from './AIEmailAssistant';

// Add custom CSS for email formatting
const emailStyles = `
  .prose {
    max-width: none;
  }
  .prose strong {
    font-weight: 600;
    color: #1f2937;
  }
  .prose em {
    font-style: italic;
    color: #4b5563;
  }
  .prose a {
    color: #2563eb;
    text-decoration: underline;
  }
  .prose a:hover {
    color: #1d4ed8;
  }
  .prose li {
    margin: 0.25rem 0;
  }
  .prose ul {
    list-style-type: disc;
    margin-left: 1rem;
  }
  .prose ol {
    list-style-type: decimal;
    margin-left: 1rem;
  }
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .email-chain-message {
    border-left: 4px solid #e5e7eb;
    padding-left: 1rem;
    margin: 1rem 0;
  }
  .email-chain-message:last-child {
    border-left-color: #3b82f6;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = emailStyles;
  document.head.appendChild(styleSheet);
}

interface EmailAssistantProps {
  currentUser: { name: string; email: string; isAdmin: boolean } | null;
  setActiveSection?: (section: string) => void;
}

interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  downloadUrl?: string;
  thumbnailUrl?: string;
}

interface Email {
  id: string;
  threadId?: string;
  from: string;
  subject: string;
  snippet: string;
  body: string;
  timestamp: string;
  date: string;
  hasResponse: boolean;
  aiResponse?: string;
  attachments?: EmailAttachment[];
  hasAttachments?: boolean;
}

interface EmailThread {
  threadId: string;
  subject: string;
  emails: Email[];
  lastEmail: Email;
  unreadCount: number;
  totalCount: number;
  hasMoreMessages: boolean;
  isForwarded: boolean;
  referenceHeaders?: string[];
}

// Gmail-style email content cleaning
const formatEmailContent = (content: string): string => {
  if (!content) return '';
  
  // First, strip HTML tags but preserve basic formatting
  let cleaned = content
    .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to line breaks
    .replace(/<\/p>/gi, '\n\n') // Convert </p> to double line breaks
    .replace(/<p[^>]*>/gi, '') // Remove <p> tags
    .replace(/<div[^>]*>/gi, '') // Remove <div> tags
    .replace(/<\/div>/gi, '\n') // Convert </div> to line breaks
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**') // Convert <strong> to **bold**
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**') // Convert <b> to **bold**
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*') // Convert <em> to *italic*
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*') // Convert <i> to *italic*
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)') // Convert links to text (url)
    .replace(/<[^>]+>/g, '') // Remove all remaining HTML tags
    .replace(/&nbsp;/g, ' ') // Convert non-breaking spaces
    .replace(/&amp;/g, '&') // Convert HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Handle image placeholders like Gmail does
  cleaned = cleaned
    .replace(/\[cid:image[^\]]+\]/gi, '[Image]') // Replace image placeholders with [Image]
    .replace(/\[cid:[^\]]+\]/gi, '[Attachment]'); // Replace other cid references
  
  // Normalize whitespace
  cleaned = cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
    .trim();
  
  // Remove common email artifacts
  cleaned = cleaned
    .replace(/^On .+ wrote:$/gm, '') // Remove "On [date] wrote:" lines
    .replace(/^From: .+$/gm, '') // Remove "From:" lines
    .replace(/^Sent: .+$/gm, '') // Remove "Sent:" lines
    .replace(/^To: .+$/gm, '') // Remove "To:" lines
    .replace(/^Subject: .+$/gm, '') // Remove "Subject:" lines
    .replace(/^Date: .+$/gm, '') // Remove "Date:" lines
    .trim();
  
  // Remove quoted text lines (lines starting with > or multiple >)
  // This cleans up reply chains that show as > > > >
  const lines = cleaned.split('\n');
  let inQuotedSection = false;
  let quoteStartIndex = -1;
  
  // Find where quoted section starts (look for lines with > or "On ... wrote:")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this is the start of quoted text
    if (line.startsWith('>') || 
        /^On .+ wrote:/.test(line) ||
        /^From:/.test(line) && /^Sent:/.test(lines[i + 1]?.trim() || '')) {
      inQuotedSection = true;
      if (quoteStartIndex === -1) {
        quoteStartIndex = i;
      }
    }
    
    // If we're in quoted section, remove lines starting with >
    if (inQuotedSection && line.startsWith('>')) {
      lines[i] = ''; // Remove quoted lines
    }
  }
  
  // If we found a quoted section start, remove everything from there
  if (quoteStartIndex !== -1 && quoteStartIndex < lines.length) {
    // Keep a few lines before the quote as context, but remove the quoted section
    const linesBeforeQuote = lines.slice(0, quoteStartIndex);
    cleaned = linesBeforeQuote.join('\n').trim();
  } else {
    cleaned = lines.filter(line => line.trim().length > 0).join('\n');
  }
  
  // Clean up any remaining > characters that might have slipped through
  cleaned = cleaned
    .replace(/^>\s*/gm, '') // Remove > at start of lines
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple blank lines
    .trim();
  
  return cleaned;
};

// Gmail-style signature detection and separation
const separateContentAndSignature = (content: string): {content: string, signature: string} => {
  if (!content) return {content: '', signature: ''};
  
  // Common signature patterns (like Gmail uses)
  const signaturePatterns = [
    // Phone numbers
    /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/,
    // Email addresses
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    // Common signature phrases
    /(best regards|sincerely|thanks|thank you|regards|cheers|kind regards)/i,
    // Company names with common suffixes
    /(inc\.|llc\.|corp\.|ltd\.|company|group)/i,
    // Address patterns
    /(\d+\s+[a-zA-Z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|way|place|pl))/i,
    // Disclaimer patterns
    /(confidentiality|disclaimer|warning|notice|terms and conditions)/i
  ];
  
  const lines = content.split('\n');
  let contentEndIndex = lines.length;
  
  // Look for signature starting from the end
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Check if this line matches signature patterns
    const isSignatureLine = signaturePatterns.some(pattern => pattern.test(line));
    
    if (isSignatureLine) {
      contentEndIndex = i;
      break;
    }
    
    // If we've gone back more than 10 lines, probably not a signature
    if (lines.length - i > 10) break;
  }
  
  const mainContent = lines.slice(0, contentEndIndex).join('\n').trim();
  const signature = lines.slice(contentEndIndex).join('\n').trim();
  
  return {
    content: mainContent,
    signature: signature
  };
};

// Gmail-style attachment utilities
const getFileIcon = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎥';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📽️';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '📦';
  if (mimeType.includes('text/')) return '📄';
  return '📎';
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getFileTypeColor = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return 'bg-green-100 text-green-800';
  if (mimeType.startsWith('video/')) return 'bg-purple-100 text-purple-800';
  if (mimeType.startsWith('audio/')) return 'bg-blue-100 text-blue-800';
  if (mimeType.includes('pdf')) return 'bg-red-100 text-red-800';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'bg-blue-100 text-blue-800';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'bg-green-100 text-green-800';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'bg-orange-100 text-orange-800';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return 'bg-gray-100 text-gray-800';
  return 'bg-gray-100 text-gray-800';
};

// Parse email chains and separate messages
const parseEmailChain = (content: string): Array<{sender: string, content: string, timestamp?: string}> => {
  const messages: Array<{sender: string, content: string, timestamp?: string}> = [];
  
  // Common email chain separators
  const separators = [
    /^From:.*?Sent:.*?To:.*?Subject:.*?$/gm,
    /^On.*?wrote:$/gm,
    /^-----Original Message-----$/gm,
    /^---------- Forwarded message ---------$/gm,
    /^Begin forwarded message:$/gm
  ];
  
  let currentContent = content;
  let lastIndex = 0;
  
  for (const separator of separators) {
    const matches = [...currentContent.matchAll(separator)];
    
    for (const match of matches) {
      if (match.index !== undefined && match.index > lastIndex) {
        const messageContent = currentContent.slice(lastIndex, match.index).trim();
        if (messageContent) {
          // Extract sender from the separator
          const senderMatch = match[0].match(/From:\s*(.+?)(?:\n|$)/);
          const sender = senderMatch ? senderMatch[1].trim() : 'Unknown';
          
          messages.push({
            sender,
            content: formatEmailContent(messageContent)
          });
        }
        lastIndex = match.index + match[0].length;
      }
    }
  }
  
  // Add the last message
  if (lastIndex < currentContent.length) {
    const lastMessage = currentContent.slice(lastIndex).trim();
    if (lastMessage) {
      messages.push({
        sender: 'Current',
        content: formatEmailContent(lastMessage)
      });
    }
  }
  
  return messages.length > 0 ? messages : [{sender: 'Current', content: formatEmailContent(content)}];
};

// Enhanced markdown-like formatting for email content
const formatEmailMarkdown = (content: string): string => {
  if (!content) return '';
  
  let formatted = content;
  
  // Bold text (**text** or __text__)
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // Italic text (*text* or _text_)
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
  
  // Links
  formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">$1</a>');
  
  // Email addresses
  formatted = formatted.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1" class="text-blue-600 hover:text-blue-800 underline">$1</a>');
  
  // Lists
  formatted = formatted.replace(/^[\s]*[-*+]\s+(.+)$/gm, '<li class="ml-4">$1</li>');
  formatted = formatted.replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');
  
  // Line breaks
  formatted = formatted.replace(/\n/g, '<br>');
  
  return formatted;
};

// Helper function to extract ONLY forwarded content (for logistics processing)
const extractForwardedContent = (body: string): string => {
  const forwardMarkers = [
    '---------- Forwarded message ---------',
    '-------- Forwarded Message --------',
    '--- Forwarded message ---',
    'Begin forwarded message:',
    'Forwarded message:'
  ];
  
  for (const marker of forwardMarkers) {
    if (body.includes(marker)) {
      const parts = body.split(marker);
      let forwarded = parts[1] || body;
      
      // Remove common signature patterns from forwarded content
      const signaturePatterns = [
        /--\s*$/m,  // Signature delimiter
        /^(Best regards?|Regards?|Thanks?|Thank you|Sincerely|Cheers)[\s\S]*$/mi,
        /Production Associate.*$/mi,
        /\d+ Todd Road.*$/mi,
        /O: \(\+\d+\).*$/mi,
        /M: \(\+\d+\).*$/mi,
        /W: https?:\/\/.*$/mi
      ];
      
      for (const pattern of signaturePatterns) {
        forwarded = forwarded.replace(pattern, '');
      }
      
      return forwarded.trim();
    }
  }
  
  return body; // Return full body if no forward marker found
};

// Simple email body component
const EmailBody: React.FC<{ body: string }> = ({ body }) => {
  return (
    <div className="email-body text-gray-700 leading-relaxed whitespace-pre-wrap">
      {body}
    </div>
  );
};

// Gmail-style email card component
const EmailCard: React.FC<{
  email: Email;
  isLogistics: boolean;
  onClick: () => void;
  isSelected: boolean;
}> = ({ email, isLogistics, onClick, isSelected }) => (
  <div 
    className={`email-card bg-white p-4 rounded-lg shadow hover:shadow-md cursor-pointer transition-shadow ${
      isSelected ? 'border-2 border-blue-500' : 'border border-gray-200'
    }`}
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-2">
      <span className="font-medium text-gray-900">{email.from}</span>
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-500">
          {new Date(email.timestamp).toLocaleTimeString()}
        </span>
        {isLogistics && (
          <span className="badge bg-orange-500 text-white px-2 py-1 rounded text-xs">
            📦 Logistics
          </span>
        )}
      </div>
    </div>
    <div className="font-medium text-gray-800 mb-1">{email.subject}</div>
    <div className="text-sm text-gray-600 truncate">{email.snippet}</div>
  </div>
);

// Extract sales order data from Carolina's email
const extractSalesOrderData = (emailContent: string): {
  soNumber: string;
  batch: string;
  weight: string;
  companyName: string;
  found: boolean;
} => {
  const data = {
    soNumber: '',
    batch: '',
    weight: '',
    companyName: '',
    found: false
  };

  // Common patterns in Carolina's emails
  // SO Number patterns: SO-XXXX, SO XXXX, Sales Order: XXXX, SO#XXXX
  const soPattern = /(?:SO[-\s#]?|Sales\s*Order:?\s*)(\d{4,6})/i;
  const soMatch = emailContent.match(soPattern);
  if (soMatch) {
    data.soNumber = soMatch[1];
    data.found = true;
  }

  // Batch patterns: Batch: XXX, Batch No: XXX, Batch#XXX, "Batch number XXX"
  // Looking for patterns like "Batch number NT4J28T025"
  const batchPattern = /Batch\s*(?:number|No\.?|#)?:?\s*([A-Z0-9]+)/i;
  const batchMatch = emailContent.match(batchPattern);
  if (batchMatch) {
    data.batch = batchMatch[1];
  }

  // Weight patterns: "920 kg Total Net weight"
  const weightPattern = /(\d+(?:\.\d+)?)\s*(kg|lbs?|pounds?)\s*(?:Total\s*Net\s*weight)?/i;
  const weightMatch = emailContent.match(weightPattern);
  if (weightMatch) {
    data.weight = weightMatch[1] + ' ' + weightMatch[2];
  }

  // Company name - MUST be in sales order emails, be aggressive about finding it
  let companyName = '';
  
  // Multiple strategies to find company name
  const strategies = [
    // Strategy 1: Look for explicit company labels
    () => {
      const patterns = [
        /(?:Company|Customer|Client|Ship\s*to|Bill\s*to|To|For):\s*([A-Za-z0-9\s&.,'-]+?)(?:\n|$|,|\.)/i,
        /(?:Company|Customer|Client|Ship\s*to|Bill\s*to|To|For):\s*([A-Za-z0-9\s&.,'-]+)/i
      ];
      for (const pattern of patterns) {
        const match = emailContent.match(pattern);
        if (match && match[1].trim().length > 2) {
          return match[1].trim();
        }
      }
      return null;
    },
    
    // Strategy 2: Look for company suffixes in any line
    () => {
      const lines = emailContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.match(/\b(Inc|Ltd|Corp|LLC|Company|Co\.|Limited|Incorporated|Ltd\.|Inc\.|Group|Industries|Manufacturing|Solutions|Systems|Technologies|Enterprises|Associates|Partners)\b/i)) {
          // Clean up the line to get just the company name
          const cleaned = trimmed.replace(/^(Company|Customer|Client|Ship\s*to|Bill\s*to|To|For):\s*/i, '').trim();
          if (cleaned.length > 3) {
            return cleaned;
          }
        }
      }
      return null;
    },
    
    // Strategy 3: Look for lines that look like company names (proper case, reasonable length)
    () => {
      const lines = emailContent.split('\n');
      for (const line of lines.slice(0, 15)) { // Check first 15 lines
        const trimmed = line.trim();
        
        // Skip obvious non-company lines
        if (!trimmed || 
            trimmed.length < 4 || 
            trimmed.length > 100 ||
            trimmed.match(/^(Hi|Hello|Dear|Good|Please|Thank|From|To|Date|Subject|Sales|Order|Batch|Weight|SO|Number)/i) ||
            trimmed.includes('@') ||
            trimmed.match(/^\d+$/) ||
            trimmed.match(/^\d{4}-\d{2}-\d{2}/) ||
            trimmed.match(/^[A-Za-z\s]+:$/)) {
          continue;
        }
        
        // Look for proper case company names
        if (trimmed.match(/^[A-Z][a-zA-Z0-9\s&.,'-]+$/) && 
            !trimmed.match(/^(the|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|will|would|could|should)$/i)) {
          return trimmed;
        }
      }
      return null;
    },
    
    // Strategy 4: Look for any capitalized words that could be company names
    () => {
      const words = emailContent.split(/\s+/);
      let potentialCompany = '';
      
      for (let i = 0; i < words.length - 1; i++) {
        const word = words[i].replace(/[^\w]/g, '');
        const nextWord = words[i + 1].replace(/[^\w]/g, '');
        
        // Look for two consecutive capitalized words
        if (word.match(/^[A-Z][a-z]+$/) && nextWord.match(/^[A-Z][a-z]+$/)) {
          potentialCompany = words[i] + ' ' + words[i + 1];
          break;
        }
      }
      
      return potentialCompany || null;
    }
  ];
  
  // Try each strategy until we find a company name
  for (const strategy of strategies) {
    const result = strategy();
    if (result && result.length > 2) {
      companyName = result;
      break;
    }
  }
  
  data.companyName = companyName;

  return data;
};


// Logistics panel component
const LogisticsPanel: React.FC<{
  result: any;
  documents: any[];
  onDownload: (url: string, filename: string) => void;
}> = ({ result, documents, onDownload }) => (
  <div className="logistics-panel bg-blue-50 p-4 rounded-lg mt-4">
    <h3 className="text-lg font-semibold text-blue-800 mb-3">Generated Documents</h3>
    {documents.map((doc, idx) => (
      <div key={idx} className="document-item flex items-center justify-between bg-white p-3 rounded border mb-2">
        <span className="text-gray-700">{doc.document_type}</span>
        <button 
          onClick={() => onDownload(doc.download_url, doc.filename)}
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
        >
          Download
        </button>
      </div>
    ))}
  </div>
);

// Get initials from email/name
const getInitials = (nameOrEmail: string): string => {
  const name = nameOrEmail.split('@')[0];
  return name
    .split(/[._-]/)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || name.slice(0, 2).toUpperCase();
};

// Get color for avatar based on email
const getAvatarColor = (email: string): string => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
    'bg-pink-500', 'bg-indigo-500', 'bg-red-500',
    'bg-yellow-500', 'bg-orange-500', 'bg-teal-500'
  ];
  const index = email.charCodeAt(0) % colors.length;
  return colors[index];
};

// Format detailed timestamp
const formatDetailedTimestamp = (timestamp: string): { relative: string; absolute: string } => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let relative = '';
  if (diffMins < 1) relative = 'Just now';
  else if (diffMins < 60) relative = `${diffMins} minutes ago`;
  else if (diffHours < 24) relative = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  else if (diffDays === 1) relative = 'Yesterday';
  else if (diffDays < 7) relative = `${diffDays} days ago`;
  else relative = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const absolute = date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return { relative, absolute };
};

// Enhanced Email Content Display Component
const EnhancedEmailContent: React.FC<{
  content: string;
  viewMode: 'formatted' | 'raw' | 'chain';
  sender: string;
  timestamp: string;
  onViewModeChange: (mode: 'formatted' | 'raw' | 'chain') => void;
}> = ({ content, viewMode, sender, timestamp, onViewModeChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const renderContent = () => {
    switch (viewMode) {
      case 'raw':
        return (
          <pre className="whitespace-pre-wrap text-xs bg-gray-100 p-3 rounded border font-mono">
            {content}
          </pre>
        );
      
      case 'chain':
        const chainMessages = parseEmailChain(content);
        return (
          <div className="space-y-4">
            {chainMessages.map((message, index) => (
              <div key={index} className="border-l-4 border-blue-200 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <Quote className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    {message.sender}
                  </span>
                  {index === chainMessages.length - 1 && (
                    <span className="text-xs text-gray-500">(Latest)</span>
                  )}
                </div>
                <div 
                  className="text-sm text-gray-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: formatEmailMarkdown(message.content) 
                  }}
                />
              </div>
            ))}
          </div>
        );
      
      case 'formatted':
      default:
        return (
          <div 
            className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ 
              __html: formatEmailMarkdown(formatEmailContent(content)) 
            }}
          />
        );
    }
  };

  const shouldTruncate = content.length > 500;
  const displayContent = shouldTruncate && !isExpanded 
    ? content.substring(0, 500) + '...' 
    : content;

  return (
    <div className="space-y-3">
      {/* Email Actions Bar */}
      <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewModeChange('formatted')}
            className={`px-3 py-1 text-xs rounded ${
              viewMode === 'formatted' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Formatted
          </button>
          <button
            onClick={() => onViewModeChange('chain')}
            className={`px-3 py-1 text-xs rounded ${
              viewMode === 'chain' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Chain
          </button>
          <button
            onClick={() => onViewModeChange('raw')}
            className={`px-3 py-1 text-xs rounded ${
              viewMode === 'raw' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Raw
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="p-1 text-gray-500 hover:text-gray-700">
            <Reply className="w-4 h-4" />
          </button>
          <button className="p-1 text-gray-500 hover:text-gray-700">
            <Forward className="w-4 h-4" />
          </button>
          <button className="p-1 text-gray-500 hover:text-gray-700">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Display */}
      <div className="min-h-[200px]">
        {renderContent()}
      </div>

      {/* Expand/Collapse for long content */}
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          {isExpanded ? 'Show Less' : 'Show More'}
        </button>
      )}
    </div>
  );
};

// Gmail-style attachment component
const GmailAttachment: React.FC<{
  attachment: EmailAttachment;
  onDownload?: (attachment: EmailAttachment) => void;
  onPreview?: (attachment: EmailAttachment) => void;
}> = ({ attachment, onDownload, onPreview }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const handleDownload = () => {
    if (onDownload) {
      onDownload(attachment);
    } else if (attachment.downloadUrl) {
      window.open(attachment.downloadUrl, '_blank');
    }
  };
  
  const handlePreview = () => {
    if (onPreview) {
      onPreview(attachment);
    }
  };
  
  const isImage = attachment.mimeType.startsWith('image/');
  const isPreviewable = isImage || attachment.mimeType.includes('pdf');
  
  return (
    <div 
      className={`flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors ${
        isHovered ? 'bg-gray-50' : 'bg-white'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* File icon */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${getFileTypeColor(attachment.mimeType)}`}>
        {getFileIcon(attachment.mimeType)}
      </div>
      
      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-900 truncate">
          {attachment.filename}
        </div>
        <div className="text-xs text-gray-500">
          {formatFileSize(attachment.size)} • {attachment.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-1">
        {isPreviewable && (
          <button
            onClick={handlePreview}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Preview"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleDownload}
          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Format email timestamp utility function
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};


// Spark-style Message Card Component
const SparkMessageCard: React.FC<{
  email: Email;
  isExpanded: boolean;
  onToggle: () => void;
  isFirst: boolean;
  isLast: boolean;
  threadIndex: number;
  isCarolinaEmail?: boolean;
  onProcessLogistics?: (email: Email) => void;
  isProcessingLogistics?: boolean;
  logisticsResult?: any;
  onReply?: (email: Email) => void;
  onAIReply?: (email: Email) => void;
  onCompose?: (email?: Email) => void;
  onSaveDraft?: (email: Email) => void;
  hasLearnedFromSent?: boolean;
  showAiReply?: boolean;
  setShowAiReply?: (show: boolean) => void;
  replyToEmail?: Email | null;
  aiReplyText?: string;
  isGeneratingReply?: boolean;
  onSendAIReply?: () => void;
  onEditAIReply?: () => void;
  onSaveAIReplyAsDraft?: () => void;
}> = ({ email, isExpanded, onToggle, isFirst, isLast, threadIndex, isCarolinaEmail, onProcessLogistics, isProcessingLogistics, logisticsResult, onReply, onAIReply, onCompose, onSaveDraft, hasLearnedFromSent = false, showAiReply = false, setShowAiReply, replyToEmail, aiReplyText = '', isGeneratingReply = false, onSendAIReply, onEditAIReply, onSaveAIReplyAsDraft }) => {
  const [showActions, setShowActions] = useState(false);
  const initials = getInitials(email.from);
  const avatarColor = getAvatarColor(email.from);
  const { relative: relativeTime, absolute: absoluteTime } = formatDetailedTimestamp(email.timestamp);
  
  // Clean content and separate signature
  const cleanedContent = formatEmailContent(email.body || email.snippet);
  const { content: mainContent, signature } = separateContentAndSignature(cleanedContent);
  
  // Detect forwarded message section
  const forwardMarkers = [
    '---------- Forwarded message ----------',
    '-------- Forwarded Message --------',
    '--- Forwarded message ---',
    'Begin forwarded message:',
    '----- Forwarded message -----'
  ];
  
  let isForwardedMessage = false;
  let forwardedStartIndex = -1;
  
  const lines = mainContent.split('\n');
  
  // Check for forwarded message markers
  for (let i = 0; i < lines.length; i++) {
    if (forwardMarkers.some(marker => lines[i].includes(marker))) {
      isForwardedMessage = true;
      forwardedStartIndex = i;
      break;
    }
  }
  
  // If not found by markers, check for common forward patterns
  if (!isForwardedMessage) {
    const quotedStartIndex = lines.findIndex((line, idx) => 
      line.includes('wrote:') || 
      line.startsWith('>') || 
      (line.includes('From:') && lines[idx + 1]?.includes('Sent:')) ||
      line.includes('-------- Original Message')
    );
    
    if (quotedStartIndex !== -1) {
      forwardedStartIndex = quotedStartIndex;
    }
  }
  
  const hasQuotedText = forwardedStartIndex !== -1;
  const primaryContent = hasQuotedText ? lines.slice(0, forwardedStartIndex).join('\n').trim() : mainContent;
  const quotedContent = hasQuotedText ? lines.slice(forwardedStartIndex).join('\n') : '';
  
  // Parse forwarded message metadata if present
  let forwardedFrom = '';
  let forwardedDate = '';
  let forwardedSubject = '';
  
  if (isForwardedMessage && quotedContent) {
    const forwardedLines = quotedContent.split('\n');
    forwardedLines.forEach((line, idx) => {
      if (line.startsWith('From:')) forwardedFrom = line.substring(5).trim();
      if (line.startsWith('Date:') || line.startsWith('Sent:')) forwardedDate = line.substring(5).trim();
      if (line.startsWith('Subject:')) forwardedSubject = line.substring(8).trim();
    });
  }
  
  return (
    <div className={`relative ${!isFirst ? 'mt-4' : ''}`}>
      {/* Thread Connector Line */}
      {!isFirst && (
        <div className="absolute left-5 top-0 w-0.5 h-4 bg-gray-300"></div>
      )}
      
      {/* Message Card */}
      <div 
        className={`
          bg-white rounded-xl border transition-all duration-300
          ${isExpanded ? 'border-blue-400 shadow-xl ring-2 ring-blue-100 shadow-blue-100/50' : 'border-gray-200 hover:shadow-lg hover:border-gray-300 shadow-md'}
          ${!isLast ? 'mb-4' : ''}
          ${!isFirst ? 'ml-6' : ''}
        `}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
      {/* Message Header - Always Visible */}
      <div 
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {/* Avatar with Thread Connector */}
          <div className="relative flex-shrink-0">
            <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-medium text-sm`}>
              {initials}
            </div>
            {/* Thread connector dot */}
            {!isLast && (
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-300 rounded-full"></div>
            )}
          </div>
          
          {/* Sender Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{email.from}</span>
              {threadIndex > 0 && !isForwardedMessage && (
                <span className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                  Reply {threadIndex}
                </span>
              )}
              {(isForwardedMessage || email.subject?.toLowerCase().includes('fwd:') || email.subject?.toLowerCase().includes('fw:')) && (
                <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                  FWD
                </span>
              )}
              {email.hasAttachments && (
                <Paperclip className="w-3 h-3 text-gray-400" />
              )}
            </div>
            {!isExpanded && (
              <p className="text-sm text-gray-600 truncate">
                {primaryContent.substring(0, 100)}...
              </p>
            )}
          </div>
        </div>
        
        {/* Timestamp & Actions */}
        <div className="flex items-center gap-3">
          <span 
            className="text-sm text-gray-500 whitespace-nowrap"
            title={absoluteTime}
          >
            {relativeTime}
          </span>
          <ChevronDown 
            className={`w-4 h-4 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>
      
      {/* Expanded Content */}
      {isExpanded && (
        <>
          <div className="px-4 pb-4">
            {/* Full timestamp when expanded */}
            <div className="text-xs text-gray-500 mb-3 ml-14">
              {absoluteTime}
            </div>
            
            {/* Email Content */}
            <div className="px-4">
              <div className="text-gray-700 leading-relaxed text-sm break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                <div className="whitespace-pre-wrap">
                  {primaryContent}
                </div>
                
                {/* AI Reply Display - Show directly below this specific email */}
                {showAiReply && replyToEmail?.id === email.id && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-blue-900">🤖 AI Generated Reply</h4>
                      <button
                        onClick={() => setShowAiReply && setShowAiReply(false)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {isGeneratingReply ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600 mr-2" />
                        <span className="text-blue-600 text-sm">Generating AI reply...</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-white border border-blue-200 rounded p-3">
                          <div className="text-xs text-gray-600 mb-2">
                            <strong>To:</strong> {replyToEmail?.from}
                          </div>
                          <div className="text-xs text-gray-600 mb-2">
                            <strong>Subject:</strong> {replyToEmail?.subject.startsWith('Re:') ? replyToEmail.subject : `Re: ${replyToEmail?.subject}`}
                          </div>
                          <div className="text-sm text-gray-900 whitespace-pre-wrap">{aiReplyText}</div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={onSendAIReply}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            Send
                          </button>
                          <button
                            onClick={onEditAIReply}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={onSaveAIReplyAsDraft}
                            className="px-3 py-1.5 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 flex items-center gap-1"
                          >
                            <BookOpen className="w-3 h-3" />
                            Save Draft
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Forwarded Message Section */}
                {isForwardedMessage && hasQuotedText && (
                  <div className="mt-4">
                    <div className="border-t-2 border-gray-300 pt-4">
                      <div className="text-sm font-medium text-gray-600 mb-3">
                        ---------- Forwarded message ----------
                      </div>
                      {forwardedFrom && (
                        <div className="text-sm text-gray-600 mb-1">
                          <span className="font-medium">From:</span> {forwardedFrom}
                        </div>
                      )}
                      {forwardedDate && (
                        <div className="text-sm text-gray-600 mb-1">
                          <span className="font-medium">Date:</span> {forwardedDate}
                        </div>
                      )}
                      {forwardedSubject && (
                        <div className="text-sm text-gray-600 mb-3">
                          <span className="font-medium">Subject:</span> {forwardedSubject}
                        </div>
                      )}
                      <details open>
                        <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 flex items-center gap-1 mb-2">
                          <span className="text-xs">•••</span>
                          {isForwardedMessage ? 'Hide forwarded message' : 'Show forwarded message'}
                        </summary>
                        <div className="pl-4 border-l-2 border-gray-300 text-gray-600 text-sm bg-gray-50 p-3 rounded-r break-words whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                          {quotedContent.replace(/^>\s*/gm, '').trim()}
                        </div>
                      </details>
                    </div>
                  </div>
                )}
                
                {/* Regular Quoted Text (for replies) */}
                {!isForwardedMessage && hasQuotedText && (
                  <details className="mt-4">
                    <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 flex items-center gap-1 font-medium">
                      <span className="text-xs">•••</span>
                      Show quoted text
                    </summary>
                    <div className="mt-2 pl-4 border-l-2 border-gray-300 text-gray-600 text-sm bg-gray-50 p-3 rounded-r break-words whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                      {quotedContent.replace(/^>\s*/gm, '').replace(/^>\s*/gm, '').trim()}
                    </div>
                  </details>
                )}
                
                {/* Signature */}
                {signature && (
                  <details className="mt-4">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      Show signature
                    </summary>
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded border-l-2 border-gray-300">
                      <div className="whitespace-pre-wrap">{signature}</div>
                    </div>
                  </details>
                )}
              </div>
              
              {/* Attachments */}
              {email.attachments && email.attachments.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm text-gray-600 mb-2">Attachments</div>
                  <div className="flex flex-wrap gap-2">
                    {email.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        <Paperclip className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">{attachment.filename}</span>
                        <span className="text-xs text-gray-500">
                          ({formatFileSize(attachment.size)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Carolina Sales Order Alert - Use real logistics data */}
              {isCarolinaEmail && logisticsResult && (
                <div className="mt-4 p-4 bg-orange-50 border-2 border-orange-300 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Truck className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-orange-900 mb-2">
                        📦 Sales Order Detected
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                          <span className="text-sm font-medium text-gray-700">SO Number:</span>
                          <p className="text-sm text-gray-900 font-mono">{logisticsResult.so_data?.so_number || logisticsResult.email_data?.so_number || 'Not found'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Customer:</span>
                          <p className="text-sm text-gray-900">{logisticsResult.so_data?.customer_name || logisticsResult.email_data?.company_name || 'Not found'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Batch Numbers:</span>
                          <p className="text-sm text-gray-900 font-mono">{logisticsResult.email_data?.batch_numbers || logisticsResult.email_shipping?.batch_numbers || 'Not found'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Weight:</span>
                          <p className="text-sm text-gray-900 font-mono">{logisticsResult.email_data?.total_weight || logisticsResult.email_shipping?.total_weight || 'Not found'}</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => onProcessLogistics && onProcessLogistics(email)}
                        disabled={isProcessingLogistics}
                        className="w-full bg-orange-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isProcessingLogistics ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4" />
                            Process with Logistics Automation
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          

          {/* Spark-like Action Bar */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
        <button
          onClick={() => onReply && onReply(email)}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-white rounded-lg flex items-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Reply className="w-4 h-4" />
          Reply
        </button>
                <button
                  onClick={() => onAIReply && onAIReply(email)}
                  disabled={!hasLearnedFromSent}
                  className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md ${
                    hasLearnedFromSent 
                      ? 'text-blue-700 hover:text-blue-900 hover:bg-blue-50' 
                      : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                  }`}
                  title={hasLearnedFromSent ? 'Generate AI Reply' : 'Learn from sent emails first'}
                >
                  <Brain className="w-4 h-4" />
                  AI Reply
                </button>
                <button 
                  onClick={() => onCompose && onCompose(email)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-white rounded-lg flex items-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <Mail className="w-4 h-4" />
                  Compose
                </button>
                <button
                  onClick={() => onSaveDraft && onSaveDraft(email)}
                  className="px-4 py-2 text-sm font-medium text-orange-700 hover:text-orange-900 hover:bg-orange-50 rounded-lg flex items-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <BookOpen className="w-4 h-4" />
                  Draft
                </button>
                <button className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-white rounded-lg flex items-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md">
                  <Forward className="w-4 h-4" />
                  Forward
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Quick Actions (shown on hover when collapsed) */}
      {!isExpanded && showActions && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white rounded-md shadow-lg border border-gray-200 p-1">
          <button className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
            <Reply className="w-4 h-4" />
          </button>
          <button className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
            <Forward className="w-4 h-4" />
          </button>
          <button className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      )}
      </div>
    </div>
  );
};

// Gmail-style conversation message component (keeping for backwards compatibility)
const ConversationMessage: React.FC<{
  content: string;
  sender: string;
  timestamp: string;
  isLatest: boolean;
  isForwarded?: boolean;
}> = ({ content, sender, timestamp, isLatest, isForwarded = false }) => {
  const cleanedContent = formatEmailContent(content);
  const { content: mainContent, signature } = separateContentAndSignature(cleanedContent);
  
  return (
    <div className={`border-l-4 ${isLatest ? 'border-blue-500' : 'border-gray-200'} pl-4 py-3`}>
      {/* Message header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900">{sender}</span>
          {isForwarded && (
            <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
              FWD
            </span>
          )}
          {isLatest && (
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
              Latest
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">{formatTimestamp(timestamp)}</span>
      </div>
      
      {/* Message content */}
      <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
        <div 
          dangerouslySetInnerHTML={{ 
            __html: formatEmailMarkdown(mainContent) 
          }}
        />
      </div>
      
      {/* Signature (collapsed by default) */}
      {signature && (
        <details className="mt-2">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            Show signature
          </summary>
          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-1 border-l-2 border-gray-300">
            <div 
              dangerouslySetInnerHTML={{ 
                __html: formatEmailMarkdown(signature) 
              }}
            />
          </div>
        </details>
      )}
    </div>
  );
};

// Gmail-style email content component with conversation view
const GmailStyleEmailContent: React.FC<{
  content: string;
  sender: string;
  timestamp: string;
  attachments?: EmailAttachment[];
  thread?: EmailThread;
}> = ({ content, sender, timestamp, attachments = [], thread }) => {
  const [showSignature, setShowSignature] = useState(false);
  const [showAttachments, setShowAttachments] = useState(true);
  const [conversationView, setConversationView] = useState(true);
  
  const cleanedContent = formatEmailContent(content);
  const { content: mainContent, signature } = separateContentAndSignature(cleanedContent);
  
  const handleDownloadAttachment = (attachment: EmailAttachment) => {
    // Implement download logic
    console.log('Downloading attachment:', attachment);
  };
  
  const handlePreviewAttachment = (attachment: EmailAttachment) => {
    // Implement preview logic
    console.log('Previewing attachment:', attachment);
  };
  
  // If we have a thread with multiple emails, show conversation view
  if (thread && thread.emails.length > 1 && conversationView) {
    return (
      <div className="space-y-1">
        {/* Conversation header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Conversation Thread</h3>
                <p className="text-sm text-gray-600">{thread.emails.length} messages • {thread.subject}</p>
              </div>
            </div>
          <button
            onClick={() => setConversationView(!conversationView)}
              className="px-4 py-2 text-sm font-medium text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded-lg transition-all duration-200 flex items-center gap-2"
          >
              {conversationView ? 'Single View' : 'Thread View'}
            <ChevronDown className={`w-4 h-4 transition-transform ${conversationView ? 'rotate-180' : ''}`} />
          </button>
          </div>
        </div>
        
        {/* Conversation messages */}
        <div className="space-y-4">
          {thread.emails.map((email, index) => (
            <ConversationMessage
              key={email.id}
              content={email.body || email.snippet}
              sender={email.from}
              timestamp={email.timestamp}
              isLatest={index === thread.emails.length - 1}
              isForwarded={thread.isForwarded}
            />
          ))}
        </div>
        
        {/* Attachments section */}
        {attachments.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <button
              onClick={() => setShowAttachments(!showAttachments)}
              className="text-sm text-gray-700 hover:text-gray-900 flex items-center gap-2 mb-3 font-medium"
            >
              <Paperclip className="w-4 h-4" />
              {attachments.length} attachment{attachments.length !== 1 ? 's' : ''}
              {showAttachments ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            
            {showAttachments && (
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <GmailAttachment
                    key={attachment.id}
                    attachment={attachment}
                    onDownload={handleDownloadAttachment}
                    onPreview={handlePreviewAttachment}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  
  // Single message view
  return (
    <div className="space-y-4">
      {/* Main email content */}
      <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
        <div 
          dangerouslySetInnerHTML={{ 
            __html: formatEmailMarkdown(mainContent) 
          }}
        />
      </div>
      
      {/* Attachments section */}
      {attachments.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <button
            onClick={() => setShowAttachments(!showAttachments)}
            className="text-sm text-gray-700 hover:text-gray-900 flex items-center gap-2 mb-3 font-medium"
          >
            <Paperclip className="w-4 h-4" />
            {attachments.length} attachment{attachments.length !== 1 ? 's' : ''}
            {showAttachments ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          
          {showAttachments && (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <GmailAttachment
                  key={attachment.id}
                  attachment={attachment}
                  onDownload={handleDownloadAttachment}
                  onPreview={handlePreviewAttachment}
                />
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Signature section */}
      {signature && (
        <div className="border-t border-gray-200 pt-4">
          <button
            onClick={() => setShowSignature(!showSignature)}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
          >
            {showSignature ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Hide signature
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                Show signature
              </>
            )}
          </button>
          
          {showSignature && (
            <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded border-l-2 border-gray-300">
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: formatEmailMarkdown(signature) 
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Enhanced Email Card Component
const EnhancedEmailCard: React.FC<{
  email: Email;
  thread?: EmailThread;
  isSelected: boolean;
  onClick: () => void;
  onThreadClick?: () => void;
  threadCount?: number;
  isExpanded?: boolean;
}> = ({ email, thread, isSelected, onClick, onThreadClick, threadCount, isExpanded }) => {
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
      <div
        className={`border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-all duration-200 ${
          isSelected ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-l-blue-600 shadow-sm' : ''
        }`}
        onClick={onClick}
      >
        <div className="px-4 py-3">
        <div className="flex items-start justify-between mb-1 gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate" title={email.subject}>
              {email.subject}
              {thread?.isForwarded && (
                <span className="ml-2 text-xs text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                  FWD
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-600 truncate" title={email.from}>
              {email.from}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {formatTimestamp(email.timestamp)}
            </span>
          </div>
        </div>
        
        <p className="text-xs text-gray-600 line-clamp-1 mb-1">
          {email.snippet}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {threadCount && threadCount > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onThreadClick?.();
                }}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                {threadCount}
              </button>
            )}
            {email.hasAttachments && (
              <div className="flex items-center gap-1">
                <Paperclip className="w-3 h-3 text-gray-500" />
                <span className="text-xs text-gray-500">
                  {email.attachments?.length || 1}
                </span>
              </div>
            )}
          </div>
          
          {/* Email status indicators */}
          <div className="flex items-center gap-1">
            {/* Status indicators can be added here when needed */}
          </div>
        </div>
      </div>
    </div>
  );
};

export const GmailStyleEmail: React.FC<EmailAssistantProps> = ({ currentUser, setActiveSection }) => {
  // Essential state only
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  
  // Connection state cache to prevent excessive API calls
  const lastConnectionCheckRef = useRef<number>(0);
  const CONNECTION_CHECK_INTERVAL = 30000; // 30 seconds minimum between checks
  const [isLoading, setIsLoading] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [emailThreads, setEmailThreads] = useState<EmailThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [gmailEmail, setGmailEmail] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [isProcessingLogistics, setIsProcessingLogistics] = useState(false);
  const [logisticsDocuments, setLogisticsDocuments] = useState<any[]>([]);
  const [logisticsResult, setLogisticsResult] = useState<any>(null);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [emailViewMode, setEmailViewMode] = useState<'formatted' | 'raw' | 'chain'>('formatted');
  const [showEmailActions, setShowEmailActions] = useState(false);
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(new Set());
  
  // Email composition state
  const [showComposer, setShowComposer] = useState(false);
  const [composeEmail, setComposeEmail] = useState({
    to: '',
    subject: '',
    content: '',
    replyTo: null as Email | null
  });
  const [drafts, setDrafts] = useState<any[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  
  // AI Reply state
  const [aiReplyText, setAiReplyText] = useState<string>('');
  const [isGeneratingReply, setIsGeneratingReply] = useState<boolean>(false);
  
  // Load hasLearnedFromSent from localStorage on mount
  const [hasLearnedFromSent, setHasLearnedFromSent] = useState<boolean>(() => {
    return localStorage.getItem('ai-learned-from-sent') === 'true';
  });
  
  const [showAiReply, setShowAiReply] = useState<boolean>(false);
  const [replyToEmail, setReplyToEmail] = useState<Email | null>(null);
  
  // Gmail-style pagination state
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  
  // Gmail-style pagination constants
  const EMAILS_PER_PAGE = 25; // Gmail loads ~25 emails per page
  const MAX_THREAD_SIZE = 100; // Gmail splits threads at 100 emails

  // Group emails into threads
  // Gmail-style email threading with proper logic
  const groupEmailsIntoThreads = (emails: Email[]): EmailThread[] => {
    const threadMap = new Map<string, EmailThread>();
    
    emails.forEach(email => {
      // Check if this is a forwarded email (Gmail treats these as new threads)
      const isForwarded = email.subject.toLowerCase().includes('fwd:') || 
                         email.subject.toLowerCase().includes('fw:') ||
                         email.body.toLowerCase().includes('forwarded message');
      
      const threadId = email.threadId || email.id;
      
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, {
          threadId,
          subject: email.subject,
          emails: [],
          lastEmail: email,
          unreadCount: 0, // Default to read
          totalCount: 1,
          hasMoreMessages: false,
          isForwarded: isForwarded,
          referenceHeaders: []
        });
      }
      
      const thread = threadMap.get(threadId)!;
      
      // Gmail splits threads at 100 emails
      if (thread.emails.length >= MAX_THREAD_SIZE) {
        // Create new thread for overflow
        const newThreadId = `${threadId}_split_${Date.now()}`;
        threadMap.set(newThreadId, {
          threadId: newThreadId,
          subject: email.subject,
          emails: [email],
          lastEmail: email,
          unreadCount: 0, // Default to read
          totalCount: 1,
          hasMoreMessages: false,
          isForwarded: isForwarded,
          referenceHeaders: []
        });
      } else {
        thread.emails.push(email);
        thread.totalCount++;
        // Unread count logic can be added when needed
        
        // Update last email if this is newer
        if (new Date(email.timestamp) > new Date(thread.lastEmail.timestamp)) {
          thread.lastEmail = email;
        }
      }
    });
    
    // Sort emails within each thread by timestamp
    threadMap.forEach(thread => {
      thread.emails.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });
    
    // Convert to array and sort by last email timestamp
    return Array.from(threadMap.values()).sort(
      (a, b) => new Date(b.lastEmail.timestamp).getTime() - new Date(a.lastEmail.timestamp).getTime()
    );
  };


  // Toggle thread expansion
  const toggleThread = (threadId: string) => {
    const newExpanded = new Set(expandedThreads);
    if (newExpanded.has(threadId)) {
      newExpanded.delete(threadId);
    } else {
      newExpanded.add(threadId);
    }
    setExpandedThreads(newExpanded);
  };

  // Toggle message expansion
  const toggleMessage = (messageId: string) => {
    const newExpanded = new Set(expandedMessageIds);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedMessageIds(newExpanded);
  };

  // Download handler for logistics documents - use simple window.open to avoid CORS
  const handleDownload = (url: string, filename: string) => {
      const fullUrl = getApiUrl(url);
    window.open(fullUrl, '_blank');
  };

  // Email action handlers
  const handleReply = (email: Email) => {
    setComposeEmail({
      to: email.from,
      subject: email.subject?.startsWith('Re:') ? email.subject : `Re: ${email.subject || ''}`,
      content: `\n\n--- Original Message ---\nFrom: ${email.from}\nDate: ${email.timestamp}\nSubject: ${email.subject}\n\n${email.body || email.snippet}`,
      replyTo: email
    });
    setShowComposer(true);
  };

  const handleAIReply = (email: Email) => {
    setComposeEmail({
      to: email.from,
      subject: email.subject?.startsWith('Re:') ? email.subject : `Re: ${email.subject || ''}`,
      content: '',
      replyTo: email
    });
    setShowComposer(true);
  };

  const handleCompose = (email?: Email) => {
    setComposeEmail({
      to: email?.from || '',
      subject: '',
      content: '',
      replyTo: email || null
    });
    setShowComposer(true);
  };

  const handleSaveDraft = (email: Email) => {
    const draft = {
      id: Date.now().toString(),
      to: email.from,
      subject: `Draft: ${email.subject || 'New Email'}`,
      content: '',
      timestamp: new Date().toISOString(),
      replyTo: email
    };

    const updatedDrafts = [...drafts, draft];
    setDrafts(updatedDrafts);
    localStorage.setItem('email-drafts', JSON.stringify(updatedDrafts));
    alert('Draft saved!');
  };

  const checkGmailConnection = useCallback(async (force: boolean = false) => {
    const now = Date.now();
    
    // Skip if we checked recently and not forcing
    if (!force && (now - lastConnectionCheckRef.current) < CONNECTION_CHECK_INTERVAL) {
      console.log('⏭️ Skipping connection check - too recent');
      return;
    }
    
    try {
      const apiUrl = getApiUrl('/api/email/status');
      console.log('🔍 Checking Gmail connection status...', { apiUrl });
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      console.log('📡 Gmail connection status:', {
        connected: data.connected,
        email: data.email,
        hasToken: !!data.has_token,
        apiUrl
      });
      
      if (data.connected) {
        setIsGmailConnected(true);
        setGmailEmail(data.email || '');
        lastConnectionCheckRef.current = now;
        console.log('✅ Gmail connected:', data.email);
        // Note: fetchEmails will be triggered by useEffect when isGmailConnected becomes true
      } else {
        setIsGmailConnected(false);
        setGmailEmail('');
        lastConnectionCheckRef.current = now;
        console.log('❌ Gmail not connected - authentication required');
      }
    } catch (error) {
      console.error('❌ Error checking Gmail connection:', error);
      setIsGmailConnected(false);
      setGmailEmail('');
      lastConnectionCheckRef.current = now;
      console.log('❌ Cannot reach backend - please ensure Flask server is running');
    }
  }, []);

  const handleGmailLogin = async () => {
    try {
      setIsLoading(true);
      console.log('🔑 Starting Gmail OAuth flow...');
      
      const response = await fetch(getApiUrl('/api/email/auth/start'));
      const data = await response.json();
      
      if (data.already_connected) {
        // Already authenticated - just update connection status
        console.log('✅ Already connected:', data.email);
        setShowCodeInput(false);
        setAuthCode('');
        await checkGmailConnection(true); // Force refresh connection status
        await fetchEmails();
      } else if (data.authUrl) {
        console.log('✅ Opening auth URL:', data.authUrl);
        const popup = window.open(data.authUrl, '_blank');
        if (!popup) {
          alert('⚠️ Popup blocked!\n\nPlease allow popups for this site, then try again.');
        } else {
          console.log('✅ Popup opened successfully');
          setShowCodeInput(true);
        }
      } else {
        alert(`Gmail Connection Error:\n\n${data.error}`);
      }
    } catch (error) {
      console.error('Error starting Gmail login:', error);
      alert(`❌ Connection Error:\n\n${error}\n\nMake sure backend server is running.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitCode = async () => {
    try {
      setIsLoading(true);
      console.log('🔐 Submitting auth code...');
      
      const response = await fetch(getApiUrl('/api/email/auth/submit-code'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: authCode })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Gmail authentication successful');
        setShowCodeInput(false);
        setAuthCode('');
        await checkGmailConnection();
        await fetchEmails();
      } else {
        alert(`❌ Authentication failed:\n\n${data.error}`);
      }
    } catch (error) {
      console.error('Error submitting auth code:', error);
      alert(`❌ Connection Error:\n\n${error}\n\nMake sure backend server is running.`);
    } finally {
      setIsLoading(false);
    }
  };


  const handleSendEmail = async () => {
    if (!composeEmail.to || !composeEmail.subject || !composeEmail.content) {
      alert('Please fill in all fields before sending!');
      return;
    }

    console.log('Sending email:', composeEmail);
    alert('Email sent! (This is a placeholder - integrate with your email service)');
    
    setComposeEmail({ to: '', subject: '', content: '', replyTo: null });
    setShowComposer(false);
  };

  const handleSaveComposeDraft = () => {
    if (!composeEmail.to || !composeEmail.subject || !composeEmail.content) {
      alert('Please fill in all fields before saving draft!');
      return;
    }

    const draft = {
      id: Date.now().toString(),
      ...composeEmail,
      timestamp: new Date().toISOString()
    };

    const updatedDrafts = [...drafts, draft];
    setDrafts(updatedDrafts);
    localStorage.setItem('email-drafts', JSON.stringify(updatedDrafts));
    alert('Draft saved successfully!');
  };

  const handleLoadDraft = (draft: any) => {
    setComposeEmail({
      to: draft.to,
      subject: draft.subject,
      content: draft.content,
      replyTo: draft.replyTo
    });
    setShowComposer(true);
    setShowDrafts(false);
  };

  const handleDeleteDraft = (draftId: string) => {
    const updatedDrafts = drafts.filter(d => d.id !== draftId);
    setDrafts(updatedDrafts);
    localStorage.setItem('email-drafts', JSON.stringify(updatedDrafts));
  };

  // AI Reply functions
  const handleLearnFromSentEmails = async () => {
    try {
      setIsLoading(true);
      console.log('🧠 Learning from sent emails...');
      
      const response = await fetch(getApiUrl('/api/ai/learn-from-sent'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxEmails: 250
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setHasLearnedFromSent(true);
        localStorage.setItem('ai-learned-from-sent', 'true'); // Save to localStorage
        const emailCount = data.emailsAnalyzed || data.sentEmailsCount || 0;
        if (emailCount > 0) {
          alert(`✅ Successfully learned from ${emailCount} sent emails! AI Reply is now available.`);
        } else {
          alert(`✅ AI Reply training completed! (Note: 0 emails found to analyze)`);
        }
      } else {
        alert(`❌ Error learning from emails: ${data.error}`);
      }
    } catch (error) {
      console.error('Error learning from sent emails:', error);
      alert(`❌ Error learning from sent emails: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateAIReply = async (email: Email) => {
    if (!hasLearnedFromSent) {
      alert('❌ Please learn from your sent emails first by clicking "Learn from Sent Messages"');
      return;
    }

    try {
      setIsGeneratingReply(true);
      setReplyToEmail(email);
      setShowAiReply(true);
      
      console.log('🤖 Generating AI reply...');
      
      // Build the prompt from the email content
      const prompt = `Please draft a professional email reply to this message:\n\nFrom: ${email.from}\nSubject: ${email.subject}\n\n${email.body || email.snippet}`;
      
      const response = await fetch(getApiUrl('/api/ai/generate-email'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          system_prompt: 'You are a helpful email assistant that drafts professional business replies.',
          writing_style: '', // We'll add this later if needed
          user_name: currentUser?.name || 'User'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAiReplyText(data.reply);
        console.log('✅ AI reply generated successfully');
      } else {
        alert(`❌ Error generating AI reply: ${data.error}`);
        setShowAiReply(false);
      }
    } catch (error) {
      console.error('Error generating AI reply:', error);
      alert(`❌ Error generating AI reply: ${error}`);
      setShowAiReply(false);
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const handleSendAIReply = () => {
    if (!aiReplyText.trim() || !replyToEmail) return;
    
    // Create reply email
    const replyEmail = {
      to: replyToEmail.from,
      subject: replyToEmail.subject.startsWith('Re:') ? replyToEmail.subject : `Re: ${replyToEmail.subject}`,
      content: aiReplyText,
      replyTo: replyToEmail
    };
    
    setComposeEmail(replyEmail);
    setShowComposer(true);
    setShowAiReply(false);
    setAiReplyText('');
    setReplyToEmail(null);
  };

  const handleSaveAIReplyAsDraft = () => {
    if (!aiReplyText.trim() || !replyToEmail) return;
    
    const draft = {
      id: `draft-${Date.now()}`,
      to: replyToEmail.from,
      subject: replyToEmail.subject.startsWith('Re:') ? replyToEmail.subject : `Re: ${replyToEmail.subject}`,
      content: aiReplyText,
      replyTo: replyToEmail,
      timestamp: new Date().toISOString(),
      isDraft: true
    };
    
    const updatedDrafts = [...drafts, draft];
    setDrafts(updatedDrafts);
    localStorage.setItem('email-drafts', JSON.stringify(updatedDrafts));
    
    setShowAiReply(false);
    setAiReplyText('');
    setReplyToEmail(null);
    alert('✅ AI reply saved as draft!');
  };

  const handleEditAIReply = () => {
    if (!aiReplyText.trim() || !replyToEmail) return;
    
    // Create reply email for editing
    const replyEmail = {
      to: replyToEmail.from,
      subject: replyToEmail.subject.startsWith('Re:') ? replyToEmail.subject : `Re: ${replyToEmail.subject}`,
      content: aiReplyText,
      replyTo: replyToEmail
    };
    
    setComposeEmail(replyEmail);
    setShowComposer(true);
    setShowAiReply(false);
    setAiReplyText('');
    setReplyToEmail(null);
  };

  // Load drafts from localStorage
  useEffect(() => {
    const savedDrafts = localStorage.getItem('email-drafts');
    if (savedDrafts) {
      setDrafts(JSON.parse(savedDrafts));
    }
  }, []);

  // Clear stale cache on mount if we have no emails (fixes Vercel fresh load issue)
  useEffect(() => {
    if (emails.length === 0) {
      const lastFetchTime = sessionStorage.getItem('emails-fetch-time');
      if (lastFetchTime) {
        console.log('🧹 Clearing stale cache on mount - no emails in state');
        sessionStorage.removeItem('emails-fetch-time');
      }
    }
  }, []); // Only run on mount

  const fetchEmails = useCallback(async (forceRefresh: boolean = false) => {
    // Don't fetch if already loading
    if (isLoading && !forceRefresh) {
      console.log('⏭️ Already loading emails, skipping...');
      return;
    }

    try {
      // SIMPLIFIED CACHE LOGIC FOR VERCEL:
      // - Always fetch if we have no emails (emails.length === 0)
      // - Only check cache if we have emails AND not forcing refresh
      const hasEmails = emails.length > 0;
      const lastFetchTime = sessionStorage.getItem('emails-fetch-time');
      const now = Date.now();
      const TEN_MINUTES = 10 * 60 * 1000;
      
      // Skip cache check if forcing refresh or if we have no emails
      if (!forceRefresh && hasEmails && lastFetchTime) {
        const timeSinceLastFetch = now - parseInt(lastFetchTime);
        if (timeSinceLastFetch < TEN_MINUTES) {
          console.log(`⏭️ Skipping fetch - have ${emails.length} emails cached (${Math.round(timeSinceLastFetch / 1000)}s ago)`);
          return;
        }
      }
      
      console.log('🔄 Starting email fetch...', { 
        forceRefresh, 
        hasEmails,
        emailCount: emails.length,
        willFetch: true 
      });
      
      setIsLoading(true);
      
      const url = getApiUrl(`/api/email/inbox?max=2000${forceRefresh ? '&force=true' : ''}`);
      console.log('🌐 Fetching emails from:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        console.error('❌ HTTP Error:', {
          status: response.status,
          statusText: response.statusText,
          url,
          error: errorText
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📡 Backend response received:', {
        success: data.success,
        emailCount: data.emails?.length || 0,
        hasError: !!data.error,
        cached: data.cached,
        cache_age: data.cache_age,
        url
      });
      
      // VERCEL DEBUG: Log full response for debugging
      if (data.emails?.length === 0) {
        console.warn('⚠️ DEBUG: Empty emails array received', {
          data: JSON.stringify(data, null, 2),
          responseKeys: Object.keys(data)
        });
      }
      
      if (data.success) {
        const enrichedEmails = (data.emails || []).map((email: any) => ({
          ...email,
          date: new Date(email.timestamp).toLocaleDateString(),
          body: email.body || email.snippet
        }));
        
        // VERCEL FIX: If backend says connected but returns 0 emails (likely stale cache)
        // and we're not forcing refresh, try again with force=true
        if (enrichedEmails.length === 0 && !forceRefresh && data.cached) {
          console.log('⚠️ Backend returned empty cached result - retrying with force=true...');
          sessionStorage.removeItem('emails-fetch-time');
          // Retry with force after a short delay
          setTimeout(() => {
            fetchEmails(true);
          }, 500);
          return;
        }
        
        setEmails(enrichedEmails);
        
        // Group emails into threads
        const threads = groupEmailsIntoThreads(enrichedEmails);
        setEmailThreads(threads);
        
        console.log(`✅ Loaded ${enrichedEmails.length} emails from Gmail`, {
          cached: data.cached,
          cache_age: data.cache_age,
          new_emails: data.new_emails_count
        });
        
        // Cache strategy: Only cache if we got emails
        if (enrichedEmails.length > 0) {
          sessionStorage.setItem('emails-fetch-time', Date.now().toString());
        } else {
          console.log('⚠️ No emails in response - clearing cache to allow retry');
          sessionStorage.removeItem('emails-fetch-time');
          // If we're connected but got no emails, maybe connection is stale
          // Note: Connection check will be triggered by useEffect
        }
      } else {
        console.error('❌ Backend error:', data.error);
        // Clear cache on error
        sessionStorage.removeItem('emails-fetch-time');
        alert(`❌ Error fetching emails:\n\n${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Fetch error:', error);
      // Clear cache on network error
      sessionStorage.removeItem('emails-fetch-time');
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`❌ Connection Error:\n\n${errorMessage}\n\nMake sure backend server is running.`);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, emails.length, isGmailConnected]);

  // Gmail-style pagination: Load more emails
  const loadMoreEmails = async () => {
    if (isLoadingMore || !hasMorePages) return;
    
    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const response = await fetch(getApiUrl(`/api/email/inbox?page=${nextPage}&limit=${EMAILS_PER_PAGE}`));
      const data = await response.json();
      
      if (data.success && data.emails) {
        const enrichedEmails = data.emails.map((email: any) => ({
          ...email,
          date: new Date(email.timestamp).toLocaleDateString(),
          body: email.body || email.snippet,
          isRead: true, // Default to read
          isImportant: email.isImportant || false,
          hasAttachments: email.hasAttachments || false,
          attachments: email.attachments || []
        }));
        
        // Add new emails to existing list
        setEmails(prev => [...prev, ...enrichedEmails]);
        
        // Update threads with new emails
        const allEmails = [...emails, ...enrichedEmails];
        const threads = groupEmailsIntoThreads(allEmails);
        setEmailThreads(threads);
        
        setCurrentPage(nextPage);
        
        // Check if there are more pages
        if (enrichedEmails.length < EMAILS_PER_PAGE) {
          setHasMorePages(false);
        }
        
        console.log(`✅ Loaded page ${nextPage}: ${enrichedEmails.length} more emails`);
      } else {
        setHasMorePages(false);
        console.log('No more emails to load');
      }
    } catch (error) {
      console.error('Error loading more emails:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Detect if email is from Carolina (logistics)
  const isLogisticsEmail = (email: Email): boolean => {
    const carolinaEmail = 'carolina@canoilcanadaltd.com';
    return email.from.toLowerCase().includes(carolinaEmail.toLowerCase());
  };


  // Process logistics in background
  const processLogistics = useCallback(async (email: Email) => {
    try {
      setIsProcessingLogistics(true);
      setLogisticsDocuments([]);
      setLogisticsResult(null);
      
      console.log('📦 Processing logistics email in background...');
      console.log('📧 Original email length:', email.body.length, 'characters');
      
      // Extract ONLY forwarded content (no signatures, greetings)
      const cleanedBody = extractForwardedContent(email.body);
      console.log('🧹 Cleaned email body length:', cleanedBody.length, 'characters');
      console.log('✂️ Filtered out:', email.body.length - cleanedBody.length, 'characters (signatures, greetings)');
      
      if (cleanedBody.length < 50) {
        alert('⚠️ Warning: Forwarded content is very short. Make sure this email contains forwarded logistics information.');
      }
      
      // Build email content with cleaned body
      const emailContent = `From: ${email.from}\nSubject: ${email.subject}\nDate: ${email.timestamp}\n\n${cleanedBody}`;
      
      // Call logistics API
      const response = await fetch(getApiUrl('/api/logistics/process-email'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_content: emailContent,
          processing_mode: 'auto'  // Gmail integration = Auto flow, ALWAYS single SO
        })
      });

      const data = await response.json();

      if (data.success) {
        setLogisticsResult(data);
        console.log('✅ Logistics processed successfully:', data);
        
        // Just show the result, user can manually generate docs
        alert('✅ Logistics Data Processed!\n\nSO: ' + (data.so_data?.so_number || 'Unknown') + '\n\nClick "Generate Documents" to create shipping forms.');
      } else {
        alert(`❌ Error processing logistics:\n\n${data.error}`);
      }
    } catch (error) {
      console.error('Error processing logistics:', error);
      alert(`❌ Connection Error:\n\n${error}\n\nMake sure backend server is running.`);
    } finally {
      setIsProcessingLogistics(false);
    }
  }, []);

  // Generate all logistics documents
  const generateAllDocuments = async (result: any) => {
    try {
      console.log('📄 Generating all shipping documents...');
      
      const response = await fetch(getApiUrl('/api/logistics/generate-all-documents'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          so_data: result.so_data,
          email_shipping: result.email_shipping,
          email_analysis: result.email_analysis,
          items: result.so_data?.items || result.items || []
        })
      });

      const data = await response.json();

      if (data.success) {
        setLogisticsDocuments(data.documents || []);
        console.log('✅ All documents generated successfully:', data.documents);
        alert(`✅ All Documents Generated!\n\nGenerated ${data.documents.length} documents:\n${data.documents.map((doc: any) => `• ${doc.document_type}`).join('\n')}`);
      } else {
        alert(`❌ Error generating documents:\n\n${data.error}`);
      }
    } catch (error) {
      console.error('Error generating documents:', error);
      alert(`❌ Connection Error:\n\n${error}\n\nMake sure backend server is running.`);
    }
  };

  // Filter threads based on search query
  const filteredThreads = emailThreads.filter(thread =>
    thread.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.lastEmail.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.emails.some(email => email.body.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Ref to prevent multiple logistics processing calls
  const logisticsProcessedRef = useRef<string | null>(null);

  // Auto-expand last message when selecting a thread
  useEffect(() => {
    if (selectedThread && selectedThread.emails.length > 0) {
      const lastMessageId = selectedThread.emails[selectedThread.emails.length - 1].id;
      setExpandedMessageIds(new Set([lastMessageId]));
    }
  }, [selectedThread]);

  // Auto-process logistics when Carolina email is detected
  useEffect(() => {
    if (selectedThread && selectedThread.emails) {
      const carolinaEmail = selectedThread.emails.find(email => isLogisticsEmail(email));
      if (carolinaEmail && !logisticsResult && !isProcessingLogistics) {
        // Check if we've already processed this email
        if (logisticsProcessedRef.current !== carolinaEmail.id) {
          console.log('🔍 Auto-processing Carolina email for logistics data');
          logisticsProcessedRef.current = carolinaEmail.id;
          processLogistics(carolinaEmail);
        }
      }
    }
  }, [selectedThread, logisticsResult, isProcessingLogistics, processLogistics]);

  // Check Gmail connection status on mount and periodically
  useEffect(() => {
    let mounted = true;
    
    // Initial check on mount
    checkGmailConnection(true);
    
    // Check connection status every 5 minutes to handle token refresh
    const interval = setInterval(() => {
      if (mounted) {
        checkGmailConnection(true);
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []); // Empty dependency array - only run on mount

  // Fetch emails when Gmail becomes connected and we don't have emails
  useEffect(() => {
    if (isGmailConnected && emails.length === 0 && !isLoading) {
      console.log('✅ Gmail connected, no emails in state - fetching emails...');
      // Small delay to ensure state is ready
      const timer = setTimeout(() => {
        fetchEmails(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isGmailConnected, emails.length, isLoading, fetchEmails]);

  if (!isGmailConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <Mail className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Connect to Gmail</h2>
          <p className="text-gray-600 mb-6">
            Connect your Gmail account to view and manage your emails with a Gmail-like interface.
          </p>
          
          {showCodeInput ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter the authorization code from the popup window:
                </label>
                <input
                  type="text"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Paste authorization code here"
                />
              </div>
              <button
                onClick={handleSubmitCode}
                disabled={isLoading || !authCode.trim()}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Authenticating...' : 'Connect'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGmailLogin}
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              {isLoading ? 'Connecting...' : 'Connect to Gmail'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Email Assistant</h1>
              <p className="text-xs text-gray-500 font-medium">{currentUser?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchEmails(true)}
              disabled={isLoading}
              className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh emails"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

          {/* Learn from Sent Messages Button - Simple and Clean */}
          {!hasLearnedFromSent && (
            <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
              <button
                onClick={handleLearnFromSentEmails}
                disabled={isLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto shadow-md hover:shadow-lg transition-all duration-200 font-medium text-sm"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Brain className="w-4 h-4" />
                )}
                Learn from Sent Messages
              </button>
            </div>
          )}

          {/* Email Composer - FIXED POSITION OVERLAY */}
          {showComposer && (
            <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <Mail className="w-4 h-4 text-white" />
                    </div>
                    {composeEmail.replyTo ? 'Reply to Email' : 'Compose New Email'}
                  </h3>
                  <button
                    onClick={() => setShowComposer(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:rotate-90"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="overflow-y-auto p-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        To:
                      </label>
                      <input
                        type="email"
                        value={composeEmail.to}
                        onChange={(e) => setComposeEmail(prev => ({ ...prev, to: e.target.value }))}
                        placeholder="recipient@example.com"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subject:
                      </label>
                      <input
                        type="text"
                        value={composeEmail.subject}
                        onChange={(e) => setComposeEmail(prev => ({ ...prev, subject: e.target.value }))}
                        placeholder="Email subject"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Content:
                      </label>
                      <textarea
                        value={composeEmail.content}
                        onChange={(e) => setComposeEmail(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="Email content..."
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg h-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white resize-none"
                      />
                    </div>
                    
                    <div className="flex gap-2 pt-4 border-t border-gray-200">
                      <button
                        onClick={handleSendEmail}
                        disabled={!composeEmail.to || !composeEmail.subject || !composeEmail.content}
                        className="bg-gradient-to-r from-green-600 to-green-700 text-white px-5 py-2.5 rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        <Send className="w-4 h-4" />
                        Send Email
                      </button>
                      
                      <button
                        onClick={handleSaveComposeDraft}
                        disabled={!composeEmail.to || !composeEmail.subject || !composeEmail.content}
                        className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-5 py-2.5 rounded-lg hover:from-gray-700 hover:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        <BookOpen className="w-4 h-4" />
                        Save Draft
                      </button>
                      
                      <button
                        onClick={() => setShowDrafts(!showDrafts)}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        <BookOpen className="w-4 h-4" />
                        Load Draft ({drafts.length})
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Drafts Panel */}
          {showDrafts && (
            <div className="bg-white p-4 rounded-lg shadow-md mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-orange-600" />
                  Saved Drafts ({drafts.length})
                </h3>
                <button
                  onClick={() => setShowDrafts(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {drafts.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No drafts saved yet.</p>
                ) : (
                  drafts.map((draft) => (
                    <div key={draft.id} className="flex items-center justify-between bg-white p-3.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate mb-1" title={draft.subject}>{draft.subject}</p>
                        <p className="text-xs text-gray-600 truncate mb-1" title={draft.to}>To: {draft.to}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(draft.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleLoadDraft(draft)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-all duration-200"
                          title="Load draft"
                        >
                          <BookOpen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDraft(draft.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all duration-200"
                          title="Delete draft"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

      <div className="flex h-[calc(100vh-80px)]">
        {/* Email List - Gmail-style narrow sidebar with fixed height */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
          {/* Search */}
          <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
              <input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all duration-200 bg-gray-50 focus:bg-white"
              />
            </div>
          </div>

          {/* Thread List - Fixed height with proper scrolling */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading emails...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No emails found
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <div key={thread.threadId}>
                  <EnhancedEmailCard
                    email={thread.lastEmail}
                    thread={thread}
                    isSelected={selectedThread?.threadId === thread.threadId}
                    onClick={() => setSelectedThread(thread)}
                    onThreadClick={() => toggleThread(thread.threadId)}
                    threadCount={thread.emails.length}
                    isExpanded={expandedThreads.has(thread.threadId)}
                  />
                  
                  {/* Expanded thread emails */}
                  {expandedThreads.has(thread.threadId) && thread.emails.length > 1 && (
                    <div className="bg-gray-50 border-t border-gray-100">
                      {thread.emails.slice(0, -1).map((email) => (
                        <div
                          key={email.id}
                          className="px-4 py-2.5 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmail(email);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-gray-600 truncate flex-1 min-w-0" title={email.from}>
                              {email.from}
                            </span>
                            <span className="text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">
                              {formatTimestamp(email.timestamp)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-1" title={email.snippet}>
                            {email.snippet}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            
            {/* Gmail-style Load More button */}
            {hasMorePages && (
              <div className="p-4 border-t border-gray-200 bg-white">
                <button
                  onClick={loadMoreEmails}
                  disabled={isLoadingMore}
                  className="w-full py-2.5 px-4 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-300 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {isLoadingMore ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                      Loading more emails...
                    </div>
                  ) : (
                    'Load more emails'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Email Content */}
        <div className="flex-1 bg-white">
          {selectedThread ? (
            <div className="h-full flex flex-col">
              {/* Fixed Email Header with Reply Actions */}
              <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-md">
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-4">
                      <h2 className="text-base font-semibold text-gray-900 mb-2 break-words overflow-hidden" style={{ 
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        wordBreak: 'break-word'
                      }}>
                        {selectedThread.subject}
                      </h2>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="font-medium text-gray-700">{selectedThread.lastEmail.from}</span>
                        <span className="text-gray-400">•</span>
                        <span>{formatTimestamp(selectedThread.lastEmail.timestamp)}</span>
                        {selectedThread.lastEmail.hasAttachments && (
                          <>
                            <span className="text-gray-400">•</span>
                            <Paperclip className="w-3.5 h-3.5 text-gray-500" />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* PRIMARY REPLY ACTIONS - ALWAYS VISIBLE AT TOP */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleReply(selectedThread.lastEmail)}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium text-sm shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      <Reply className="w-4 h-4" />
                      Reply
                    </button>
                    <button
                      onClick={() => handleGenerateAIReply(selectedThread.lastEmail)}
                      disabled={!hasLearnedFromSent}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all duration-200 ${
                        hasLearnedFromSent 
                          ? 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 hover:shadow-md' 
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      title={hasLearnedFromSent ? 'Generate AI Reply' : 'Learn from sent emails first'}
                    >
                      <Brain className="w-4 h-4" />
                      AI Reply
                    </button>
                    <button className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg flex items-center gap-2 font-medium text-sm transition-all duration-200 border border-gray-200 hover:border-gray-300">
                      <Forward className="w-4 h-4" />
                      Forward
                    </button>
                  </div>
                  
                  {/* Compact thread navigation */}
                  {selectedThread.emails.length > 1 && (
                    <div className="flex items-center gap-1 text-xs mt-2">
                      <span className="text-gray-500">Thread:</span>
                      {selectedThread.emails.map((email, index) => (
                        <button
                          key={email.id}
                          onClick={() => setSelectedEmail(email)}
                          className={`px-1.5 py-0.5 rounded text-xs ${
                            selectedEmail?.id === email.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Gmail-style Email Content Area */}
              <div className="flex-1 flex flex-col bg-white">
                {/* Compact view mode toolbar */}
                <div className="px-5 py-2.5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEmailViewMode('formatted')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                        emailViewMode === 'formatted' 
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm' 
                          : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      Formatted
                    </button>
                    <button
                      onClick={() => setEmailViewMode('chain')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                        emailViewMode === 'chain' 
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm' 
                          : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      Chain
                    </button>
                    <button
                      onClick={() => setEmailViewMode('raw')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                        emailViewMode === 'raw' 
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm' 
                          : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      Raw
                    </button>
                  </div>
                </div>

                {/* Large reading area with Spark-style message cards */}
                <div className="flex-1 overflow-y-auto bg-gray-50">
                  <div className="px-6 py-4">
                    <div className="max-w-4xl mx-auto">
                      {/* Thread Subject Header */}
                      <div className="mb-6">
                        <h2 className="text-2xl font-semibold text-gray-900 mb-2 break-words" style={{ 
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word'
                        }}>
                          {selectedThread.subject}
                        </h2>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <span>{selectedThread.emails.length} {selectedThread.emails.length === 1 ? 'message' : 'messages'}</span>
                          <span>•</span>
                          <span>Between: {Array.from(new Set(selectedThread.emails.map(e => e.from))).join(', ')}</span>
                        </div>
                      </div>
                      
                      {/* Messages using Spark-style cards */}
                      <div className="space-y-0">
                        {selectedThread.emails.map((email, index) => (
                          <SparkMessageCard
                            key={email.id}
                            email={email}
                            isExpanded={expandedMessageIds.has(email.id)}
                            onToggle={() => toggleMessage(email.id)}
                            isFirst={index === 0}
                            isLast={index === selectedThread.emails.length - 1}
                            threadIndex={index}
                            isCarolinaEmail={isLogisticsEmail(email)}
                            onProcessLogistics={processLogistics}
                            isProcessingLogistics={isProcessingLogistics}
                            logisticsResult={logisticsResult}
                            onReply={handleReply}
                            onAIReply={handleGenerateAIReply}
                            hasLearnedFromSent={hasLearnedFromSent}
                            showAiReply={showAiReply}
                            setShowAiReply={setShowAiReply}
                            replyToEmail={replyToEmail}
                            aiReplyText={aiReplyText}
                            isGeneratingReply={isGeneratingReply}
                            onSendAIReply={handleSendAIReply}
                            onEditAIReply={handleEditAIReply}
                            onSaveAIReplyAsDraft={handleSaveAIReplyAsDraft}
                            onCompose={handleCompose}
                            onSaveDraft={handleSaveDraft}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Logistics Actions */}
                {isLogisticsEmail(selectedThread.lastEmail) && (
                  <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <h3 className="text-lg font-semibold text-orange-900 mb-4">Logistics Processing</h3>
                    {!logisticsResult ? (
                      <button 
                        onClick={() => processLogistics(selectedThread.lastEmail)}
                        disabled={isProcessingLogistics}
                        className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 disabled:opacity-50 font-semibold"
                      >
                        {isProcessingLogistics ? 'Processing...' : '📦 Process Logistics'}
                      </button>
                    ) : (
                      <div>
                        <button 
                          onClick={() => generateAllDocuments(logisticsResult)}
                          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold mb-4"
                        >
                          📋 Generate All Documents
                        </button>
                        <LogisticsPanel 
                          result={logisticsResult}
                          documents={logisticsDocuments}
                          onDownload={handleDownload}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Mail className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Select an email to view</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
