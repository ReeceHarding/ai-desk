import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import NotificationsPage from '@/pages/notifications';
import { Database } from '@/types/supabase';
import { sendGmailReply } from '@/utils/gmail';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { SupabaseClient } from '@supabase/supabase-js';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Mock dependencies
jest.mock('@supabase/auth-helpers-nextjs');
jest.mock('@/components/ui/use-toast');
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock AppLayout
jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock Supabase client
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: jest.fn(),
}));

// Mock Gmail utility
jest.mock('@/utils/gmail', () => ({
  sendGmailReply: jest.fn(),
}));

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

interface DraftChat {
  id: string;
  ticket_id: string;
  message_id: string;
  thread_id: string;
  from_address: string;
  subject: string;
  ai_draft_response: string;
  created_at: string;
}

interface SupabaseResponse<T> {
  data: T[] | null;
  error: { message: string } | null;
}

const mockDraft: DraftChat = {
  id: 'chat123',
  ticket_id: 'ticket123',
  message_id: 'msg123',
  thread_id: 'thread123',
  from_address: 'customer@example.com',
  subject: 'Test Subject',
  ai_draft_response: 'Test draft response',
  created_at: '2024-01-01T00:00:00Z',
};

const mockSupabaseChain = {
  data: [] as DraftChat[],
  error: null,
};

const mockSupabaseResponse: SupabaseResponse<Database['public']['Tables']['ticket_email_chats']['Row']> = {
  data: [],
  error: null,
};

const mockSupabase = {
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
  },
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        not: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue(mockSupabaseResponse)
        })
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue(mockSupabaseResponse)
      })
    }),
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    }),
    removeChannel: jest.fn(),
  }) as unknown as SupabaseClient,
};

(createClientComponentClient as jest.Mock).mockReturnValue(mockSupabase);

