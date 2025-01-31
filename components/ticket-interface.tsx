import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { format, formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import {
    AlertCircle,
    Bell,
    BellOff,
    Book,
    Brain,
    Calendar,
    CheckCircle,
    ChevronLeft,
    Clock,
    EyeOff,
    FileText,
    Inbox,
    Lock,
    Mail,
    MailPlus,
    MoreHorizontal,
    Share2,
    Star,
    Timer,
    UserPlus,
    Users
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { EmailComposer } from '../components/email-composer';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Label } from "../components/ui/label";
import { Spinner } from "../components/ui/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { useToast } from '../components/ui/use-toast';
import { Database } from '../types/supabase';
import { EmailThreadPanel } from './email-thread-panel';
import { TicketConversationPanel } from './ticket-conversation-panel';
import { TicketDetailsPanel } from './ticket-details-panel';

type Profile = {
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type Organization = {
  name: string | null;
};

type TicketMetadata = {
  merged_into?: string;
  merged_from?: string;
  type?: string;
  [key: string]: any;
};

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  customer: Profile | null;
  organization: Organization | null;
  sla_breach_at?: string;
  thread_id?: string;
  message_id?: string;
  metadata: TicketMetadata;
};

const statusColors: Record<string, string> = {
  open: 'bg-blue-500/10 text-blue-500',
  pending: 'bg-yellow-500/10 text-yellow-500',
  on_hold: 'bg-orange-500/10 text-orange-500',
  solved: 'bg-green-500/10 text-green-500',
  closed: 'bg-slate-500/10 text-slate-500',
};

const priorityColors: Record<string, string> = {
  low: 'bg-blue-500/10 text-blue-500',
  medium: 'bg-yellow-500/10 text-yellow-500',
  high: 'bg-orange-500/10 text-orange-500',
  urgent: 'bg-red-500/10 text-red-500',
};

const StatusIcon = ({ status }: { status: string }) => {
  const icons = {
    open: Inbox,
    pending: Clock,
    on_hold: EyeOff,
    solved: CheckCircle,
    closed: Lock,
  };
  const Icon = icons[status as keyof typeof icons] || AlertCircle;
  return <Icon className="h-4 w-4" />;
};

interface TicketInterfaceProps {
  ticket: Ticket;
  onStatusChange: (status: Ticket['status']) => void;
  onPriorityChange: (priority: Ticket['priority']) => void;
  onAssigneeChange?: (assigneeId: string) => void;
  isStarred?: boolean;
  onStarToggle?: () => void;
  isSubscribed?: boolean;
  onSubscribeToggle?: () => void;
}

export function TicketInterface({
  ticket,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  isStarred = false,
  onStarToggle,
  isSubscribed = true,
  onSubscribeToggle,
}: TicketInterfaceProps) {
  const router = useRouter();
  const [isEmailPanelOpen, setIsEmailPanelOpen] = useState(false);
  const [isKbSearchOpen, setIsKbSearchOpen] = useState(false);
  const [isQuickReplyOpen, setIsQuickReplyOpen] = useState(false);
  const [quickReplyText, setQuickReplyText] = useState('');
  const [isAiDraft, setIsAiDraft] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const supabase = useSupabaseClient();
  const [agents, setAgents] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [macros, setMacros] = useState<any[]>([]);
  const [kbSearchQuery, setKbSearchQuery] = useState('');
  const [kbSearchResults, setKbSearchResults] = useState<any[]>([]);
  const [isKbSearching, setIsKbSearching] = useState(false);
  const [isGeneratingAiResponse, setIsGeneratingAiResponse] = useState(false);
  const [isInternalNoteOpen, setIsInternalNoteOpen] = useState(false);
  const [internalNoteText, setInternalNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [mergeSearchQuery, setMergeSearchQuery] = useState('');
  const [mergeSearchResults, setMergeSearchResults] = useState<any[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  const handleQuickReply = async () => {
    if (!quickReplyText.trim()) return;

    try {
      setIsSending(true);

      // 1. Create a comment
      const { data: comment, error: commentError } = await supabase
        .from('comments')
        .insert({
          ticket_id: ticket.id,
          body: quickReplyText,
          is_private: false,
          org_id: ticket.org_id,
          metadata: {
            is_email_reply: true,
            ai_generated: isAiDraft
          }
        })
        .select()
        .single();

      if (commentError) throw commentError;

      // 2. Create email log
      const { error: emailError } = await supabase
        .from('email_logs')
        .insert({
          ticket_id: ticket.id,
          message_id: `reply_${Date.now()}`,
          thread_id: ticket.thread_id || `thread_${ticket.id}`,
          direction: 'outbound',
          subject: `Re: ${ticket.subject}`,
          body: quickReplyText,
          org_id: ticket.org_id,
          metadata: {
            comment_id: comment.id,
            ai_generated: isAiDraft
          }
        });

      if (emailError) throw emailError;

      // 3. Close dialog and show success
      setIsQuickReplyOpen(false);
      setQuickReplyText('');
      toast({
        title: "Reply sent",
        description: "Your reply has been sent successfully.",
      });

    } catch (error) {
      console.error('Error sending reply:', error);
      toast({
        title: "Error sending reply",
        description: error instanceof Error ? error.message : "Failed to send reply",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKbSearch = async (query: string) => {
    if (!query.trim()) {
      setKbSearchResults([]);
      return;
    }

    try {
      setIsKbSearching(true);

      // 1. Get embeddings for the query
      const { data: chunks, error: searchError } = await supabase
        .from('knowledge_doc_chunks')
        .select(`
          id,
          chunk_content,
          doc_id,
          knowledge_docs (
            title,
            description
          )
        `)
        .textSearch('chunk_content', query)
        .eq('org_id', ticket.org_id)
        .limit(5);

      if (searchError) throw searchError;

      setKbSearchResults(chunks || []);
    } catch (error) {
      console.error('Error searching knowledge base:', error);
      toast({
        title: "Error searching",
        description: error instanceof Error ? error.message : "Failed to search knowledge base",
        variant: "destructive",
      });
    } finally {
      setIsKbSearching(false);
    }
  };

  const handleInsertKbContent = (content: string) => {
    setQuickReplyText((prev) => prev + "\n\n" + content);
    setIsKbSearchOpen(false);
  };

  const handleGenerateAiResponse = async () => {
    try {
      setIsGeneratingAiResponse(true);

      // 1. Get ticket context
      const { data: ticketContext, error: contextError } = await supabase
        .from('tickets')
        .select(`
          id,
          subject,
          description,
          status,
          priority,
          comments (
            id,
            body,
            created_at,
            author:profiles (
              display_name,
              email,
              role
            )
          ),
          customer:profiles (
            display_name,
            email
          )
        `)
        .eq('id', ticket.id)
        .single();

      if (contextError) throw contextError;

      // 2. Get relevant knowledge base articles
      const { data: relevantArticles, error: kbError } = await supabase
        .from('knowledge_doc_chunks')
        .select(`
          id,
          chunk_content,
          doc_id,
          knowledge_docs (
            title,
            description
          )
        `)
        .textSearch('chunk_content', `${ticketContext.subject} ${ticketContext.description}`)
        .eq('org_id', ticket.org_id)
        .limit(3);

      if (kbError) throw kbError;

      // 3. Generate AI response
      const response = await fetch('/api/ai/generate-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketContext,
          relevantArticles,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI response');
      }

      const { response: aiResponse } = await response.json();

      // 4. Set as draft
      setQuickReplyText(aiResponse);
      setIsAiDraft(true);
      setIsQuickReplyOpen(true);

      toast({
        title: "AI response generated",
        description: "The AI has generated a draft response. Please review and edit before sending.",
      });

    } catch (error) {
      console.error('Error generating AI response:', error);
      toast({
        title: "Error generating response",
        description: error instanceof Error ? error.message : "Failed to generate AI response",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAiResponse(false);
    }
  };

  const handleAddInternalNote = async () => {
    if (!internalNoteText.trim()) return;

    try {
      setIsAddingNote(true);

      // Create private comment
      const { error: commentError } = await supabase
        .from('comments')
        .insert({
          ticket_id: ticket.id,
          body: internalNoteText,
          is_private: true,
          org_id: ticket.org_id,
          metadata: {
            type: 'internal_note'
          }
        });

      if (commentError) throw commentError;

      // Close dialog and show success
      setIsInternalNoteOpen(false);
      setInternalNoteText('');
      toast({
        title: "Note added",
        description: "Internal note has been added successfully.",
      });

    } catch (error) {
      console.error('Error adding internal note:', error);
      toast({
        title: "Error adding note",
        description: error instanceof Error ? error.message : "Failed to add internal note",
        variant: "destructive",
      });
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleMergeSearch = async (query: string) => {
    if (!query.trim()) {
      setMergeSearchResults([]);
      return;
    }

    try {
      const { data: tickets, error: searchError } = await supabase
        .from('tickets')
        .select(`
          id,
          subject,
          status,
          priority,
          customer:profiles (
            display_name,
            email
          )
        `)
        .neq('id', ticket.id)
        .eq('org_id', ticket.org_id)
        .textSearch('subject', query)
        .limit(5);

      if (searchError) throw searchError;

      setMergeSearchResults(tickets || []);
    } catch (error) {
      console.error('Error searching tickets:', error);
      toast({
        title: "Error searching",
        description: error instanceof Error ? error.message : "Failed to search tickets",
        variant: "destructive",
      });
    }
  };

  const handleMergeTickets = async () => {
    if (!selectedTicket) return;

    try {
      setIsMerging(true);

      // 1. Create merge comment on source ticket
      const { error: sourceCommentError } = await supabase
        .from('comments')
        .insert({
          ticket_id: ticket.id,
          body: `Ticket merged with #${selectedTicket.id}`,
          is_private: true,
          org_id: ticket.org_id,
          metadata: {
            type: 'merge',
            merged_with: selectedTicket.id
          }
        });

      if (sourceCommentError) throw sourceCommentError;

      // 2. Create merge comment on target ticket
      const { error: targetCommentError } = await supabase
        .from('comments')
        .insert({
          ticket_id: selectedTicket.id,
          body: `Ticket #${ticket.id} was merged into this ticket`,
          is_private: true,
          org_id: ticket.org_id,
          metadata: {
            type: 'merge',
            merged_from: ticket.id
          }
        });

      if (targetCommentError) throw targetCommentError;

      // 3. Update source ticket status to 'closed'
      const newMetadata: TicketMetadata = {
        ...(ticket.metadata as TicketMetadata),
        merged_into: selectedTicket.id
      };

      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          status: 'closed',
          metadata: newMetadata
        })
        .eq('id', ticket.id);

      if (updateError) throw updateError;

      // 4. Close dialog and show success
      setIsMergeOpen(false);
      setSelectedTicket(null);
      toast({
        title: "Tickets merged",
        description: "The tickets have been merged successfully.",
      });

      // 5. Redirect to merged ticket
      router.push(`/tickets/${selectedTicket.id}`);

    } catch (error) {
      console.error('Error merging tickets:', error);
      toast({
        title: "Error merging tickets",
        description: error instanceof Error ? error.message : "Failed to merge tickets",
        variant: "destructive",
      });
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/')}
              className="text-slate-400 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-semibold">Ticket #{ticket.id}</h1>
            <Badge className={statusColors[ticket.status]}>
              <StatusIcon status={ticket.status} />
              <span className="ml-1 capitalize">{ticket.status}</span>
            </Badge>
            <Badge className={priorityColors[ticket.priority]}>
              {ticket.priority.toUpperCase()}
            </Badge>
            {ticket.sla_breach_at && (
              <Badge variant="destructive" className="bg-red-500/10 text-red-500">
                <Timer className="h-4 w-4 mr-1" />
                SLA: {formatDistanceToNow(new Date(ticket.sla_breach_at))}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              {/* Email Actions */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEmailPanelOpen(true)}
                    className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View Email Thread</TooltipContent>
              </Tooltip>

              {/* Quick Reply */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsQuickReplyOpen(true)}
                    className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                  >
                    <MailPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Quick Reply</TooltipContent>
              </Tooltip>

              {/* Knowledge Base */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsKbSearchOpen(true)}
                    className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                  >
                    <Book className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Search Knowledge Base</TooltipContent>
              </Tooltip>

              {/* AI Assist */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleGenerateAiResponse}
                    disabled={isGeneratingAiResponse}
                    className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                  >
                    {isGeneratingAiResponse ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Brain className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isGeneratingAiResponse ? 'Generating response...' : 'Generate AI response'}
                </TooltipContent>
              </Tooltip>

              {/* Internal Note */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsInternalNoteOpen(true)}
                    className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Internal Note</TooltipContent>
              </Tooltip>

              {/* Star */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onStarToggle}
                    className={isStarred ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10' : 'text-slate-400 hover:text-yellow-400 hover:bg-yellow-400/10'}
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isStarred ? 'Remove from starred' : 'Add to starred'}</TooltipContent>
              </Tooltip>

              {/* Subscribe */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onSubscribeToggle}
                    className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                  >
                    {isSubscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isSubscribed ? 'Unsubscribe from notifications' : 'Subscribe to notifications'}
                </TooltipContent>
              </Tooltip>

              {/* Share */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share ticket</TooltipContent>
              </Tooltip>

              {/* More Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {/* Assignment */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Assign to
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => onAssigneeChange?.('me')}>
                          Assign to me
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => {/* TODO: Show agent list */}}>
                          <Users className="h-4 w-4 mr-2" />
                          Select agent...
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  {/* Status */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Clock className="h-4 w-4 mr-2" />
                      Change status
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        {Object.keys(statusColors).map((status) => (
                          <DropdownMenuItem key={status} onClick={() => onStatusChange(status as any)}>
                            <StatusIcon status={status} />
                            <span className="ml-2 capitalize">{status}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  {/* Priority */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Change priority
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        {Object.keys(priorityColors).map((priority) => (
                          <DropdownMenuItem key={priority} onClick={() => onPriorityChange(priority as any)}>
                            <span className={`${priorityColors[priority]} capitalize`}>{priority}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuSeparator />

                  {/* Merge */}
                  <DropdownMenuItem onClick={() => setIsMergeOpen(true)}>
                    Merge with another ticket...
                  </DropdownMenuItem>

                  {/* Delete */}
                  <DropdownMenuItem className="text-red-500">
                    Delete ticket
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipProvider>
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-3 gap-8">
          {/* Left column - Ticket details */}
          <div className="col-span-2">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="text-xl font-semibold">{ticket.subject}</h2>
                <p className="text-slate-300">{ticket.description}</p>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(ticket.created_at), 'PPP')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Conversation Panel */}
            <TicketConversationPanel
              ticket={ticket}
              isOpen={true}
            />
          </div>

          {/* Right column - Details Panel */}
          <TicketDetailsPanel
            ticket={ticket}
            isOpen={true}
            onStatusChange={onStatusChange}
            onPriorityChange={onPriorityChange}
          />
        </div>

        {/* Email Thread Panel */}
        <EmailThreadPanel
          isOpen={isEmailPanelOpen}
          onClose={() => setIsEmailPanelOpen(false)}
          ticket={ticket ? {
            id: ticket.id,
            org_id: ticket.org_id,
            thread_id: ticket.thread_id,
            message_id: ticket.message_id,
            subject: ticket.subject
          } : null}
        />

        {/* Quick Reply Dialog */}
        <Dialog open={isQuickReplyOpen} onOpenChange={setIsQuickReplyOpen}>
          <DialogContent className="sm:max-w-[800px] bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-slate-100">Quick Reply</DialogTitle>
              <DialogDescription className="text-slate-400">
                Send a quick response to this ticket.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <EmailComposer
                value={quickReplyText}
                onChange={setQuickReplyText}
                onSend={handleQuickReply}
                onGenerateAIResponse={handleGenerateAiResponse}
                isSending={isSending}
                isGeneratingAI={isGeneratingAiResponse}
                placeholder="Type your reply..."
                className="bg-slate-800 border-slate-700"
              />
              {isKbSearchOpen && (
                <div className="space-y-4">
                  <Command className="rounded-lg border border-slate-700 bg-slate-800">
                    <CommandInput
                      placeholder="Search knowledge base..."
                      value={kbSearchQuery}
                      onValueChange={(value) => {
                        setKbSearchQuery(value);
                        handleKbSearch(value);
                      }}
                    />
                    <CommandList>
                      <CommandEmpty>No results found.</CommandEmpty>
                      <CommandGroup>
                        {kbSearchResults.map((result) => (
                          <CommandItem
                            key={result.id}
                            onSelect={() => handleInsertKbContent(result.chunk_content)}
                          >
                            <div>
                              <div className="font-medium">{result.knowledge_docs.title}</div>
                              <div className="text-sm text-slate-400">
                                {result.chunk_content.substring(0, 100)}...
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsKbSearchOpen(!isKbSearchOpen)}
                className="gap-2"
              >
                <Book className="h-4 w-4" />
                {isKbSearchOpen ? 'Hide Knowledge Base' : 'Search Knowledge Base'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Internal Note Dialog */}
        <Dialog open={isInternalNoteOpen} onOpenChange={setIsInternalNoteOpen}>
          <DialogContent className="sm:max-w-[800px] bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-slate-100">Add Internal Note</DialogTitle>
              <DialogDescription className="text-slate-400">
                Add a private note that is only visible to agents.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <EmailComposer
                value={internalNoteText}
                onChange={setInternalNoteText}
                onSend={handleAddInternalNote}
                isSending={isAddingNote}
                placeholder="Type your internal note..."
                className="bg-slate-800 border-slate-700"
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Merge Dialog */}
        <Dialog open={isMergeOpen} onOpenChange={setIsMergeOpen}>
          <DialogContent className="sm:max-w-[600px] bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle>Merge Ticket</DialogTitle>
              <DialogDescription>
                Search for a ticket to merge this one into. The current ticket will be closed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Search Tickets</Label>
                <Command className="rounded-lg border border-slate-700">
                  <CommandInput
                    placeholder="Search tickets..."
                    value={mergeSearchQuery}
                    onValueChange={(value: string) => {
                      setMergeSearchQuery(value);
                      handleMergeSearch(value);
                    }}
                    className="border-none bg-transparent focus:ring-0"
                  />
                  <CommandEmpty>No tickets found.</CommandEmpty>
                  <CommandGroup>
                    {mergeSearchResults.map((result) => (
                      <CommandItem
                        key={result.id}
                        value={result.id}
                        onSelect={() => setSelectedTicket(result)}
                        className="cursor-pointer"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">#{result.id}</span>
                          <span className="text-sm text-slate-400">{result.subject}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </div>

              {selectedTicket && (
                <div className="rounded-lg border border-slate-700 p-4">
                  <h4 className="font-medium mb-2">Selected Ticket</h4>
                  <div className="space-y-1 text-sm text-slate-400">
                    <p>#{selectedTicket.id}</p>
                    <p>{selectedTicket.subject}</p>
                    <p>Status: {selectedTicket.status}</p>
                    <p>Priority: {selectedTicket.priority}</p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsMergeOpen(false);
                  setSelectedTicket(null);
                }}
                className="border-slate-700 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleMergeTickets}
                disabled={!selectedTicket || isMerging}
              >
                {isMerging ? 'Merging...' : 'Merge Tickets'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
} 