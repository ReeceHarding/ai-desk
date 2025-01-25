import ConnectGmailAdmin from '@/pages/onboarding/admin/connect-gmail';
import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';

// Mock the dependencies
jest.mock('@supabase/auth-helpers-nextjs');
jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn() })
}));
jest.mock('@/utils/logger');

describe('ConnectGmailAdmin', () => {
  const mockSupabase = {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
      signInWithOAuth: jest.fn()
    }
  };

  const mockRouter = {
    query: {},
    push: jest.fn()
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    (createClientComponentClient as jest.Mock).mockReturnValue(mockSupabase);
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3000' },
      writable: true
    });

    // Setup successful auth responses
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: '123' } } }, error: null });
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: '123' } }, error: null });
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
  });

  it('renders the component with benefits list', () => {
    render(<ConnectGmailAdmin />);
    
    expect(screen.getByText('Connect Gmail (Optional)')).toBeInTheDocument();
    expect(screen.getByText('Benefits of Gmail Integration')).toBeInTheDocument();
    expect(screen.getByText('Manage support tickets directly from your email')).toBeInTheDocument();
  });

  it('renders connect and skip buttons', () => {
    render(<ConnectGmailAdmin />);
    
    expect(screen.getByText(/connect gmail/i)).toBeInTheDocument();
    expect(screen.getByText(/skip/i)).toBeInTheDocument();
  });

  it('handles connect button click', () => {
    render(<ConnectGmailAdmin />);
    
    const connectButton = screen.getByText(/connect gmail/i);
    fireEvent.click(connectButton);
  });

  it('handles skip button click', () => {
    render(<ConnectGmailAdmin />);
    
    const skipButton = screen.getByText(/skip/i);
    fireEvent.click(skipButton);
  });

  it('handles successful Gmail connection', async () => {
    render(<ConnectGmailAdmin />);
    
    const connectButton = screen.getByRole('button', { name: /connect gmail/i });
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: expect.objectContaining({
          queryParams: expect.objectContaining({
            access_type: 'offline',
            prompt: 'consent'
          })
        })
      });
    });

    expect(logger.info).toHaveBeenCalledWith('[ADMIN_CONNECT_GMAIL] OAuth initiated successfully');
  });

  it('handles successful skip action', async () => {
    render(<ConnectGmailAdmin />);
    
    const skipButton = screen.getByRole('button', { name: /skip/i });
    fireEvent.click(skipButton);

    await waitFor(() => {
      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith('/admin/dashboard');
    });

    expect(logger.info).toHaveBeenCalledWith('[ADMIN_CONNECT_GMAIL] Gmail setup skipped successfully');
  });

  it('displays error message when auth fails', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: new Error('Auth failed') });
    
    render(<ConnectGmailAdmin />);
    
    const connectButton = screen.getByRole('button', { name: /connect gmail/i });
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(screen.getByText(/no active session found/i)).toBeInTheDocument();
    });

    expect(logger.error).toHaveBeenCalled();
  });

  it('handles OAuth error from URL parameter', () => {
    mockRouter.query = { error: 'Test%20error%20message' };
    
    render(<ConnectGmailAdmin />);
    
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });
}); 