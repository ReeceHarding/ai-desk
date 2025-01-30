import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpFromLine, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

const ITEMS_PER_PAGE = 10;

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
  metadata?: {
    promotional?: boolean;
    promotional_reason?: string;
    archivedByAgent?: boolean;
  };
  org_id?: string;
}

type TabType = 'drafts' | 'auto-sent' | 'promotional';

export default function NotificationsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('promotional');
  const [draftChats, setDraftChats] = useState<EmailChat[]>([]);
  const [autoSentChats, setAutoSentChats] = useState<EmailChat[]>([]);
  const [promotionalChats, setPromotionalChats] = useState<EmailChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [unarchiving, setUnarchiving] = useState<Record<string, boolean>>({});
  const loadMoreRef = useRef(null);

  const showToast = useCallback((props: { title: string; description: string; variant?: 'default' | 'destructive' }) => {
    toast(props);
  }, [toast]);

  const fetchPromotionalEmails = useCallback(async (pageNumber: number) => {
    try {
      const from = pageNumber * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      logger.info('Fetching promotional emails', { 
        page: pageNumber, 
        from, 
        to,
        itemsPerPage: ITEMS_PER_PAGE 
      });

      const { data: promotional, error: promotionalError, count } = await supabase
        .from('ticket_email_chats')
        .select('*, metadata', { count: 'exact' })
        .eq('metadata->promotional', true)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (promotionalError) {
        logger.error('Error fetching promotional emails', { error: promotionalError });
        throw promotionalError;
      }

      logger.info('Fetched promotional emails', { 
        count: promotional?.length,
        totalCount: count,
        hasMore: count ? from + ITEMS_PER_PAGE < count : false
      });

      if (count) {
        setHasMore(from + ITEMS_PER_PAGE < count);
      }

      return promotional || [];
    } catch (error) {
      logger.error('Error fetching promotional emails', { error });
      showToast({
        title: 'Error loading promotional emails',
        description: 'Failed to load promotional emails. Please try again.',
        variant: 'destructive'
      });
      return [];
    }
  }, [showToast, setHasMore]);

  const fetchNotifications = async () => {
    try {
      // Fetch promotional emails for first page
      const promotional = await fetchPromotionalEmails(0);
      
      // Fetch other notifications
      const response = await fetch('/api/notifications');
      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.statusText}`);
      }
      const data = await response.json();
      
      setDraftChats(data.drafts);
      setAutoSentChats(data.autoSent);
      setPromotionalChats(promotional);
      setPage(0);
    } catch (error) {
      logger.error('Error fetching notifications', { error });
      showToast({
        title: 'Error loading notifications',
        description: 'Failed to load notifications. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) {
      logger.info('Skipping loadMore', { loadingMore, hasMore });
      return;
    }
    
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      logger.info('Loading more emails', { currentPage: page, nextPage });
      
      const newEmails = await fetchPromotionalEmails(nextPage);
      
      setPromotionalChats(prev => [...prev, ...newEmails]);
      setPage(nextPage);
    } catch (error) {
      logger.error('Error loading more emails', { error });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, fetchPromotionalEmails, setLoadingMore, setPromotionalChats, setPage]);

  // Intersection Observer for infinite scroll
  const observer = useRef<IntersectionObserver | null>(null);
  const lastEmailElementRef = useCallback((node: HTMLDivElement | null): void => {
    if (loadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
      if (entries.length > 0 && entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loadingMore, hasMore, loadMore]);

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
      showToast({
        title: 'Error sending draft',
        description: 'Missing thread or message information.',
        variant: 'destructive'
      });
      return;
    }

    setSending(prev => ({ ...prev, [chat.id]: true }));
    try {
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
        throw error;
      }

      await fetchNotifications();
      showToast({
        title: 'Draft sent successfully',
        description: 'The AI response has been sent to the customer.',
        variant: 'default'
      });
    } catch (error) {
      logger.error('Error sending draft', { error, chatId: chat.id });
      showToast({
        title: 'Error sending draft',
        description: 'Failed to send the AI response. Please try again.',
        variant: 'destructive'
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
      showToast({
        title: 'Draft discarded',
        description: 'The AI response has been discarded.',
        variant: 'default'
      });
    } catch (error) {
      console.error('Error discarding draft:', error);
      showToast({
        title: 'Error discarding draft',
        description: 'Failed to discard the AI response.',
        variant: 'destructive'
      });
    }
  };

  const handleUnarchive = async (chat: EmailChat) => {
    if (!chat.message_id || !chat.org_id) {
      showToast({
        title: 'Error unarchiving email',
        description: 'Missing required information to unarchive email.',
        variant: 'destructive'
      });
      return;
    }

    setUnarchiving(prev => ({ ...prev, [chat.id]: true }));
    try {
      const response = await fetch('/api/emails/unarchive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketEmailChatId: chat.id,
          orgId: chat.org_id,
          messageId: chat.message_id,
          reason: 'Manually unarchived by user'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to unarchive email');
      }

      // Remove from promotional chats list
      setPromotionalChats(prev => prev.filter(c => c.id !== chat.id));
      
      showToast({
        title: 'Email unarchived',
        description: 'The email has been restored to your inbox.',
        variant: 'default'
      });
    } catch (error: any) {
      console.error('Error unarchiving email:', error);
      showToast({
        title: 'Error unarchiving email',
        description: error.message || 'Failed to unarchive the email.',
        variant: 'destructive'
      });
    } finally {
      setUnarchiving(prev => ({ ...prev, [chat.id]: false }));
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
          href={`/tickets/${chat.ticket_id}`}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View Ticket
        </Link>
      </div>
    </Card>
  );

  const renderPromotionalCard = (chat: EmailChat, isLast: boolean) => (
    <Card 
      key={chat.id} 
      className="p-6 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow duration-200"
      ref={isLast ? lastEmailElementRef : null}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
            {chat.subject || '(No Subject)'}
          </h3>
          <div className="space-y-1">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              From: {chat.from_name || chat.from_address}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              {formatDistanceToNow(new Date(chat.created_at), { addSuffix: true })}
            </p>
          </div>
          {chat.metadata?.promotional_reason && (
            <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <span className="font-medium">Archived because: </span>
                {chat.metadata.promotional_reason}
              </p>
            </div>
          )}
          {chat.metadata?.archivedByAgent && (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
              <span className="rounded-full bg-green-100 dark:bg-green-900/30 p-1">✓</span>
              Archived from inbox
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleUnarchive(chat)}
            disabled={unarchiving[chat.id]}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {unarchiving[chat.id] ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowUpFromLine className="h-4 w-4 mr-2" />
            )}
            Unarchive
          </Button>
          <Link
            href={`/tickets/${chat.ticket_id}`}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            View Ticket
          </Link>
        </div>
      </div>
    </Card>
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">Notifications</h2>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
          <TabsList className="mb-4">
            <TabsTrigger value="promotional">
              Promotional ({promotionalChats.length})
            </TabsTrigger>
            <TabsTrigger value="drafts">
              Drafts ({draftChats.length})
            </TabsTrigger>
            <TabsTrigger value="auto-sent">
              Auto-sent ({autoSentChats.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="promotional" className="space-y-4">
            {promotionalChats.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-600 dark:text-slate-400">No promotional emails archived.</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {promotionalChats.map((chat, index) => 
                    renderPromotionalCard(chat, index === promotionalChats.length - 1)
                  )}
                </div>
                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                )}
              </>
            )}
          </TabsContent>
          
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
              autoSentChats.map((chat) => renderEmailCard(chat))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
} 