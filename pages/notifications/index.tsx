import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { Database } from '@/types/supabase';
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
  from_name?: string;
  thread_id?: string;
  message_id?: string;
  ai_confidence?: number;
}

type TabType = 'drafts' | 'auto-sent';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('drafts');
  const [draftChats, setDraftChats] = useState<EmailChat[]>([]);
  const [autoSentChats, setAutoSentChats] = useState<EmailChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<Record<string, boolean>>({});

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications');
      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.statusText}`);
      }
      const data = await response.json();
      setDraftChats(data.drafts);
      setAutoSentChats(data.autoSent);
    } catch (error) {
      logger.error('Error fetching notifications', { error });
      toast({
        title: 'Error loading notifications',
        description: 'Failed to load notifications. Please try again.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await fetchNotifications();
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
          // Refresh notifications when any changes occur
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId: chat.thread_id,
          inReplyTo: chat.message_id,
          to: [chat.from_address],
          subject: `Re: ${chat.subject || 'Support Request'}`,
          htmlBody: chat.ai_draft_response,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send email: ${response.statusText}`);
      }

      const { error } = await supabase
        .from('ticket_email_chats')
        .update({ ai_auto_responded: true })
        .eq('id', chat.id);

      if (error) {
        logger.error('Error updating chat status', { error, chatId: chat.id });
        throw error;
      }

      await fetchNotifications();

      logger.info('Draft sent successfully', { chatId: chat.id });
      toast({
        title: 'Draft sent successfully',
        description: 'The AI response has been sent to the customer.',
      });
    } catch (error) {
      logger.error('Error sending draft', { error, chatId: chat.id });
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

      await fetchNotifications();

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
          <p className="text-sm text-gray-500">
            From: {chat.from_name || chat.from_address}
          </p>
          <p className="text-sm text-gray-500">
            {formatDistanceToNow(new Date(chat.created_at), { addSuffix: true })}
          </p>
          {chat.ai_confidence !== undefined && (
            <p className={`text-sm ${getConfidenceColor(chat.ai_confidence)}`}>
              AI Confidence: {chat.ai_confidence}%
            </p>
          )}
        </div>
        {isDraft && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleDiscard(chat)}
              disabled={sending[chat.id]}
            >
              Discard
            </Button>
            <Button
              onClick={() => handleSendDraft(chat)}
              disabled={sending[chat.id]}
            >
              {sending[chat.id] ? 'Sending...' : 'Send'}
            </Button>
          </div>
        )}
      </div>
      <div className="prose max-w-none">
        <div dangerouslySetInnerHTML={{ __html: chat.ai_draft_response }} />
      </div>
      <div className="mt-4">
        <Link
          href={`/organizations/${chat.ticket_id}`}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View Ticket
        </Link>
      </div>
    </Card>
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">Loading notifications...</h2>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Notifications</h2>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
          <TabsList>
            <TabsTrigger value="drafts">
              Drafts ({draftChats.length})
            </TabsTrigger>
            <TabsTrigger value="auto-sent">
              Auto-sent ({autoSentChats.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="drafts" className="space-y-4">
            {draftChats.length === 0 ? (
              <p>No draft responses available.</p>
            ) : (
              draftChats.map((chat) => renderEmailCard(chat, true))
            )}
          </TabsContent>
          <TabsContent value="auto-sent" className="space-y-4">
            {autoSentChats.length === 0 ? (
              <p>No auto-sent responses available.</p>
            ) : (
              autoSentChats.map((chat) => renderEmailCard(chat, false))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
} 