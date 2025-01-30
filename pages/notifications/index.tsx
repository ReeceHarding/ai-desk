import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { formatDistanceToNow } from 'date-fns';
import { ArchiveIcon, ArrowUpFromLine, Loader2, MailIcon, PencilIcon, SendIcon } from 'lucide-react';
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

type TabType = 'archived' | 'genuine' | 'drafts' | 'auto-sent';

export default function NotificationsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('archived');
  const [draftChats, setDraftChats] = useState<EmailChat[]>([]);
  const [autoSentChats, setAutoSentChats] = useState<EmailChat[]>([]);
  const [archivedChats, setArchivedChats] = useState<EmailChat[]>([]);
  const [genuineChats, setGenuineChats] = useState<EmailChat[]>([]);
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

  const fetchArchivedEmails = useCallback(async (pageNumber: number) => {
    try {
      const from = pageNumber * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      logger.info('Fetching archived emails', { 
        page: pageNumber, 
        from, 
        to,
        itemsPerPage: ITEMS_PER_PAGE 
      });

      const { data: archived, error: archivedError, count } = await supabase
        .from('ticket_email_chats')
        .select('*, metadata', { count: 'exact' })
        .eq('metadata->promotional', true)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (archivedError) {
        logger.error('Error fetching archived emails', { error: archivedError });
        throw archivedError;
      }

      logger.info('Fetched archived emails', { 
        count: archived?.length,
        totalCount: count,
        hasMore: count ? from + ITEMS_PER_PAGE < count : false
      });

      if (count) {
        setHasMore(from + ITEMS_PER_PAGE < count);
      }

      return archived || [];
    } catch (error) {
      logger.error('Error fetching archived emails', { error });
      showToast({
        title: 'Error loading archived emails',
        description: 'Failed to load archived emails. Please try again.',
        variant: 'destructive'
      });
      return [];
    }
  }, [showToast, setHasMore]);

  const fetchGenuineEmails = useCallback(async (pageNumber: number) => {
    try {
      const from = pageNumber * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      logger.info('Fetching genuine emails', { 
        page: pageNumber, 
        from, 
        to,
        itemsPerPage: ITEMS_PER_PAGE 
      });

      const { data: genuine, error: genuineError, count } = await supabase
        .from('ticket_email_chats')
        .select('*, metadata', { count: 'exact' })
        .eq('metadata->promotional', false)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (genuineError) {
        logger.error('Error fetching genuine emails', { error: genuineError });
        throw genuineError;
      }

      logger.info('Fetched genuine emails', { 
        count: genuine?.length,
        totalCount: count,
        hasMore: count ? from + ITEMS_PER_PAGE < count : false
      });

      if (count) {
        setHasMore(from + ITEMS_PER_PAGE < count);
      }

      return genuine || [];
    } catch (error) {
      logger.error('Error fetching genuine emails', { error });
      showToast({
        title: 'Error loading genuine emails',
        description: 'Failed to load genuine emails. Please try again.',
        variant: 'destructive'
      });
      return [];
    }
  }, [showToast, setHasMore]);

  const fetchNotifications = async () => {
    try {
      // Fetch archived emails for first page
      const archived = await fetchArchivedEmails(0);
      
      // Fetch genuine emails for first page
      const genuine = await fetchGenuineEmails(0);
      
      // Fetch other notifications
      const response = await fetch('/api/notifications');
      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.statusText}`);
      }
      const data = await response.json();
      
      setDraftChats(data.drafts);
      setAutoSentChats(data.autoSent);
      setArchivedChats(archived);
      setGenuineChats(genuine);
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
      
      let newEmails: EmailChat[] = [];
      if (activeTab === 'archived') {
        newEmails = await fetchArchivedEmails(nextPage);
        setArchivedChats(prev => [...prev, ...newEmails]);
      } else if (activeTab === 'genuine') {
        newEmails = await fetchGenuineEmails(nextPage);
        setGenuineChats(prev => [...prev, ...newEmails]);
      }
      
      setPage(nextPage);
    } catch (error) {
      logger.error('Error loading more emails', { error });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, activeTab, fetchArchivedEmails, fetchGenuineEmails, setLoadingMore, setArchivedChats, setGenuineChats, setPage]);

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
      if (activeTab === 'archived') {
        setArchivedChats(prev => prev.filter(c => c.id !== chat.id));
      } else if (activeTab === 'genuine') {
        setGenuineChats(prev => prev.filter(c => c.id !== chat.id));
      }
      
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
      className="group relative overflow-hidden rounded-xl bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border border-slate-200/50 dark:border-slate-700/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
      ref={isLast ? lastEmailElementRef : null}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"/>
      <div className="relative p-6 space-y-4">
        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {chat.subject || '(No Subject)'}
            </h3>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500"/>
                {chat.from_name || chat.from_address}
              </span>
              <span className="text-slate-400 dark:text-slate-500">•</span>
              <span className="text-slate-500 dark:text-slate-500">
                {formatDistanceToNow(new Date(chat.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUnarchive(chat)}
              disabled={unarchiving[chat.id]}
              className="relative overflow-hidden group/btn"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700"/>
              <div className="relative flex items-center">
                {unarchiving[chat.id] ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowUpFromLine className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                )}
                <span className="text-blue-600 dark:text-blue-400">Unarchive</span>
              </div>
            </Button>
            
            <Link
              href={`/tickets/${chat.ticket_id}`}
              className="inline-flex items-center px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              View Ticket
            </Link>
          </div>
        </div>

        {/* Archive Reason Section */}
        {chat.metadata?.promotional_reason && (
          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-900/30">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <ArchiveIcon className="h-5 w-5 text-amber-600 dark:text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <span className="font-medium">Archived because: </span>
                  {chat.metadata.promotional_reason}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Archived Status */}
        {chat.metadata?.archivedByAgent && (
          <div className="flex items-center gap-2 mt-4">
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30">
              <span className="text-green-600 dark:text-green-400 text-sm">✓</span>
            </div>
            <p className="text-sm text-green-600 dark:text-green-400">
              Archived from inbox
            </p>
          </div>
        )}
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
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Notifications
          </h1>
          <p className="mt-2 text-sm text-slate-500">Manage your email notifications and drafts</p>
        </div>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)} className="w-full">
          <TabsList className="mb-4 bg-slate-100/50 p-1 rounded-lg">
            <TabsTrigger 
              value="archived" 
              className="rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
            >
              Archived ({archivedChats.length})
            </TabsTrigger>
            <TabsTrigger 
              value="genuine" 
              className="rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
            >
              Genuine ({genuineChats.length})
            </TabsTrigger>
            <TabsTrigger 
              value="drafts" 
              className="rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
            >
              Drafts ({draftChats.length})
            </TabsTrigger>
            <TabsTrigger 
              value="auto-sent" 
              className="rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
            >
              Auto-sent ({autoSentChats.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="archived" className="space-y-4">
            {archivedChats.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <ArchiveIcon className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-1">No archived emails</h3>
                <p className="text-sm text-slate-500">No emails have been archived yet</p>
              </div>
            ) : (
              <>
                <div className="grid gap-4">
                  {archivedChats.map((chat, index) => (
                    <div
                      key={chat.id}
                      ref={index === archivedChats.length - 1 ? lastEmailElementRef : null}
                      className="group relative overflow-hidden rounded-xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"/>
                      <div className="relative p-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <h3 className="text-lg font-medium text-slate-900">
                              {chat.subject || '(No Subject)'}
                            </h3>
                            <div className="space-y-1">
                              <p className="text-sm text-slate-600">
                                From: {chat.from_name || chat.from_address}
                              </p>
                              <p className="text-sm text-slate-500">
                                {formatDistanceToNow(new Date(chat.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            {chat.metadata?.promotional_reason && (
                              <div className="mt-2 p-3 bg-amber-50 rounded-lg">
                                <p className="text-sm text-amber-700">
                                  <span className="font-medium">Archived because: </span>
                                  {chat.metadata.promotional_reason}
                                </p>
                              </div>
                            )}
                            {chat.metadata?.archivedByAgent && (
                              <p className="text-sm text-green-600 flex items-center gap-1">
                                <span className="rounded-full bg-green-100 p-1">✓</span>
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
                              className="text-blue-600 hover:text-blue-700"
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
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              View Ticket
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="genuine" className="space-y-4">
            {genuineChats.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <MailIcon className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-1">No genuine emails</h3>
                <p className="text-sm text-slate-500">No genuine emails have been received yet</p>
              </div>
            ) : (
              <>
                <div className="grid gap-4">
                  {genuineChats.map((chat, index) => (
                    <div
                      key={chat.id}
                      ref={index === genuineChats.length - 1 ? lastEmailElementRef : null}
                      className="group relative overflow-hidden rounded-xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"/>
                      <div className="relative p-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <h3 className="text-lg font-medium text-slate-900">
                              {chat.subject || '(No Subject)'}
                            </h3>
                            <div className="space-y-1">
                              <p className="text-sm text-slate-600">
                                From: {chat.from_name || chat.from_address}
                              </p>
                              <p className="text-sm text-slate-500">
                                {formatDistanceToNow(new Date(chat.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <Link
                            href={`/tickets/${chat.ticket_id}`}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            View Ticket
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
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
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <PencilIcon className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-1">No draft responses</h3>
                <p className="text-sm text-slate-500">No AI draft responses are waiting for review</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {draftChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="group relative overflow-hidden rounded-xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"/>
                    <div className="relative p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-2">
                          <h3 className="text-lg font-medium text-slate-900">
                            {chat.subject || '(No Subject)'}
                          </h3>
                          <div className="space-y-1">
                            <p className="text-sm text-slate-600">
                              From: {chat.from_name || chat.from_address}
                            </p>
                            <p className="text-sm text-slate-500">
                              {formatDistanceToNow(new Date(chat.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          {chat.ai_confidence !== undefined && (
                            <p className={`text-sm ${getConfidenceColor(chat.ai_confidence)}`}>
                              AI Confidence: {chat.ai_confidence}%
                            </p>
                          )}
                        </div>
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
                            {sending[chat.id] ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Sending...
                              </>
                            ) : (
                              'Send'
                            )}
                          </Button>
                        </div>
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="auto-sent" className="space-y-4">
            {autoSentChats.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <SendIcon className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-1">No auto-sent responses</h3>
                <p className="text-sm text-slate-500">No responses have been automatically sent yet</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {autoSentChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="group relative overflow-hidden rounded-xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"/>
                    <div className="relative p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-2">
                          <h3 className="text-lg font-medium text-slate-900">
                            {chat.subject || '(No Subject)'}
                          </h3>
                          <div className="space-y-1">
                            <p className="text-sm text-slate-600">
                              From: {chat.from_name || chat.from_address}
                            </p>
                            <p className="text-sm text-slate-500">
                              {formatDistanceToNow(new Date(chat.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          {chat.ai_confidence !== undefined && (
                            <p className={`text-sm ${getConfidenceColor(chat.ai_confidence)}`}>
                              AI Confidence: {chat.ai_confidence}%
                            </p>
                          )}
                        </div>
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
} 