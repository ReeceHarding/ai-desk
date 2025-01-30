import { TicketConversationPanel } from '@/components/ticket/TicketConversationPanel';
import { toast } from '@/components/ui/use-toast';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Mock dependencies
jest.mock('@supabase/auth-helpers-nextjs');
jest.mock('@/components/ui/use-toast');

describe('TicketConversationPanel', () => {
  const mockTicket = {
    id: 'ticket123',
    subject: 'Test Ticket',
  };

  const mockAiDraft = {
    id: 'draft123',
    ai_draft_response: 'AI generated response',
    metadata: {
      rag_references: ['ref1', 'ref2'],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClientComponentClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              not: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    single: jest.fn(() => Promise.resolve({ data: mockAiDraft })),
                  })),
                })),
              })),
            })),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    });
  });

  it('renders AI draft when available', async () => {
    render(<TicketConversationPanel ticket={mockTicket} isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText('AI Draft Response')).toBeInTheDocument();
      expect(screen.getByText('AI generated response')).toBeInTheDocument();
      expect(screen.getByText('Based on 2 knowledge base references')).toBeInTheDocument();
    });
  });

  it('handles sending draft successfully', async () => {
    render(<TicketConversationPanel ticket={mockTicket} isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText('Send Response')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Send Response'));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Draft sent successfully',
        description: 'The AI response has been sent to the customer.',
      });
    });
  });

  it('handles discarding draft successfully', async () => {
    render(<TicketConversationPanel ticket={mockTicket} isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText('Discard')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Discard'));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Draft discarded',
        description: 'The AI response has been discarded.',
      });
    });
  });

  it('handles errors when sending draft', async () => {
    // Mock error response
    (createClientComponentClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              not: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    single: jest.fn(() => Promise.resolve({ data: mockAiDraft })),
                  })),
                })),
              })),
            })),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ error: new Error('Failed to send') })),
        })),
      })),
    });

    render(<TicketConversationPanel ticket={mockTicket} isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText('Send Response')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Send Response'));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Error sending draft',
        description: 'Failed to send the AI response. Please try again.',
        variant: 'destructive',
      });
    });
  });
}); 