import Sidebar from '@/components/layout/Sidebar';
import { useUserRole } from '@/hooks/useUserRole';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock Supabase client
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: jest.fn(),
}));

// Mock useUserRole hook
jest.mock('@/hooks/useUserRole', () => ({
  useUserRole: jest.fn(),
}));

describe('Sidebar', () => {
  const mockRouter = {
    pathname: '/',
    push: jest.fn(),
  };

  const mockSupabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { org_id: 'test-org' },
            error: null,
          }),
        })),
        not: jest.fn(() => ({
          count: jest.fn().mockResolvedValue({ count: 2 }),
        })),
      })),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    })),
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (createClientComponentClient as jest.Mock).mockReturnValue(mockSupabase);
    (useUserRole as jest.Mock).mockReturnValue({ role: 'admin' });
  });

  it('renders navigation links', () => {
    render(<Sidebar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Tickets')).toBeInTheDocument();
    expect(screen.getByText('AI Drafts')).toBeInTheDocument();
  });

  it('shows admin links when user is admin', () => {
    render(<Sidebar />);
    expect(screen.getByText('Organization Settings')).toBeInTheDocument();
    expect(screen.getByText('Knowledge Base')).toBeInTheDocument();
  });

  it('hides admin links when user is not admin', () => {
    (useUserRole as jest.Mock).mockReturnValue({ role: 'customer' });
    render(<Sidebar />);
    expect(screen.queryByText('Organization Settings')).not.toBeInTheDocument();
    expect(screen.queryByText('Knowledge Base')).not.toBeInTheDocument();
  });

  it('displays draft count badge when there are drafts', async () => {
    render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('handles sign out', async () => {
    render(<Sidebar />);
    const signOutButton = screen.getByText('Sign Out');
    signOutButton.click();
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/signin');
  });
}); 