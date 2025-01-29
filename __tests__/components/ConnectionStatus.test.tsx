import { ConnectionStatus } from '@/components/ConnectionStatus';
import { createClient } from '@supabase/supabase-js';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('ConnectionStatus', () => {
  let mockSupabase: any;
  let mockRouter: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({
            data: [{
              gmail_watch_status: 'active',
              gmail_watch_expiration: new Date(Date.now() + 1000000).toISOString(),
            }],
            error: null,
          })),
        })),
      })),
      channel: jest.fn(() => ({
        on: jest.fn(() => ({
          subscribe: jest.fn(),
        })),
      })),
    };

    mockRouter = {
      push: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should display loading state initially', () => {
    render(<ConnectionStatus orgId="org1" profileId="profile1" />);
    expect(screen.getByText(/Loading connection status/i)).toBeInTheDocument();
  });

  it('should display active connection status', async () => {
    render(<ConnectionStatus orgId="org1" profileId="profile1" />);

    await waitFor(() => {
      expect(screen.getByText(/Gmail connection is active/i)).toBeInTheDocument();
    });
  });

  it('should display expired connection status and reconnect button', async () => {
    mockSupabase.from = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({
          data: [{
            gmail_watch_status: 'expired',
            gmail_watch_expiration: new Date(Date.now() - 1000).toISOString(),
          }],
          error: null,
        })),
      })),
    }));

    render(<ConnectionStatus orgId="org1" profileId="profile1" />);

    await waitFor(() => {
      expect(screen.getByText(/Gmail connection has expired/i)).toBeInTheDocument();
      expect(screen.getByText(/Reconnect/i)).toBeInTheDocument();
    });
  });

  it('should handle reconnect button click', async () => {
    mockSupabase.from = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({
          data: [{
            gmail_watch_status: 'expired',
            gmail_watch_expiration: new Date(Date.now() - 1000).toISOString(),
          }],
          error: null,
        })),
      })),
    }));

    render(<ConnectionStatus orgId="org1" profileId="profile1" />);

    await waitFor(() => {
      const reconnectButton = screen.getByText(/Reconnect/i);
      fireEvent.click(reconnectButton);
      expect(mockRouter.push).toHaveBeenCalledWith('/auth/gmail');
    });
  });

  it('should display error status', async () => {
    mockSupabase.from = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({
          data: [{
            gmail_watch_status: 'failed',
            gmail_watch_expiration: null,
          }],
          error: null,
        })),
      })),
    }));

    render(<ConnectionStatus orgId="org1" profileId="profile1" />);

    await waitFor(() => {
      expect(screen.getByText(/Gmail connection has failed/i)).toBeInTheDocument();
    });
  });

  it('should handle database errors', async () => {
    mockSupabase.from = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({
          data: null,
          error: new Error('Database error'),
        })),
      })),
    }));

    render(<ConnectionStatus orgId="org1" profileId="profile1" />);

    await waitFor(() => {
      expect(screen.getByText(/Error fetching connection status/i)).toBeInTheDocument();
    });
  });

  it('should update status on real-time changes', async () => {
    const { rerender } = render(<ConnectionStatus orgId="org1" profileId="profile1" />);

    // Simulate real-time update
    mockSupabase.from = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({
          data: [{
            gmail_watch_status: 'expired',
            gmail_watch_expiration: new Date(Date.now() - 1000).toISOString(),
          }],
          error: null,
        })),
      })),
    }));

    rerender(<ConnectionStatus orgId="org1" profileId="profile1" />);

    await waitFor(() => {
      expect(screen.getByText(/Gmail connection has expired/i)).toBeInTheDocument();
    });
  });
}); 