import { TicketConversationPanel } from '@/components/ticket-conversation-panel';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock data
const mockTicket = {
  id: '123',
  subject: 'Test Ticket',
  description: 'Test Description',
  status: 'open' as const,
  priority: 'medium' as const,
  customer_id: 'cust123',
  assigned_agent_id: 'agent123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  customer: {
    display_name: 'John Doe',
    email: 'john@example.com',
    avatar_url: null,
  }
};

// Create a channel builder that properly implements the realtime subscription
const createChannelBuilder = (channelName: string) => {
  const builder = {
    on: vi.fn().mockImplementation((event, filter, callback) => {
      // Store the callback for testing
      (builder as any).callback = callback;
      return builder;
    }),
    subscribe: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        unsubscribe: vi.fn().mockResolvedValue(undefined)
      });
    })
  };
  return builder;
};

// Mock the Supabase client
const mockSupabaseClient = {
  from: vi.fn().mockImplementation((table) => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve({ data: [], error: null }))
  })),
  channel: vi.fn().mockImplementation((name) => createChannelBuilder(name)),
  removeChannel: vi.fn(),
  removeAllChannels: vi.fn(),
  getChannels: vi.fn().mockReturnValue([])
};

// Mock the hooks
vi.mock('@supabase/auth-helpers-react', () => ({
  useSupabaseClient: vi.fn(() => mockSupabaseClient)
}));

describe('TicketConversationPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (useSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabaseClient);
  });

  it('sets up realtime subscription correctly', () => {
    render(
      <TicketConversationPanel
        ticket={mockTicket}
        isOpen={true}
      />
    );

    // Verify channel was created with correct name
    expect(mockSupabaseClient.channel).toHaveBeenCalledWith(`comments-${mockTicket.id}`);

    // Get the channel builder
    const channelBuilder = mockSupabaseClient.channel.mock.results[0].value;

    // Verify subscription was set up correctly
    expect(channelBuilder.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: `ticket_id=eq.${mockTicket.id}`
      },
      expect.any(Function)
    );

    expect(channelBuilder.subscribe).toHaveBeenCalled();
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = render(
      <TicketConversationPanel
        ticket={mockTicket}
        isOpen={true}
      />
    );

    unmount();

    expect(mockSupabaseClient.removeChannel).toHaveBeenCalled();
  });
}); 