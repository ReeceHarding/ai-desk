import NotificationsPage from '@/pages/notifications/index';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { render, screen, waitFor } from '@testing-library/react';

// Mock Supabase client
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: jest.fn(),
}));

// Mock AppLayout
jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('NotificationsPage', () => {
  const mockSupabase = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          not: jest.fn(() => ({
            order: jest.fn(() => ({
              data: [
                {
                  id: '1',
                  ticket_id: 'ticket1',
                  subject: 'Test Subject',
                  ai_draft_response: 'Test response',
                  created_at: new Date().toISOString(),
                  from_name: 'John Doe',
                  from_address: 'john@example.com',
                },
              ],
              error: null,
            })),
          })),
        })),
      })),
    })),
  };

  beforeEach(() => {
    (createClientComponentClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('renders loading state initially', () => {
    render(<NotificationsPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders AI drafts when data is loaded', async () => {
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Subject')).toBeInTheDocument();
      expect(screen.getByText('From: John Doe')).toBeInTheDocument();
      expect(screen.getByText('Test response')).toBeInTheDocument();
    });
  });

  it('renders empty state when no drafts are available', async () => {
    const emptyMockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            not: jest.fn(() => ({
              order: jest.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
        })),
      })),
    };

    (createClientComponentClient as jest.Mock).mockReturnValue(emptyMockSupabase);

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText(/no ai drafts awaiting approval/i)).toBeInTheDocument();
    });
  });

  it('handles error state gracefully', async () => {
    const errorMockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            not: jest.fn(() => ({
              order: jest.fn(() => ({
                data: null,
                error: new Error('Failed to fetch'),
              })),
            })),
          })),
        })),
      })),
    };

    (createClientComponentClient as jest.Mock).mockReturnValue(errorMockSupabase);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText(/no ai drafts awaiting approval/i)).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });
}); 