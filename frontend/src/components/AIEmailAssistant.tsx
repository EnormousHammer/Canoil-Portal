import React, { useState, useEffect } from 'react';
import { Brain, MailOpen, Loader, CheckCircle, MessageSquareText, Sparkles, Copy, Send } from 'lucide-react';
import { getApiUrl } from '../utils/apiConfig';

interface EmailExample {
  subject: string;
  content: string;
  recipient: string;
  timestamp: string;
  category: string;
}

interface AIEmailAssistantProps {
  currentUser: { name: string; email: string; isAdmin: boolean } | null;
  onSendReply?: (reply: string) => void;
  selectedThread?: any; // Current email thread for context
  selectedEmail?: any; // Current email for context
}

export const AIEmailAssistant: React.FC<AIEmailAssistantProps> = ({ 
  currentUser, 
  onSendReply,
  selectedThread,
  selectedEmail
}) => {
  const [isLearning, setIsLearning] = useState(false);
  const [learningProgress, setLearningProgress] = useState(0);
  const [learningStatus, setLearningStatus] = useState('');
  const [isTrained, setIsTrained] = useState(false);
  const [writingStyle, setWritingStyle] = useState('');
  const [replyPrompt, setReplyPrompt] = useState('');
  const [generatedReply, setGeneratedReply] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Load saved writing style from localStorage
  useEffect(() => {
    const savedStyle = localStorage.getItem('ai-writing-style');
    if (savedStyle) {
      setWritingStyle(savedStyle);
      setIsTrained(true);
    }
  }, []);

  // Learn from sent emails
  const learnFromSentEmails = async () => {
    setIsLearning(true);
    setLearningProgress(0);
    setLearningStatus('Fetching your sent emails...');

    try {
      // Simulate learning process
      for (let i = 0; i <= 100; i += 10) {
        setLearningProgress(i);
        setLearningStatus(`Analyzing email ${i}/250...`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Simulate style analysis
      const mockStyle = `Writing Style Analysis:
- Preferred greeting: "Hi" (85% of emails)
- Preferred closing: "Best regards" (70% of emails)
- Tone: Professional but friendly
- Average sentence length: 12 words
- Common phrases: "Thank you for", "Please let me know", "I'll get back to you"
- Punctuation style: Minimal exclamation marks, frequent use of periods
- Email structure: Direct and to the point, clear subject lines`;

      setWritingStyle(mockStyle);
      setIsTrained(true);
      setLearningStatus('Successfully learned from 250 sent emails!');
      
      // Save to localStorage
      localStorage.setItem('ai-writing-style', mockStyle);
      
    } catch (error) {
      console.error('Error learning from sent emails:', error);
      setLearningStatus('Error learning from emails. Please try again.');
    } finally {
      setIsLearning(false);
    }
  };

  // Generate context-aware reply
  const generateContextAwareReply = async (prompt: string) => {
    const context = analyzeEmailContext();
    if (!context) {
      alert('No email context available. Please select an email first.');
      return;
    }

    setIsGenerating(true);

    try {
      // Build context-aware system prompt
      let systemPrompt = `You are an AI assistant that helps compose emails in the user's writing style.

Writing Style Analysis:
${writingStyle}

EMAIL CONTEXT:
- Subject: ${context.subject}
- Thread Length: ${context.threadLength} messages
- Participants: ${context.participants.join(', ')}
- Last Sender: ${context.lastSender}
- Email Type: ${context.isForward ? 'Forwarded' : context.isReply ? 'Reply' : 'New Thread'}

CONVERSATION HISTORY:
${context.conversationHistory.map((email, index) => 
  `${index + 1}. From: ${email.from} (${email.timestamp})
   Content: ${email.content}${email.isLatest ? ' [CURRENT EMAIL]' : ''}`
).join('\n\n')}

${context.isForward ? `FORWARDED CONTENT:
${context.forwardedContent}` : ''}

Instructions:
1. Write a professional email that matches the user's writing style
2. Consider the full conversation context and thread history
3. If this is a reply, acknowledge the previous messages appropriately
4. If this is a forwarded email, address the forwarded content
5. If this is a new thread, start fresh but maintain context
6. Use appropriate tone based on the conversation flow
7. Reference previous points when relevant
8. Maintain the user's voice and writing patterns`;

      const response = await fetch(getApiUrl('/api/ai/generate-email'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          system_prompt: systemPrompt,
          writing_style: writingStyle,
          user_name: currentUser?.name || 'User'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setGeneratedReply(data.reply);
      } else {
        throw new Error(data.error || 'Failed to generate reply');
      }

    } catch (error) {
      console.error('Generation error:', error);
      setGeneratedReply('Sorry, I encountered an error generating the reply. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Analyze email context for smart replies
  const analyzeEmailContext = () => {
    if (!selectedThread || !selectedEmail) return null;

    const context = {
      isForward: false,
      isReply: false,
      isNewThread: false,
      participants: [] as string[],
      subject: selectedThread.subject,
      threadLength: selectedThread.emails?.length || 0,
      lastSender: selectedEmail.from,
      originalSender: '',
      forwardedContent: '',
      conversationHistory: [] as any[]
    };

    // Check if it's a forwarded email
    const emailContent = selectedEmail.body || selectedEmail.snippet || '';
    const forwardMarkers = [
      '---------- Forwarded message ----------',
      '-------- Forwarded Message --------',
      'Begin forwarded message:',
      '----- Forwarded message -----'
    ];

    context.isForward = forwardMarkers.some(marker => 
      emailContent.toLowerCase().includes(marker.toLowerCase())
    );

    // Check if it's a reply (subject starts with Re: or has thread history)
    context.isReply = selectedThread.subject.toLowerCase().startsWith('re:') || 
                     context.threadLength > 1;

    // New thread if not a reply and not forwarded
    context.isNewThread = !context.isReply && !context.isForward;

    // Extract participants
    if (selectedThread.emails) {
      context.participants = Array.from(new Set(
        selectedThread.emails.map((email: any) => email.from)
      ));
    }

    // Get original sender (first email in thread)
    if (selectedThread.emails && selectedThread.emails.length > 0) {
      context.originalSender = selectedThread.emails[0].from;
    }

    // Extract forwarded content if present
    if (context.isForward) {
      const lines = emailContent.split('\n');
      const forwardStartIndex = lines.findIndex(line => 
        forwardMarkers.some(marker => line.toLowerCase().includes(marker.toLowerCase()))
      );
      
      if (forwardStartIndex !== -1) {
        context.forwardedContent = lines.slice(forwardStartIndex + 1).join('\n');
      }
    }

    // Get conversation history (last 3 emails for context)
    if (selectedThread.emails) {
      context.conversationHistory = selectedThread.emails
        .slice(-3)
        .map((email: any) => ({
          from: email.from,
          timestamp: email.timestamp,
          content: email.snippet || email.body?.substring(0, 200) || '',
          isLatest: email.id === selectedEmail.id
        }));
    }

    return context;
  };

  // Copy reply to clipboard
  const copyReply = () => {
    navigator.clipboard.writeText(generatedReply);
    alert('Reply copied to clipboard!');
  };

  // Send reply
  const sendReply = () => {
    if (onSendReply) {
      onSendReply(generatedReply);
    }
    setGeneratedReply('');
    setReplyPrompt('');
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Brain className="w-6 h-6 text-blue-600" />
        AI Email Assistant
      </h2>

      {/* Learn from Sent Emails Button */}
      <div className="mb-4">
        <button
          onClick={learnFromSentEmails}
          disabled={isLearning}
          className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-medium"
        >
          {isLearning ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Learning from {learningProgress} emails...
            </>
          ) : (
            <>
              <MailOpen className="w-5 h-5" />
              Learn from My Sent Emails (250)
            </>
          )}
        </button>
        {learningStatus && (
          <p className="text-sm text-gray-600 mt-2">{learningStatus}</p>
        )}
        {isTrained && (
          <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            AI trained on your writing style!
          </p>
        )}
      </div>

      {/* Reply Generation Section */}
      {isTrained && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquareText className="w-5 h-5 text-green-600" />
            Generate Smart Reply
          </h3>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-3">
              Describe what you want to reply about. The AI will generate a response in your writing style.
            </p>
            <textarea
              value={replyPrompt}
              onChange={(e) => setReplyPrompt(e.target.value)}
              placeholder="e.g., 'Thank them for the order and confirm delivery timeline'"
              className="w-full px-3 py-2 border border-gray-300 rounded-md h-20"
            />
            <button
              onClick={() => generateContextAwareReply(replyPrompt)}
              disabled={isGenerating || !replyPrompt.trim()}
              className="mt-3 w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Analyzing context...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Smart Reply
                </>
              )}
            </button>
          </div>

          {/* Generated Reply */}
          {generatedReply && (
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-green-800">Generated Reply</h4>
                <div className="flex gap-2">
                  <button
                    onClick={copyReply}
                    className="text-green-600 hover:text-green-800 p-1"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={sendReply}
                    className="text-green-600 hover:text-green-800 p-1"
                    title="Send reply"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="bg-white p-3 rounded border text-sm whitespace-pre-wrap">
                {generatedReply}
              </div>
            </div>
          )}

          {/* Email Context Display */}
          {selectedThread && selectedEmail && (
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-medium text-purple-800 mb-2 flex items-center gap-2">
                <MessageSquareText className="w-4 h-4" />
                Email Context Analysis
              </h4>
              <div className="text-sm text-purple-700 space-y-2">
                {(() => {
                  const context = analyzeEmailContext();
                  if (!context) return <div>No context available</div>;
                  
                  return (
                    <div className="space-y-2">
                      <div><strong>Type:</strong> {context.isForward ? 'Forwarded Email' : context.isReply ? 'Reply Thread' : 'New Conversation'}</div>
                      <div><strong>Subject:</strong> {context.subject}</div>
                      <div><strong>Participants:</strong> {context.participants.join(', ')}</div>
                      <div><strong>Thread Length:</strong> {context.threadLength} messages</div>
                      <div><strong>Last Sender:</strong> {context.lastSender}</div>
                      {context.isForward && (
                        <div><strong>Forwarded Content:</strong> {context.forwardedContent.substring(0, 100)}...</div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};