describe('NotificationsPage', () => {
  type EmailChat = Database['public']['Tables']['ticket_email_chats']['Row'];
  type SupabaseResponse<T> = { data: T[] | null; error: { message: string } | null };

  const mockSupabaseResponse: SupabaseResponse<EmailChat> = {
    data: [],
    error: null,
  };

  const mockSupabaseChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(mockSupabaseResponse),
    update: jest.fn().mockReturnThis(),
  };

  const mockSupabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
    },
    from: jest.fn().mockReturnValue(mockSupabaseChain),
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    }),
    removeChannel: jest.fn(),
  } as unknown as SupabaseClient;

  beforeEach(() => {
    (createClientComponentClient as jest.Mock).mockReturnValue(mockSupabase);
    mockSupabaseResponse.data = [];
    mockSupabaseResponse.error = null;
    jest.clearAllMocks();

    // Mock useAuth
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user1' },
      loading: false
    });
  });

  it('renders loading state initially', () => {
    (useAuth as jest.Mock).mockReturnValueOnce({
      user: { id: 'user1' },
      loading: true
    });

    render(<NotificationsPage />);
    expect(screen.getByText('Loading notifications...')).toBeInTheDocument();
  });

  it('renders AI drafts when loaded', async () => {
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('First Subject')).toBeInTheDocument();
      expect(screen.getByText('Second Subject')).toBeInTheDocument();
      expect(screen.getByText('First AI response')).toBeInTheDocument();
      expect(screen.getByText('Second AI response')).toBeInTheDocument();
    });

    // Verify Supabase query
    expect(mockSupabase.from).toHaveBeenCalledWith('ticket_email_chats');
    expect(mockSupabase.from().select).toHaveBeenCalledWith(
      'id, ticket_id, message_id, thread_id, from_address, subject, ai_draft_response, created_at'
    );
  });

  it('renders empty state when no drafts', async () => {
    // Mock empty response
    const emptyResponse: SupabaseResponse<DraftChat> = {
      data: [],
      error: null,
    };
    mockSupabase.from().select().eq().not().order.mockResolvedValueOnce(emptyResponse);

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('No AI-drafted emails awaiting approval.')).toBeInTheDocument();
    });
  });

  it('renders error state when fetch fails', async () => {
    // Mock error response
    const errorResponse: SupabaseResponse<DraftChat> = {
      data: [],
      error: { message: 'Failed to load drafts' },
    };
    mockSupabase.from().select().eq().not().order.mockResolvedValueOnce(errorResponse);

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load drafts')).toBeInTheDocument();
    });
  });

  it('links to ticket page', async () => {
    render(<NotificationsPage />);

    await waitFor(() => {
      const link = screen.getByText('Test Subject');
      expect(link).toHaveAttribute('href', '/tickets/ticket123');
    });
  });

  it('handles sending draft successfully', async () => {
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Send Response')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Send Response')[0]);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Draft sent successfully',
        description: 'The AI response has been sent to the customer.',
      });
    });
  });

  it('handles discarding draft successfully', async () => {
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Discard')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Discard')[0]);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Draft discarded',
        description: 'The AI response has been discarded.',
      });
    });
  });

  it('shows empty state when no drafts', async () => {
    (createClientComponentClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            not: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: [] })),
            })),
          })),
        })),
      })),
    });

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('No pending AI draft responses')).toBeInTheDocument();
    });
  });

  it('handles errors when fetching drafts', async () => {
    (createClientComponentClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            not: jest.fn(() => ({
              order: jest.fn(() => Promise.reject(new Error('Failed to fetch'))),
            })),
          })),
        })),
      })),
    });

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Error loading drafts',
        description: 'Failed to load AI draft responses.',
        variant: 'destructive',
      });
    });
  });

  it('displays AI draft emails', async () => {
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('First Subject')).toBeInTheDocument();
      expect(screen.getByText('Second Subject')).toBeInTheDocument();
      expect(screen.getByText('First AI response')).toBeInTheDocument();
      expect(screen.getByText('Second AI response')).toBeInTheDocument();
    });
  });

  it('displays auto-sent emails', async () => {
    render(<NotificationsPage />);

    // Click the auto-sent tab
    fireEvent.click(screen.getByText(/Auto-Sent Emails/));

    await waitFor(() => {
      expect(screen.getByText('First Subject')).toBeInTheDocument();
      expect(screen.getByText('Second Subject')).toBeInTheDocument();
      expect(screen.getByText('First AI response')).toBeInTheDocument();
      expect(screen.getByText('Second AI response')).toBeInTheDocument();
    });
  });

  it('handles sending a draft', async () => {
    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      update: jest.fn().mockImplementation(() => ({
        eq: jest.fn().mockResolvedValue({ error: null })
      }))
    };

    (createClientComponentClient as jest.Mock).mockReturnValue(mockSupabase);

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('First Subject')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Send Draft'));

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('ticket_email_chats');
      expect(mockSupabase.update).toHaveBeenCalledWith({
        ai_auto_responded: true
      });
    });
  });

  it('handles discarding a draft', async () => {
    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      update: jest.fn().mockImplementation(() => ({
        eq: jest.fn().mockResolvedValue({ error: null })
      }))
    };

    (createClientComponentClient as jest.Mock).mockReturnValue(mockSupabase);

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('First Subject')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Discard'));

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('ticket_email_chats');
      expect(mockSupabase.update).toHaveBeenCalledWith({
        ai_draft_response: null
      });
    });
  });

  it('displays draft emails with correct confidence colors', async () => {
    const mockDrafts = [
      {
        id: '1',
        subject: 'Test Draft',
        from_address: 'test@example.com',
        ai_draft_response: 'Test response',
        created_at: new Date().toISOString(),
        ai_confidence: 90.00,
        metadata: {
          rag_references: [
            {
              docId: 'doc1',
              title: 'Test Article',
              chunk_content: 'Test content',
              relevance_score: 0.95,
            },
          ],
        },
      },
    ];

    mockSupabase.select.mockResolvedValueOnce({ data: mockDrafts, error: null });

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Draft')).toBeInTheDocument();
      const confidenceElement = screen.getByText('90.00%');
      expect(confidenceElement).toHaveClass('text-green-600');
    });
  });

  it('displays knowledge base references correctly', async () => {
    const mockDrafts = [
      {
        id: '1',
        subject: 'Test Draft',
        from_address: 'test@example.com',
        ai_draft_response: 'Test response',
        created_at: new Date().toISOString(),
        ai_confidence: 75.00,
        metadata: {
          rag_references: [
            {
              docId: 'doc1',
              title: 'Test Article',
              chunk_content: 'Test content',
              relevance_score: 0.95,
            },
          ],
        },
      },
    ];

    mockSupabase.select.mockResolvedValueOnce({ data: mockDrafts, error: null });

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Article')).toBeInTheDocument();
      expect(screen.getByText('Test content')).toBeInTheDocument();
      expect(screen.getByText('Relevance: 95.0%')).toBeInTheDocument();
    });
  });

  it('handles sending draft emails correctly', async () => {
    const mockDraft = {
      id: '1',
      subject: 'Test Draft',
      from_address: 'test@example.com',
      ai_draft_response: 'Test response',
      created_at: new Date().toISOString(),
      thread_id: 'thread1',
      message_id: 'message1',
      ai_confidence: 75.00,
    };

    mockSupabase.select.mockResolvedValueOnce({ data: [mockDraft], error: null });
    mockSupabase.update.mockResolvedValueOnce({ error: null });
    (sendGmailReply as jest.Mock).mockResolvedValueOnce({});

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Send Response')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Send Response'));

    await waitFor(() => {
      expect(sendGmailReply).toHaveBeenCalledWith({
        threadId: 'thread1',
        inReplyTo: 'message1',
        to: ['test@example.com'],
        subject: 'Re: Test Draft',
        htmlBody: 'Test response',
      });
    });
  });

  it('displays auto-sent status correctly', async () => {
    const mockAutoSent = [
      {
        id: '1',
        subject: 'Auto-sent Email',
        from_address: 'test@example.com',
        ai_draft_response: 'Test response',
        created_at: new Date().toISOString(),
        ai_confidence: 95.00,
      },
    ];

    mockSupabase.select.mockResolvedValueOnce({ data: [], error: null }); // Drafts
    mockSupabase.select.mockResolvedValueOnce({ data: mockAutoSent, error: null }); // Auto-sent

    render(<NotificationsPage />);

    fireEvent.click(screen.getByText('Auto-sent'));

    await waitFor(() => {
      expect(screen.getByText('Auto-sent Email')).toBeInTheDocument();
      expect(screen.getByText('Auto-sent')).toBeInTheDocument();
      const confidenceElement = screen.getByText('95.00%');
      expect(confidenceElement).toHaveClass('text-green-600');
    });
  });

  it('displays empty state when no drafts or auto-sent emails', async () => {
    mockSupabaseResponse.data = [];
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('No AI-drafted emails awaiting approval.')).toBeInTheDocument();
      expect(screen.getByText('No auto-sent AI responses yet.')).toBeInTheDocument();
    });
  });

  it('displays draft emails correctly', async () => {
    const mockDraft: Partial<EmailChat> = {
      id: 'draft-1',
      ticket_id: 'ticket-1',
      message_id: 'msg-1',
      thread_id: 'thread-1',
      subject: 'Test Subject',
      ai_draft_response: 'Test Response',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      from_address: 'test@example.com',
      to_address: ['recipient@example.com'],
      cc_address: [],
      bcc_address: [],
      body: 'Test body',
      attachments: {},
      org_id: 'org-1',
      ai_classification: 'should_respond',
      ai_confidence: 75.5,
      ai_auto_responded: false,
      gmail_date: new Date().toISOString(),
    };

    mockSupabaseResponse.data = [mockDraft as EmailChat];
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Subject')).toBeInTheDocument();
      expect(screen.getByText('From: test@example.com')).toBeInTheDocument();
      expect(screen.getByText('75.50%')).toBeInTheDocument();
      expect(screen.getByText('Send Response')).toBeInTheDocument();
      expect(screen.getByText('Discard')).toBeInTheDocument();
    });
  });

  it('displays auto-sent emails correctly', async () => {
    const mockAutoSent: Partial<EmailChat> = {
      id: 'auto-1',
      ticket_id: 'ticket-1',
      message_id: 'msg-1',
      thread_id: 'thread-1',
      subject: 'Auto Subject',
      ai_draft_response: 'Auto Response',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      from_address: 'auto@example.com',
      to_address: ['recipient@example.com'],
      cc_address: [],
      bcc_address: [],
      body: 'Test body',
      attachments: {},
      org_id: 'org-1',
      ai_classification: 'should_respond',
      ai_confidence: 90.0,
      ai_auto_responded: true,
      gmail_date: new Date().toISOString(),
    };

    mockSupabaseResponse.data = [mockAutoSent as EmailChat];
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Auto Subject')).toBeInTheDocument();
      expect(screen.getByText('From: auto@example.com')).toBeInTheDocument();
      expect(screen.getByText('90.00%')).toBeInTheDocument();
      expect(screen.getByText('Auto-sent')).toBeInTheDocument();
    });
  });

  it('handles send draft action correctly', async () => {
    const mockDraft: Partial<EmailChat> = {
      id: 'draft-1',
      ticket_id: 'ticket-1',
      message_id: 'msg-1',
      thread_id: 'thread-1',
      subject: 'Test Subject',
      ai_draft_response: 'Test Response',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      from_address: 'test@example.com',
      to_address: ['recipient@example.com'],
      cc_address: [],
      bcc_address: [],
      body: 'Test body',
      attachments: {},
      org_id: 'org-1',
      ai_classification: 'should_respond',
      ai_confidence: 75.5,
      ai_auto_responded: false,
      gmail_date: new Date().toISOString(),
    };

    mockSupabaseResponse.data = [mockDraft as EmailChat];
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Send Response')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Send Response'));

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('ticket_email_chats');
      expect(mockSupabaseChain.update).toHaveBeenCalled();
    });
  });

  it('handles discard draft action correctly', async () => {
    const mockDraft: Partial<EmailChat> = {
      id: 'draft-1',
      ticket_id: 'ticket-1',
      message_id: 'msg-1',
      thread_id: 'thread-1',
      subject: 'Test Subject',
      ai_draft_response: 'Test Response',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      from_address: 'test@example.com',
      to_address: ['recipient@example.com'],
      cc_address: [],
      bcc_address: [],
      body: 'Test body',
      attachments: {},
      org_id: 'org-1',
      ai_classification: 'should_respond',
      ai_confidence: 75.5,
      ai_auto_responded: false,
      gmail_date: new Date().toISOString(),
    };

    mockSupabaseResponse.data = [mockDraft as EmailChat];
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Discard')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Discard'));

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('ticket_email_chats');
      expect(mockSupabaseChain.update).toHaveBeenCalled();
    });
  });
}); 
