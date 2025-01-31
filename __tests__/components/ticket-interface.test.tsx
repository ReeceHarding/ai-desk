import { TicketInterface } from '@/components/ticket-interface';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />
  }
}))

// Create a query builder that supports method chaining
const createQueryBuilder = () => {
  const builder = {
    data: null,
    error: null,
    count: null,
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    overlap: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null }))
  };
  return builder;
};

// Create a channel builder that supports method chaining
const createChannelBuilder = () => {
  const subscriptions = new Map();
  const builder = {
    on: vi.fn().mockImplementation((event, callback) => {
      subscriptions.set(event, callback);
      return builder;
    }),
    subscribe: vi.fn().mockImplementation((callback) => {
      return Promise.resolve({
        unsubscribe: () => {
          subscriptions.clear();
          return Promise.resolve();
        }
      });
    })
  };
  return builder;
};

// Mock the hooks
const mockSupabaseClient = {
  from: vi.fn().mockImplementation(() => createQueryBuilder()),
  channel: vi.fn().mockImplementation((name) => createChannelBuilder()),
  removeChannel: vi.fn(),
  removeAllChannels: vi.fn(),
  getChannels: vi.fn().mockReturnValue([]),
  // Add auth related mocks
  auth: {
    getUser: vi.fn().mockResolvedValue({ 
      data: { 
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          user_metadata: { name: 'Test User' }
        }
      }, 
      error: null 
    }),
    signOut: vi.fn().mockResolvedValue({ error: null })
  }
};

vi.mock('@supabase/auth-helpers-react', () => ({
  useSupabaseClient: vi.fn(() => mockSupabaseClient),
  useUser: vi.fn(() => ({
    id: 'test-user-id',
    email: 'test@example.com',
    user_metadata: { name: 'Test User' }
  }))
}))

// Mock the next/router module
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  pathname: '/tickets/[id]',
  query: { id: '123' }
}

vi.mock('next/router', () => ({
  useRouter: () => mockRouter
}))

// Mock the toast hook
vi.mock('../../components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock fetch for AI response generation
const mockFetchResponse = {
  ok: true,
  json: async () => ({ response: 'AI generated response' }),
}

const mockFetch = vi.fn(() => Promise.resolve(mockFetchResponse))
vi.stubGlobal('fetch', mockFetch)

// Create a test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>
}

// Custom render function that includes the wrapper
const customRender = (ui: React.ReactElement) => {
  return render(ui, { wrapper: TestWrapper })
}

