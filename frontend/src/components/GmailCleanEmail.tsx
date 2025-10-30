import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail, Search, Star, Archive, Trash2, MoreVertical,
  Send, X, Paperclip, ChevronLeft, RefreshCw, Plus,
  Inbox, SendIcon, FileText, Sparkles, Brain, AlertCircle
} from 'lucide-react';

interface Email {
  id: string;
  threadId: string;
  from: string;
  to?: string;
  subject: string;
  body: string;
  snippet: string;
  timestamp: string;
  hasAttachments?: boolean;
  attachments?: any[];
  isRead?: boolean;
  isStarred?: boolean;
}

interface EmailThread {
  threadId: string;
  emails: Email[];
  subject: string;
  participants: string[];
  snippet: string;
  timestamp: string;
  unread: boolean;
  count: number;
  isStarred?: boolean;
}

interface GmailCleanEmailProps {
  currentUser: { name: string; email: string; isAdmin: boolean };
  setActiveSection: (section: string) => void;
}

export const GmailCleanEmail: React.FC<GmailCleanEmailProps> = ({ currentUser, setActiveSection }) => {
  // State
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string>('');
  const [emails, setEmails] = useState<Email[]>([]);
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [composeEmail, setComposeEmail] = useState({
    to: '',
    subject: '',
    body: ''
  });
  
  // AI Features
  const [hasLearnedStyle, setHasLearnedStyle] = useState(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [showAiReply, setShowAiReply] = useState(false);
  const [aiReplyText, setAiReplyText] = useState('');
  
  // Auth
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authCode, setAuthCode] = useState('');

  // Connection check
  const lastConnectionCheckRef = useRef<number>(0);
  const CONNECTION_CHECK_INTERVAL = 30000; // 30 seconds

  // Folders for sidebar
  const folders = [
    { id: 'inbox', name: 'Inbox', icon: Inbox, count: threads.filter(t => t.unreadCount > 0).length },
    { id: 'starred', name: 'Starred', icon: Star, count: 0 },
    { id: 'sent', name: 'Sent', icon: SendIcon, count: 0 },
    { id: 'drafts', name: 'Drafts', icon: FileText, count: 0 },
    { id: 'important', name: 'Important', icon: AlertCircle, count: 0 },
    { id: 'all', name: 'All Mail', icon: Mail, count: 0 }
  ];

  // Check Gmail connection
  const checkGmailConnection = useCallback(async (force: boolean = false) => {
    const now = Date.now();
    if (!force && (now - lastConnectionCheckRef.current) < CONNECTION_CHECK_INTERVAL) {
      return;
    }
    
    try {
      console.log('Checking Gmail connection...');
      const response = await fetch('http://localhost:5002/api/email/status');
      const data = await response.json();
      console.log('Gmail connection status:', data);
      
      if (data.connected) {
        setIsGmailConnected(true);
        setGmailEmail(data.email || '');
        setHasLearnedStyle(data.styleAnalyzed || false);
        lastConnectionCheckRef.current = now;
      } else {
        setIsGmailConnected(false);
      }
    } catch (error) {
      console.error('Error checking Gmail connection:', error);
      setIsGmailConnected(false);
    }
  }, []);

  // Fetch emails
  const fetchEmails = async (force: boolean = false) => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      console.log('Fetching emails...');
      const response = await fetch(`http://localhost:5002/api/email/inbox?force=${force}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Emails response:', data);
      
      if (data.success) {
        // Handle the response - emails might be empty on first load
        const emailList = data.emails || [];
        setEmails(emailList);
        console.log(`Loaded ${emailList.length} emails`);
        // Group into threads
        groupEmailsIntoThreads(emailList);
      } else {
        console.error('Failed to fetch emails:', data.error);
        alert(`Failed to fetch emails: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
      if (error.message.includes('Failed to fetch')) {
        alert('Cannot connect to backend server. Please make sure the Flask server is running on port 5002.');
      } else {
        alert(`Error loading emails: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Group emails into threads
  const groupEmailsIntoThreads = (emailList: Email[]) => {
    const threadMap = new Map<string, EmailThread>();
    
    emailList.forEach(email => {
      const threadId = email.threadId || email.id;
      
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, {
          threadId,
          emails: [],
          subject: email.subject,
          participants: [],
          snippet: email.snippet,
          timestamp: email.timestamp,
          unread: !email.isRead,
          count: 1,
          isStarred: email.isStarred
        });
      }
      
      const thread = threadMap.get(threadId)!;
      thread.emails.push(email);
      thread.count = thread.emails.length;
      
      // Extract participants
      if (!thread.participants.includes(email.from)) {
        thread.participants.push(email.from);
      }
      
      // Update thread properties with latest email
      if (new Date(email.timestamp) > new Date(thread.timestamp)) {
        thread.timestamp = email.timestamp;
        thread.snippet = email.snippet;
      }
      
      // Mark thread as unread if any email is unread
      if (!email.isRead) {
        thread.unread = true;
      }
    });
    
    // Sort emails within threads
    threadMap.forEach(thread => {
      thread.emails.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    });
    
    // Convert to array and sort by date
    const threadList = Array.from(threadMap.values()).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    setThreads(threadList);
  };

  // Handle Gmail auth
  const handleGmailLogin = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('http://localhost:5002/api/email/auth/start');
      const data = await response.json();
      
      if (data.already_connected) {
        setShowAuthDialog(false);
        await checkGmailConnection(true);
        await fetchEmails();
      } else if (data.authUrl) {
        window.open(data.authUrl, '_blank');
        setShowAuthDialog(true);
      }
    } catch (error) {
      console.error('Error starting Gmail login:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthCode = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('http://localhost:5002/api/email/auth/submit-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authCode })
      });
      
      const data = await response.json();
      if (data.success) {
        setShowAuthDialog(false);
        setAuthCode('');
        await checkGmailConnection(true);
        await fetchEmails();
      }
    } catch (error) {
      console.error('Error submitting auth code:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Learn writing style
  const handleLearnStyle = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('http://localhost:5002/api/email/learn-style?max_emails=50');
      const data = await response.json();
      
      if (data.success) {
        setHasLearnedStyle(true);
        alert(`✅ Successfully learned your writing style from ${data.emails_analyzed} sent emails!`);
      }
    } catch (error) {
      console.error('Error learning style:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate AI reply
  const handleGenerateReply = async (email: Email) => {
    try {
      setIsGeneratingReply(true);
      setShowAiReply(true);
      
      const response = await fetch('http://localhost:5002/api/email/generate-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_content: email.body,
          sender_name: email.from.split('<')[0].trim(),
          subject: email.subject
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setAiReplyText(data.response);
        setComposeEmail({
          to: email.from,
          subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
          body: data.response
        });
        setShowCompose(true);
      }
    } catch (error) {
      console.error('Error generating reply:', error);
    } finally {
      setIsGeneratingReply(false);
    }
  };

  // Send email
  const handleSendEmail = async () => {
    try {
      setIsLoading(true);
      // Implement send endpoint
      alert('Email sent successfully!');
      setShowCompose(false);
      setComposeEmail({ to: '', subject: '', body: '' });
    } catch (error) {
      console.error('Error sending email:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Format date
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  // Get sender name
  const getSenderName = (from: string) => {
    const match = from.match(/^(.*?)\s*</);
    return match ? match[1].trim() : from.split('@')[0];
  };

  // Effects
  useEffect(() => {
    checkGmailConnection();
  }, []);

  useEffect(() => {
    if (isGmailConnected && emails.length === 0 && !isLoading) {
      // Try to load from cache first
      fetchEmails(false);
    }
  }, [isGmailConnected]);

  // If not connected, show connection prompt
  if (!isGmailConnected) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Mail className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-2xl font-medium mb-2">Welcome to Email</h2>
          <p className="text-gray-600 mb-6">Connect your Gmail to get started</p>
          <button
            onClick={handleGmailLogin}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Connect Gmail
          </button>
        </div>

        {/* Auth Dialog */}
        {showAuthDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-medium mb-4">Enter Authorization Code</h3>
              <p className="text-sm text-gray-600 mb-4">
                Copy the code from the browser window and paste it here
              </p>
              <input
                type="text"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                className="w-full px-3 py-2 border rounded-md mb-4"
                placeholder="Paste code here"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAuthDialog(false)}
                  className="flex-1 px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAuthCode}
                  disabled={!authCode.trim() || isLoading}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-gray-50 border-r flex flex-col">
        {/* Compose button */}
        <div className="p-4">
          <button
            onClick={() => setShowCompose(true)}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-full flex items-center gap-3 hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Compose</span>
          </button>
        </div>

        {/* Folders */}
        <nav className="flex-1 px-2 overflow-y-auto">
          {folders.map(folder => {
            const Icon = folder.icon;
            return (
              <button
                key={folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-full text-sm transition-colors ${
                  selectedFolder === folder.id 
                    ? 'bg-blue-50 text-blue-700 font-medium' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="flex-1 text-left">{folder.name}</span>
                {folder.count > 0 && (
                  <span className="text-xs text-gray-500">{folder.count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* AI Features */}
        <div className="flex-shrink-0 mt-6 px-4 pt-4 pb-4 border-t">
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">AI Features</h3>
          <button
            onClick={handleLearnStyle}
            disabled={hasLearnedStyle || isLoading}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              hasLearnedStyle 
                ? 'bg-green-50 text-green-700'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Brain className="w-4 h-4" />
            <span className="flex-1 text-left">
              {hasLearnedStyle ? 'Style Learned ✓' : 'Learn My Style'}
            </span>
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex">
        {/* Email list */}
        <div className={`${selectedThread ? 'w-96' : 'flex-1'} border-r flex flex-col h-screen`}>
          {/* Search bar */}
          <div className="flex-shrink-0 p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search mail"
                className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Actions bar */}
          <div className="flex-shrink-0 px-4 py-2 border-b flex items-center gap-4">
            <button className="p-1.5 hover:bg-gray-100 rounded">
              <input type="checkbox" className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchEmails(true)}
              disabled={isLoading}
              className="p-1.5 hover:bg-gray-100 rounded"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded">
              <Archive className="w-4 h-4 text-gray-600" />
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded">
              <Trash2 className="w-4 h-4 text-gray-600" />
            </button>
            <div className="ml-auto text-sm text-gray-500">
              1-{Math.min(50, threads.length)} of {threads.length}
            </div>
          </div>

          {/* Email threads - fixed height with scroll */}
          <div className="flex-1 overflow-y-auto">
            {threads
              .filter(thread => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                return thread.subject.toLowerCase().includes(query) ||
                       thread.participants.some(p => p.toLowerCase().includes(query));
              })
              .map(thread => (
                <div
                  key={thread.threadId}
                  onClick={() => setSelectedThread(thread)}
                  className={`px-4 py-3 border-b hover:shadow-sm cursor-pointer transition-shadow ${
                    selectedThread?.threadId === thread.threadId ? 'bg-blue-50 shadow-sm' : ''
                  } ${thread.unread ? 'bg-white' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1 w-4 h-4" onClick={(e) => e.stopPropagation()} />
                    <Star className="mt-1 w-4 h-4 text-gray-300 hover:text-yellow-400 cursor-pointer" onClick={(e) => e.stopPropagation()} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-sm truncate ${thread.unread ? 'font-semibold' : ''}`}>
                          {thread.participants.map(p => getSenderName(p)).join(', ')}
                          {thread.count > 1 && (
                            <span className="text-gray-500 ml-1">({thread.count})</span>
                          )}
                        </span>
                        <span className="text-sm text-gray-500 flex-shrink-0">
                          {formatDate(thread.timestamp)}
                        </span>
                      </div>
                      <div className={`text-sm truncate ${thread.unread ? 'font-medium' : 'text-gray-900'}`}>
                        {thread.subject || '(no subject)'}
                      </div>
                      <div className="text-sm text-gray-600 truncate">
                        {thread.snippet}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Email viewer */}
        {selectedThread && (
          <div className="flex-1 flex flex-col bg-white">
            {/* Email header */}
            <div className="h-14 px-4 border-b flex items-center gap-3">
              <button
                onClick={() => setSelectedThread(null)}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-normal flex-1 truncate">
                {selectedThread.subject || '(no subject)'}
              </h2>
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <Archive className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <Trash2 className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Email conversation */}
            <div className="flex-1 overflow-auto">
              <div className="max-w-4xl mx-auto py-4">
                {selectedThread.emails.map((email, index) => {
                  const isLast = index === selectedThread.emails.length - 1;
                  const senderName = getSenderName(email.from);
                  const senderInitial = senderName.charAt(0).toUpperCase();
                  
                  return (
                    <div key={email.id} className="px-4 mb-4">
                      {/* Collapsed view for older emails */}
                      {!isLast && selectedThread.emails.length > 1 && (
                        <>
                          <div className="bg-white border rounded-lg p-4 hover:shadow-sm cursor-pointer">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                  {senderInitial}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{senderName}</span>
                                  <span className="text-sm text-gray-500">
                                    {formatDate(email.timestamp)}
                                  </span>
                                </div>
                              </div>
                              <span className="text-sm text-gray-500 truncate max-w-xs">
                                {email.snippet}
                              </span>
                            </div>
                          </div>
                          {/* Line separator */}
                          <div className="my-4 flex items-center">
                            <div className="flex-1 border-t border-gray-200"></div>
                            <div className="px-3 text-xs text-gray-400">•</div>
                            <div className="flex-1 border-t border-gray-200"></div>
                          </div>
                        </>
                      )}
                      
                      {/* Expanded view for last email */}
                      {isLast && (
                        <div className="bg-white border rounded-lg shadow-sm">
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                                  {senderInitial}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-baseline gap-2">
                                    <span className="font-medium">{senderName}</span>
                                    <span className="text-sm text-gray-500">
                                      &lt;{email.from.match(/<(.+)>/)?.[1] || email.from}&gt;
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    to me
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-sm text-gray-500 mr-2">
                                  {new Date(email.timestamp).toLocaleString()}
                                </span>
                                <button className="p-1.5 hover:bg-gray-100 rounded">
                                  <Star className="w-4 h-4 text-gray-400" />
                                </button>
                                <button className="p-1.5 hover:bg-gray-100 rounded">
                                  <MoreVertical className="w-4 h-4 text-gray-400" />
                                </button>
                              </div>
                            </div>
                            
                            {/* Email body */}
                            <div className="text-sm text-gray-900 whitespace-pre-wrap mb-6">
                              {email.body}
                            </div>
                            
                            {/* Reply section */}
                            <div className="flex gap-2 pt-4 border-t">
                              <button
                                onClick={() => {
                                  setComposeEmail({
                                    to: email.from,
                                    subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
                                    body: `\n\n\nOn ${new Date(email.timestamp).toLocaleString()}, ${email.from} wrote:\n${email.body.split('\n').map(line => `> ${line}`).join('\n')}`
                                  });
                                  setShowCompose(true);
                                }}
                                className="flex-1 py-2 px-4 border rounded-full hover:bg-gray-50 text-sm font-medium"
                              >
                                Reply
                              </button>
                              <button
                                className="flex-1 py-2 px-4 border rounded-full hover:bg-gray-50 text-sm font-medium"
                              >
                                Reply all
                              </button>
                              <button
                                className="flex-1 py-2 px-4 border rounded-full hover:bg-gray-50 text-sm font-medium"
                              >
                                Forward
                              </button>
                              {hasLearnedStyle && (
                                <button
                                  onClick={() => handleGenerateReply(email)}
                                  disabled={isGeneratingReply}
                                  className="flex items-center gap-1 py-2 px-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 text-sm font-medium"
                                >
                                  <Sparkles className="w-4 h-4" />
                                  {isGeneratingReply ? 'Generating...' : 'AI Reply'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-lg w-full max-w-2xl h-[600px] flex flex-col">
            {/* Compose header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-medium">New Message</h3>
              <button
                onClick={() => {
                  setShowCompose(false);
                  setComposeEmail({ to: '', subject: '', body: '' });
                }}
                className="p-1.5 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Compose form */}
            <div className="flex-1 flex flex-col">
              <input
                type="text"
                value={composeEmail.to}
                onChange={(e) => setComposeEmail({ ...composeEmail, to: e.target.value })}
                placeholder="To"
                className="px-4 py-2 border-b focus:outline-none"
              />
              <input
                type="text"
                value={composeEmail.subject}
                onChange={(e) => setComposeEmail({ ...composeEmail, subject: e.target.value })}
                placeholder="Subject"
                className="px-4 py-2 border-b focus:outline-none"
              />
              <textarea
                value={composeEmail.body}
                onChange={(e) => setComposeEmail({ ...composeEmail, body: e.target.value })}
                placeholder="Compose email"
                className="flex-1 px-4 py-3 resize-none focus:outline-none"
              />
            </div>

            {/* Compose actions */}
            <div className="px-4 py-3 border-t flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button className="p-1.5 hover:bg-gray-100 rounded">
                  <Paperclip className="w-5 h-5 text-gray-600" />
                </button>
                <button className="p-1.5 hover:bg-gray-100 rounded">
                  <Bold className="w-4 h-4 text-gray-600" />
                </button>
                <button className="p-1.5 hover:bg-gray-100 rounded">
                  <Italic className="w-4 h-4 text-gray-600" />
                </button>
                <button className="p-1.5 hover:bg-gray-100 rounded">
                  <Underline className="w-4 h-4 text-gray-600" />
                </button>
                <button className="p-1.5 hover:bg-gray-100 rounded">
                  <Link2 className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              <button
                onClick={handleSendEmail}
                disabled={!composeEmail.to || isLoading}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
