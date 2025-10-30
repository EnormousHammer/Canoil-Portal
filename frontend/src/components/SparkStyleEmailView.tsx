import React, { useState, useEffect } from 'react';
import { 
  Mail, RefreshCw, LogIn, Search, ChevronDown, ChevronRight, 
  Clock, Paperclip, Reply, Forward, MoreVertical, Star,
  Archive, Trash2, FolderOpen, Tag, Eye, EyeOff,
  Maximize2, Minimize2, ChevronUp
} from 'lucide-react';

// Types
interface EmailMessage {
  id: string;
  messageId: string;
  threadId: string;
  from: string;
  fromEmail: string;
  to: string[];
  subject: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  hasAttachments: boolean;
  attachments?: Attachment[];
  inReplyTo?: string;
  references?: string[];
  isForwarded?: boolean;
}

interface EmailThread {
  threadId: string;
  subject: string;
  participants: string[];
  messages: EmailMessage[];
  lastMessage: EmailMessage;
  unreadCount: number;
  hasAttachments: boolean;
  isStarred: boolean;
  labels: string[];
}

interface Attachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  url?: string;
}

// Utility functions
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getAvatarColor = (name: string): string => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
    'bg-pink-500', 'bg-indigo-500', 'bg-red-500',
    'bg-yellow-500', 'bg-orange-500'
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString([], { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Components
const MessageAvatar: React.FC<{ name: string; email: string }> = ({ name, email }) => {
  const initials = getInitials(name);
  const colorClass = getAvatarColor(name);
  
  return (
    <div className={`w-10 h-10 rounded-full ${colorClass} flex items-center justify-center text-white font-medium text-sm`}>
      {initials}
    </div>
  );
};

const QuotedText: React.FC<{ content: string }> = ({ content }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Simple quoted text detection
  const lines = content.split('\n');
  const quotedStartIndex = lines.findIndex(line => 
    line.includes('wrote:') || 
    line.startsWith('>') || 
    line.includes('-------- Original Message') ||
    line.includes('From:') && line.includes('Sent:')
  );
  
  if (quotedStartIndex === -1) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }
  
  const mainContent = lines.slice(0, quotedStartIndex).join('\n');
  const quotedContent = lines.slice(quotedStartIndex).join('\n');
  
  return (
    <div>
      <div className="whitespace-pre-wrap">{mainContent}</div>
      {quotedContent && (
        <div className="mt-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <span className="text-xs">•••</span>
            {isExpanded ? 'Hide' : 'Show'} trimmed content
          </button>
          {isExpanded && (
            <div className="mt-2 pl-4 border-l-2 border-gray-300 text-gray-600 text-sm whitespace-pre-wrap">
              {quotedContent}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MessageCard: React.FC<{
  message: EmailMessage;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  threadMessages: EmailMessage[];
  messageIndex: number;
}> = ({ message, isLast, isExpanded, onToggle, threadMessages, messageIndex }) => {
  const [showActions, setShowActions] = useState(false);
  
  // Check if this is a reply
  const isReply = messageIndex > 0;
  const replyDepth = Math.min(messageIndex * 20, 60); // Max indent of 60px
  
  return (
    <div 
      className={`relative ${isReply ? `ml-${replyDepth}` : ''}`}
      style={{ marginLeft: isReply ? `${replyDepth}px` : '0' }}
    >
      {/* Reply indicator line */}
      {isReply && (
        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-gray-300" />
      )}
      
      <div
        className={`
          bg-white rounded-lg border shadow-sm
          ${isExpanded ? 'border-blue-400' : 'border-gray-200'}
          ${!isLast ? 'mb-3' : ''}
          hover:shadow-md transition-all duration-200
        `}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Message Header */}
        <div 
          className="px-4 py-3 flex items-center justify-between cursor-pointer"
          onClick={onToggle}
        >
          <div className="flex items-center gap-3">
            <MessageAvatar name={message.from} email={message.fromEmail} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{message.from}</span>
                {message.isForwarded && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                    FWD
                  </span>
                )}
                {!message.isRead && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </div>
              <div className="text-sm text-gray-500">
                to {message.to.join(', ')}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {formatTimestamp(message.timestamp)}
            </span>
            {message.hasAttachments && (
              <Paperclip className="w-4 h-4 text-gray-400" />
            )}
            <ChevronDown 
              className={`w-4 h-4 text-gray-400 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
        
        {/* Message Content */}
        {isExpanded && (
          <>
            <div className="px-4 pb-4">
              <div className="text-gray-700 leading-relaxed">
                <QuotedText content={message.content} />
              </div>
              
              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {message.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 cursor-pointer"
                    >
                      <Paperclip className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{attachment.filename}</span>
                      <span className="text-xs text-gray-500">
                        ({formatFileSize(attachment.size)})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Action Bar */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md flex items-center gap-1">
                  <Reply className="w-4 h-4" />
                  Reply
                </button>
                <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md flex items-center gap-1">
                  <Forward className="w-4 h-4" />
                  Forward
                </button>
              </div>
              <button className="p-1 text-gray-400 hover:text-gray-600">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
        
        {/* Quick Actions (shown on hover when collapsed) */}
        {!isExpanded && showActions && (
          <div className="absolute right-4 top-3 flex items-center gap-1 bg-white rounded-md shadow-lg border border-gray-200 p-1">
            <button className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
              <Reply className="w-4 h-4" />
            </button>
            <button className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
              <Forward className="w-4 h-4" />
            </button>
            <button className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
              <Archive className="w-4 h-4" />
            </button>
            <button className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const ThreadCard: React.FC<{
  thread: EmailThread;
  isSelected: boolean;
  onClick: () => void;
}> = ({ thread, isSelected, onClick }) => {
  const lastMessage = thread.lastMessage;
  const hasUnread = thread.unreadCount > 0;
  
  return (
    <div
      className={`
        border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}
        ${hasUnread ? 'bg-white' : 'bg-gray-50/50'}
      `}
      onClick={onClick}
    >
      <div className="px-4 py-3">
        {/* Thread Header */}
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                // Toggle star
              }}
              className="text-gray-400 hover:text-yellow-500"
            >
              <Star className={`w-4 h-4 ${thread.isStarred ? 'fill-yellow-500 text-yellow-500' : ''}`} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`text-sm truncate ${hasUnread ? 'font-semibold' : 'font-normal'}`}>
                  {thread.subject}
                </h3>
                {thread.messages.length > 1 && (
                  <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                    {thread.messages.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 truncate">
                {thread.participants.join(', ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-2">
            {thread.hasAttachments && (
              <Paperclip className="w-3 h-3 text-gray-400" />
            )}
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {formatTimestamp(lastMessage.timestamp)}
            </span>
          </div>
        </div>
        
        {/* Message Preview */}
        <p className="text-sm text-gray-600 truncate pl-7">
          {lastMessage.content.substring(0, 100)}...
        </p>
        
        {/* Labels */}
        {thread.labels.length > 0 && (
          <div className="flex items-center gap-1 mt-1 pl-7">
            {thread.labels.map((label) => (
              <span
                key={label}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Main Component
export const SparkStyleEmailView: React.FC<{
  currentUser: { name: string; email: string; isAdmin: boolean } | null;
  setActiveSection?: (section: string) => void;
}> = ({ currentUser, setActiveSection }) => {
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [viewDensity, setViewDensity] = useState<'comfortable' | 'cozy' | 'compact'>('comfortable');
  
  // Toggle message expansion
  const toggleMessage = (messageId: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedMessages(newExpanded);
  };
  
  // Auto-expand last message in thread
  useEffect(() => {
    if (selectedThread && selectedThread.messages.length > 0) {
      const lastMessageId = selectedThread.messages[selectedThread.messages.length - 1].id;
      setExpandedMessages(new Set([lastMessageId]));
    }
  }, [selectedThread]);
  
  // Filter threads based on search
  const filteredThreads = threads.filter(thread =>
    thread.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.participants.some(p => p.toLowerCase().includes(searchQuery.toLowerCase())) ||
    thread.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-blue-500" />
            <h1 className="text-lg font-semibold">Inbox</h1>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={viewDensity}
              onChange={(e) => setViewDensity(e.target.value as any)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="comfortable">Comfortable</option>
              <option value="cozy">Cozy</option>
              <option value="compact">Compact</option>
            </select>
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Thread List */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
          {/* Search Bar */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Thread List */}
          <div className="flex-1 overflow-y-auto">
            {filteredThreads.map((thread) => (
              <ThreadCard
                key={thread.threadId}
                thread={thread}
                isSelected={selectedThread?.threadId === thread.threadId}
                onClick={() => setSelectedThread(thread)}
              />
            ))}
          </div>
        </div>
        
        {/* Message View */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {selectedThread ? (
            <>
              {/* Thread Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedThread.subject}
                </h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <span>{selectedThread.messages.length} messages</span>
                  <span>•</span>
                  <span>{selectedThread.participants.join(', ')}</span>
                </div>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="max-w-4xl mx-auto">
                  {selectedThread.messages.map((message, index) => (
                    <MessageCard
                      key={message.id}
                      message={message}
                      isLast={index === selectedThread.messages.length - 1}
                      isExpanded={expandedMessages.has(message.id)}
                      onToggle={() => toggleMessage(message.id)}
                      threadMessages={selectedThread.messages}
                      messageIndex={index}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Select a conversation to view</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