describe('TicketInterface', () => {
  const mockTicket = {
    id: '123',
    subject: 'Test Ticket',
    description: 'Test Description',
    status: 'open' as const,
    priority: 'medium' as const,
    customer_id: 'cust123',
    assigned_agent_id: 'agent123',
    escalation_level: 1,
    due_at: new Date().toISOString(),
    custom_fields: {},
    metadata: {},
    extra_text_1: null,
    extra_json_1: {},
    org_id: 'org123',
    deleted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    next_followup_at: null,
    feedback_score: null,
    customer: {
      display_name: 'John Doe',
      email: 'john@example.com',
      avatar_url: null,
    },
    organization: {
      name: 'Test Org',
    },
  }

  const mockSupabase = {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: mockTicket, error: null })),
          limit: vi.fn(() => Promise.resolve({ data: [mockTicket], error: null })),
        })),
        textSearch: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        neq: vi.fn(() => ({
          eq: vi.fn(() => ({
            textSearch: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
    })),
  }

  beforeEach(() => {
    vi.resetAllMocks()
    mockRouter.push = vi.fn()
    mockRouter.replace = vi.fn()
    mockRouter.prefetch = vi.fn()
    mockRouter.back = vi.fn()
    mockRouter.forward = vi.fn()
    mockRouter.refresh = vi.fn()
    mockRouter.pathname = '/tickets/[id]'
    mockRouter.query = { id: '123' }
    ;(useSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabaseClient)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders ticket information correctly', () => {
      customRender(
        <TicketInterface
          ticket={mockTicket}
          onStatusChange={() => {}}
          onPriorityChange={() => {}}
        />
      )

      // Check if basic ticket information is rendered
      expect(screen.getByText(`Ticket #${mockTicket.id}`)).toBeInTheDocument()
      expect(screen.getByText(mockTicket.subject)).toBeInTheDocument()
      expect(screen.getByText(mockTicket.description)).toBeInTheDocument()
      expect(screen.getByText(mockTicket.status, { exact: false })).toBeInTheDocument()
      expect(screen.getByText(mockTicket.priority.toUpperCase())).toBeInTheDocument()
    })

    it('renders all action buttons', () => {
      customRender(
        <TicketInterface
          ticket={mockTicket}
          onStatusChange={() => {}}
          onPriorityChange={() => {}}
        />
      )

      expect(screen.getByRole('button', { name: /quick reply/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /search knowledge base/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /generate ai response/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add internal note/i })).toBeInTheDocument()
    })
  })

  describe('Quick Reply', () => {
    it('shows quick reply dialog when button is clicked', async () => {
      customRender(
        <TicketInterface
          ticket={mockTicket}
          onStatusChange={() => {}}
          onPriorityChange={() => {}}
        />
      )

      // Find and click the quick reply button
      const quickReplyButton = screen.getByRole('button', { name: /quick reply/i })
      fireEvent.click(quickReplyButton)

      // Check if dialog is shown
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('Send a quick response to this ticket.')).toBeInTheDocument()
      })
    })

    it('handles quick reply submission correctly', async () => {
      customRender(
        <TicketInterface
          ticket={mockTicket}
          onStatusChange={() => {}}
          onPriorityChange={() => {}}
        />
      )

      // Open dialog
      fireEvent.click(screen.getByRole('button', { name: /quick reply/i }))

      // Type reply
      const textarea = await screen.findByPlaceholderText('Type your reply...')
      fireEvent.change(textarea, { target: { value: 'Test reply' } })

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /send reply/i }))

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('comments')
        expect(mockSupabase.from).toHaveBeenCalledWith('email_logs')
      })
    })

    it('handles quick reply with rich text editor', async () => {
      render(
        <TicketInterface
          ticket={mockTicket}
          onStatusChange={() => {}}
          onPriorityChange={() => {}}
        />
      );

      // Find and click the quick reply button
      const quickReplyButton = screen.getByRole('button', { name: /quick reply/i });
      fireEvent.click(quickReplyButton);

      // Check if rich text editor is shown
      const editor = screen.getByRole('textbox');
      expect(editor).toBeInTheDocument();

      // Check if toolbar buttons are present
      expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /underline/i })).toBeInTheDocument();

      // Type some text
      fireEvent.input(editor, { target: { innerHTML: '<p>Test reply</p>' } });

      // Click send button
      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      // Verify that the Supabase client was called correctly
      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('comments');
        expect(mockSupabase.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({
            ticket_id: mockTicket.id,
            body: '<p>Test reply</p>',
            is_private: false,
            org_id: mockTicket.org_id,
          })
        );
      });
    });
  })

  describe('Knowledge Base Integration', () => {
    it('performs knowledge base search correctly', async () => {
      customRender(
        <TicketInterface
          ticket={mockTicket}
          onStatusChange={() => {}}
          onPriorityChange={() => {}}
        />
      )

      // Open KB search
      fireEvent.click(screen.getByRole('button', { name: /search knowledge base/i }))

      // Type search query
      const searchInput = await screen.findByPlaceholderText('Search knowledge base...')
      fireEvent.change(searchInput, { target: { value: 'test query' } })

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('knowledge_doc_chunks')
      })
    })

    it('handles knowledge base search', async () => {
      render(
        <TicketInterface
          ticket={mockTicket}
          onStatusChange={() => {}}
          onPriorityChange={() => {}}
        />
      );

      // Find and click the quick reply button
      const quickReplyButton = screen.getByRole('button', { name: /quick reply/i });
      fireEvent.click(quickReplyButton);

      // Click knowledge base search button
      const kbButton = screen.getByRole('button', { name: /search knowledge base/i });
      fireEvent.click(kbButton);

      // Type search query
      const searchInput = screen.getByPlaceholderText(/search knowledge base/i);
      fireEvent.change(searchInput, { target: { value: 'test query' } });

      // Verify that the search was triggered
      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('knowledge_doc_chunks');
        expect(mockSupabase.from().select).toHaveBeenCalledWith(expect.stringContaining('chunk_content'));
      });
    });
  })

  describe('AI Assist', () => {
    it('generates AI response correctly', async () => {
      customRender(
        <TicketInterface
          ticket={mockTicket}
          onStatusChange={() => {}}
          onPriorityChange={() => {}}
        />
      )

      // Click AI assist button
      fireEvent.click(screen.getByRole('button', { name: /generate ai response/i }))

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('tickets')
        expect(mockSupabase.from).toHaveBeenCalledWith('knowledge_doc_chunks')
        expect(global.fetch).toHaveBeenCalledWith('/api/ai/generate-response', expect.any(Object))
      })
    })

    it('handles AI response generation', async () => {
      render(
        <TicketInterface
          ticket={mockTicket}
          onStatusChange={() => {}}
          onPriorityChange={() => {}}
        />
      );

      // Find and click the quick reply button
      const quickReplyButton = screen.getByRole('button', { name: /quick reply/i });
      fireEvent.click(quickReplyButton);

      // Click AI response button
      const aiButton = screen.getByRole('button', { name: /ai response/i });
      fireEvent.click(aiButton);

      // Verify that the AI response generation was triggered
      await waitFor(() => {
        expect(screen.getByText(/generating/i)).toBeInTheDocument();
      });
    });
  })

  describe('Internal Notes', () => {
    it('adds internal note correctly', async () => {
      customRender(
        <TicketInterface
          ticket={mockTicket}
          onStatusChange={() => {}}
          onPriorityChange={() => {}}
        />
      )

      // Open internal note dialog
      fireEvent.click(screen.getByRole('button', { name: /add internal note/i }))

      // Type note
      const textarea = await screen.findByPlaceholderText('Type your note...')
      fireEvent.change(textarea, { target: { value: 'Test internal note' } })

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /add note/i }))

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('comments')
      })
    })

    it('handles internal note with rich text editor', async () => {
      render(
        <TicketInterface
          ticket={mockTicket}
          onStatusChange={() => {}}
          onPriorityChange={() => {}}
        />
      );

      // Find and click the internal note button
      const internalNoteButton = screen.getByRole('button', { name: /add internal note/i });
      fireEvent.click(internalNoteButton);

      // Check if rich text editor is shown
      const editor = screen.getByRole('textbox');
      expect(editor).toBeInTheDocument();

      // Check if toolbar buttons are present
      expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /underline/i })).toBeInTheDocument();

      // Type some text
      fireEvent.input(editor, { target: { innerHTML: '<p>Test internal note</p>' } });

      // Click send button
      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      // Verify that the Supabase client was called correctly
      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('comments');
        expect(mockSupabase.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({
            ticket_id: mockTicket.id,
            body: '<p>Test internal note</p>',
            is_private: true,
            org_id: mockTicket.org_id,
          })
        );
      });
    });
  })

  describe('Ticket Merging', () => {
    it('handles ticket merge correctly', async () => {
      customRender(
        <TicketInterface
          ticket={mockTicket}
          onStatusChange={() => {}}
          onPriorityChange={() => {}}
        />
      )

      // Open more menu
      fireEvent.click(screen.getByRole('button', { name: /more/i }))

      // Click merge option
      fireEvent.click(screen.getByText(/merge with another ticket/i))

      // Search for ticket
      const searchInput = await screen.findByPlaceholderText('Search tickets...')
      fireEvent.change(searchInput, { target: { value: 'test ticket' } })

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('tickets')
      })
    })
  })

  describe('Status and Priority Changes', () => {
    it('handles status change correctly', async () => {
      const onStatusChange = vi.fn()
      customRender(
        <TicketInterface
          ticket={mockTicket}
          onStatusChange={onStatusChange}
          onPriorityChange={() => {}}
        />
      )

      // Open more menu
      fireEvent.click(screen.getByRole('button', { name: /more/i }))

      // Click status option
      fireEvent.click(screen.getByText(/change status/i))

      // Select new status
      fireEvent.click(screen.getByText('solved'))

      expect(onStatusChange).toHaveBeenCalledWith('solved')
    })

    it('handles priority change correctly', async () => {
      const onPriorityChange = vi.fn()
      customRender(
        <TicketInterface
          ticket={mockTicket}
          onStatusChange={() => {}}
          onPriorityChange={onPriorityChange}
        />
      )

      // Open more menu
      fireEvent.click(screen.getByRole('button', { name: /more/i }))

      // Click priority option
      fireEvent.click(screen.getByText(/change priority/i))

      // Select new priority
      fireEvent.click(screen.getByText('high'))

      expect(onPriorityChange).toHaveBeenCalledWith('high')
    })
  })

  describe('Error Handling', () => {
    it('handles quick reply error correctly', async () => {
      type MockSupabase = {
        from: (table: string) => {
          insert: (data: any) => {
            select: () => {
              single: () => Promise<{ data: null; error: Error }>;
            };
          };
        };
      };

      const errorMockSupabase: MockSupabase = {
        from: () => ({
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: new Error('Test error') }),
            }),
          }),
        }),
      };

      (useSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue(errorMockSupabase);

      customRender(
        <TicketInterface
          ticket={mockTicket}
          onStatusChange={() => {}}
          onPriorityChange={() => {}}
        />
      );

      // Open dialog
      fireEvent.click(screen.getByRole('button', { name: /quick reply/i }));

      // Type reply
      const textarea = await screen.findByPlaceholderText('Type your reply...');
      fireEvent.change(textarea, { target: { value: 'Test reply' } });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /send reply/i }));

      await waitFor(() => {
        expect(screen.getByText(/error sending reply/i)).toBeInTheDocument();
      });
    });
  })
}) 