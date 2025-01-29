import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { AppLayout } from '../../../components/layout/AppLayout';

// Mock dependencies
jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/',
    push: jest.fn(),
  }),
}));

jest.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => ({
    role: 'admin',
  }),
}));

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          not: jest.fn(() => ({
            head: jest.fn(() => Promise.resolve({ count: 2 }))
          }))
        }))
      })),
    })),
    channel: jest.fn(() => ({
      on: jest.fn(() => ({
        subscribe: jest.fn()
      })),
      unsubscribe: jest.fn()
    }))
  }))
}));

jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe('AppLayout', () => {
  it('renders children content', () => {
    render(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('shows notifications link with draft count', async () => {
    render(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>
    );

    expect(screen.getByText('Notifications')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('renders without draft count when no drafts', async () => {
    // Mock no drafts
    jest.mocked(createClientComponentClient).mockReturnValueOnce({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            not: jest.fn(() => ({
              head: jest.fn(() => Promise.resolve({ count: 0 }))
            }))
          }))
        }))
      })),
      channel: jest.fn(() => ({
        on: jest.fn(() => ({
          subscribe: jest.fn()
        })),
        unsubscribe: jest.fn()
      }))
    });

    render(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>
    );

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    
    // Wait a bit to ensure no count badge appears
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('subscribes to draft changes', () => {
    const mockChannel = {
      on: jest.fn(() => ({
        subscribe: jest.fn()
      })),
      unsubscribe: jest.fn()
    };

    const mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            not: jest.fn(() => ({
              head: jest.fn(() => Promise.resolve({ count: 0 }))
            }))
          }))
        }))
      })),
      channel: jest.fn(() => mockChannel)
    };

    jest.mocked(createClientComponentClient).mockReturnValueOnce(mockSupabase);

    render(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>
    );

    expect(mockSupabase.channel).toHaveBeenCalledWith('ticket_email_chats');
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'ticket_email_chats',
        filter: 'ai_auto_responded=eq.false'
      },
      expect.any(Function)
    );
  });
}); 