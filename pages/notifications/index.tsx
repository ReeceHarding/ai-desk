import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { Database } from '@/types/supabase';
import { sendDraftResponse } from '@/utils/ai-email-processor';
import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const supabase = createClientComponentClient<Database>();

interface EmailChat {
  id: string;
  ticket_id: string;
  subject: string;
  ai_draft_response: string;
  created_at: string;
  from_address: string;
  thread_id?: string;
  message_id?: string;
  ai_confidence?: number;
}

type TabType = 'drafts' | 'auto-sent';

interface DraftChat {
  id: string;
  ticket_id: string;
  subject: string | null;
  ai_draft_response: string;
  created_at: string;
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('drafts');
  const [draftChats, setDraftChats] = useState<EmailChat[]>([]);
  const [autoSentChats, setAutoSentChats] = useState<EmailChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [draftChatsState, setDraftChatsState] = useState<DraftChat[]>([]);

  const fetchDrafts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      logger.info('Fetching draft emails', { userId: user?.id });
      const { data, error } = await supabase
        .from('ticket_email_chats')
        .select('id, ticket_id, subject, ai_draft_response, created_at, from_address, thread_id, message_id, ai_confidence')
        .eq('ai_auto_responded', false)
        .not('ai_draft_response', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching drafts', { error, userId: user?.id });
        throw error;
      }
      setDraftChats(data || []);
    } catch (error) {
      logger.error('Error in fetchDrafts', { error });
      console.error('Error fetching drafts:', error);
      toast({
        title: 'Error loading drafts',
        description: 'Failed to load AI draft responses. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const fetchAutoSent = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      logger.info('Fetching auto-sent emails', { userId: user?.id });
      const { data, error } = await supabase
        .from('ticket_email_chats')
        .select('id, ticket_id, subject, ai_draft_response, created_at, from_address, thread_id, message_id, ai_confidence')
        .eq('ai_auto_responded', true)
        .not('ai_draft_response', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching auto-sent emails', { error, userId: user?.id });
        throw error;
      }
      setAutoSentChats(data || []);
    } catch (error) {
      logger.error('Error in fetchAutoSent', { error });
      console.error('Error fetching auto-sent emails:', error);
      toast({
        title: 'Error loading auto-sent emails',
        description: 'Failed to load auto-sent AI responses. Please try again.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchDrafts(), fetchAutoSent()]);
      setLoading(false);
    };

    fetchData();

    // Set up real-time subscription for changes
    const channel = supabase
      .channel('ticket_email_chats_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_email_chats',
        },
        () => {
          // Refresh both lists when any changes occur
          fetchDrafts();
          fetchAutoSent();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sendReply = async (params: {
    threadId: string;
    inReplyTo: string;
    to: string[];
    subject: string;
    htmlBody: string;
  }) => {
    try {
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`Failed to send email: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      logger.error('Failed to send reply', { error });
      throw error;
    }
  };

  const handleSendDraft = async (chat: EmailChat) => {
    if (!chat.thread_id || !chat.message_id) {
      logger.error('Missing thread or message information', { chatId: chat.id });
      toast({
        title: 'Error sending draft',
        description: 'Missing thread or message information.',
        variant: 'destructive',
      });
      return;
    }

    setSending(prev => ({ ...prev, [chat.id]: true }));
    try {
      logger.info('Sending draft email', { chatId: chat.id });
      await sendReply({
        threadId: chat.thread_id,
        inReplyTo: chat.message_id,
        to: [chat.from_address],
        subject: `Re: ${chat.subject || 'Support Request'}`,
        htmlBody: chat.ai_draft_response,
      });

      const { error } = await supabase
        .from('ticket_email_chats')
        .update({ ai_auto_responded: true })
        .eq('id', chat.id);

      if (error) {
        logger.error('Error updating chat status', { error, chatId: chat.id });
        throw error;
      }

      setDraftChats(prev => prev.filter(c => c.id !== chat.id));
      await fetchAutoSent();

      logger.info('Draft sent successfully', { chatId: chat.id });
      toast({
        title: 'Draft sent successfully',
        description: 'The AI response has been sent to the customer.',
      });
    } catch (error) {
      logger.error('Error sending draft', { error, chatId: chat.id });
      console.error('Error sending draft:', error);
      toast({
        title: 'Error sending draft',
        description: 'Failed to send the AI response. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(prev => ({ ...prev, [chat.id]: false }));
    }
  };

  const handleDiscard = async (chat: EmailChat) => {
    try {
      const { error } = await supabase
        .from('ticket_email_chats')
        .update({ ai_draft_response: null })
        .eq('id', chat.id);

      if (error) throw error;

      setDraftChats(prev => prev.filter(c => c.id !== chat.id));

      toast({
        title: 'Draft discarded',
        description: 'The AI response has been discarded.',
      });
    } catch (error) {
      console.error('Error discarding draft:', error);
      toast({
        title: 'Error discarding draft',
        description: 'Failed to discard the AI response.',
        variant: 'destructive',
      });
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const renderEmailCard = (chat: EmailChat, isDraft = false) => (
    <Card key={chat.id} className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-lg mb-1">
            {chat.subject || '(No Subject)'}
          </h3>
          <p className="text-sm text-gray-600">
            From: {chat.from_address}
          </p>
          <p className="text-sm text-gray-500">
            {formatDistanceToNow(new Date(chat.created_at), { addSuffix: true })}
          </p>
          {chat.ai_confidence && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">Confidence:</span>
              <span 
                className={`text-sm font-medium ${getConfidenceColor(chat.ai_confidence)}`}
                title={`${chat.ai_confidence >= 85 ? 'High confidence - auto-sent' : 'Lower confidence - requires review'}`}
              >
                {chat.ai_confidence.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <>
              <Button
                variant="default"
                onClick={() => handleSendDraft(chat)}
                disabled={sending[chat.id]}
              >
                {sending[chat.id] ? 'Sending...' : 'Send Response'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDiscard(chat)}
                disabled={sending[chat.id]}
              >
                Discard
              </Button>
            </>
          )}
          <Link
            href={`/tickets/${chat.ticket_id}`}
            className="inline-flex"
          >
            <Button variant="ghost">View Ticket</Button>
          </Link>
        </div>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg mb-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-medium">AI {isDraft ? 'Draft ' : ''}Response:</h4>
          {!isDraft && (
            <span className="text-sm text-green-600 font-medium">
              Auto-sent
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap text-gray-700">
          {chat.ai_draft_response}
        </p>
      </div>
    </Card>
  );

  const loadDrafts = async () => {
    try {
      setLoading(true);
      // Find all ticket_email_chats with ai_draft_response, not auto_responded
      const { data, error } = await supabase
        .from('ticket_email_chats')
        .select('id, ticket_id, subject, ai_draft_response, created_at')
        .eq('ai_auto_responded', false)
        .not('ai_draft_response', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDraftChatsState(data || []);
    } catch (error) {
      console.error('Error loading drafts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load AI drafts. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendDraftState = async (chatId: string) => {
    try {
      await sendDraftResponse(chatId);
      toast({
        title: 'Success',
        description: 'AI draft has been sent successfully.',
      });
      // Refresh the list
      loadDrafts();
    } catch (error) {
      console.error('Error sending draft:', error);
      toast({
        title: 'Error',
        description: 'Failed to send AI draft. Please try again.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    loadDrafts();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">AI Email Responses</h1>
            <TabsList>
              <TabsTrigger value="drafts">
                Drafts {draftChats.length > 0 && `(${draftChats.length})`}
              </TabsTrigger>
              <TabsTrigger value="auto-sent">
                Auto-sent {autoSentChats.length > 0 && `(${autoSentChats.length})`}
              </TabsTrigger>
            </TabsList>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading notifications...</div>
          ) : (
            <>
              <TabsContent value="drafts">
                {draftChats.length === 0 ? (
                  <div className="text-center py-8 text-gray-600">
                    No AI-drafted emails awaiting approval.
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {draftChats.map(chat => renderEmailCard(chat, true))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="auto-sent">
                {autoSentChats.length === 0 ? (
                  <div className="text-center py-8 text-gray-600">
                    No auto-sent AI responses yet.
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {autoSentChats.map(chat => renderEmailCard(chat, false))}
                  </div>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
} 