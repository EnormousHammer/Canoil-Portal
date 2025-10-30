import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw, LogIn, Search, ChevronDown, ChevronRight, Clock, Paperclip } from 'lucide-react';

interface EmailAssistantProps {
  currentUser: { name: string; email: string; isAdmin: boolean } | null;
  setActiveSection?: (section: string) => void;
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
  attachments?: any[];
  hasAttachments?: boolean;
}

interface EmailThread {
  threadId: string;
  subject: string;
  emails: Email[];
  lastEmail: Email;
  unreadCount: number;
}

export const GmailLikeEmail: React.FC<EmailAssistantProps> = ({ currentUser, setActiveSection }) => {
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [emailThreads, setEmailThreads] = useState<EmailThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [authCode, setAuthCode] = useState('');

  // Check Gmail connection status
  const checkGmailConnection = async () => {
    try {
      const response = await fetch('http://localhost:5002/api/email/status');
      const data = await response.json();
      
      if (data.success && data.connected) {
        setIsGmailConnected(true);
        await fetchEmails();
      } else {
        setIsGmailConnected(false);
      }
    } catch (error) {
      console.error('Error checking Gmail connection:', error);
      setIsGmailConnected(false);
    }
  };

  // Handle Gmail login
  const handleGmailLogin = async () => {
    try {
      setIsLoading(true);
      console.log('🔑 Starting Gmail OAuth flow...');
      
      const response = await fetch('http://localhost:5002/api/email/auth/start', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.authUrl) {
        setShowCodeInput(true);
        window.open(data.authUrl, '_blank');
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

  // Submit auth code
  const handleSubmitCode = async () => {
    try {
      setIsLoading(true);
      console.log('🔐 Submitting auth code...');
      
      const response = await fetch('http://localhost:5002/api/email/auth/submit-code', {
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
      } else {
        alert(`❌ Authentication failed:\n\n${data.error}`);
      }
    } catch (error) {
      console.error('Error submitting auth code:', error);
      alert(`❌ Authentication failed:\n\n${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch emails from Gmail
  const fetchEmails = async (forceRefresh: boolean = false) => {
    try {
      console.log('🔄 Starting email fetch...', { forceRefresh, isLoading });
      setIsLoading(true);
      
      const url = `http://localhost:5002/api/email/inbox?max=2000${forceRefresh ? '&force=true' : ''}`;
      console.log('🌐 Fetching from:', url);
      const response = await fetch(url);
      const data = await response.json();
      console.log('📡 Backend response:', JSON.stringify(data, null, 2));
      
      if (data.success) {
        const enrichedEmails = (data.emails || []).map((email: any) => ({
          ...email,
          date: new Date(email.timestamp).toLocaleDateString(),
          body: email.body || email.snippet
        }));
        setEmails(enrichedEmails);
        
        // Group emails into threads
        const threads = groupEmailsIntoThreads(enrichedEmails);
        setEmailThreads(threads);
        
        console.log(`✅ Fetched ${enrichedEmails.length} emails from Gmail`);
      } else {
        console.error('❌ Backend error:', data.error);
        alert(`❌ Error fetching emails:\n\n${data.error}`);
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
      alert(`❌ Connection Error:\n\n${error}\n\nMake sure backend server is running.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Group emails into threads
  const groupEmailsIntoThreads = (emails: Email[]): EmailThread[] => {
    const threadMap = new Map<string, EmailThread>();
    
    emails.forEach(email => {
      const threadId = email.threadId || email.id;
      
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, {
          threadId,
          subject: email.subject,
          emails: [],
          lastEmail: email,
          unreadCount: 0
        });
      }
      
      const thread = threadMap.get(threadId)!;
      thread.emails.push(email);
      
      // Update last email if this one is newer
      if (new Date(email.timestamp) > new Date(thread.lastEmail.timestamp)) {
        thread.lastEmail = email;
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

  // Format email timestamp
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

  // Filter threads based on search query
  const filteredThreads = emailThreads.filter(thread =>
    thread.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.lastEmail.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.emails.some(email => email.body.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    checkGmailConnection();
  }, []);

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
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Mail className="w-8 h-8 text-blue-500" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Gmail</h1>
              <p className="text-sm text-gray-500">Connected: {currentUser?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchEmails(true)}
              disabled={isLoading}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Email List */}
        <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto">
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
                <div
                  key={thread.threadId}
                  className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                    selectedThread?.threadId === thread.threadId ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                  onClick={() => setSelectedThread(thread)}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {thread.subject}
                        </h3>
                        <p className="text-sm text-gray-600 truncate">
                          {thread.lastEmail.from}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(thread.lastEmail.timestamp)}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {thread.lastEmail.snippet}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {thread.emails.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleThread(thread.threadId);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            {expandedThreads.has(thread.threadId) ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                            {thread.emails.length} messages
                          </button>
                        )}
                        {thread.lastEmail.hasAttachments && (
                          <Paperclip className="w-3 h-3 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded thread emails */}
                  {expandedThreads.has(thread.threadId) && thread.emails.length > 1 && (
                    <div className="bg-gray-50 border-t border-gray-100">
                      {thread.emails.slice(0, -1).map((email) => (
                        <div
                          key={email.id}
                          className="px-4 py-2 border-b border-gray-100 hover:bg-gray-100 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmail(email);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 truncate">
                              {email.from}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatTimestamp(email.timestamp)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {email.snippet}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Email Content */}
        <div className="flex-1 bg-white">
          {selectedThread ? (
            <div className="h-full flex flex-col">
              {/* Email Header */}
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {selectedThread.subject}
                </h2>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>{selectedThread.lastEmail.from}</span>
                  <span>•</span>
                  <span>{formatTimestamp(selectedThread.lastEmail.timestamp)}</span>
                  {selectedThread.lastEmail.hasAttachments && (
                    <>
                      <span>•</span>
                      <Paperclip className="w-4 h-4" />
                      <span>Has attachments</span>
                    </>
                  )}
                </div>
              </div>

              {/* Email Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {selectedEmail ? (
                  <div>
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{selectedEmail.from}</span>
                        <span className="text-sm text-gray-500">
                          {formatTimestamp(selectedEmail.timestamp)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {selectedEmail.body || selectedEmail.snippet}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedThread.lastEmail.body || selectedThread.lastEmail.snippet}
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
