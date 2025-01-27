import LoginPage from '@/pages/auth/login';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock Supabase client
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: jest.fn(),
}));

describe('LoginPage', () => {
  const mockRouter = {
    push: jest.fn(),
    query: {},
  };
  const mockSupabaseClient = {
    auth: {
      signInWithPassword: jest.fn(),
    },
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (createClientComponentClient as jest.Mock).mockReturnValue(mockSupabaseClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders login form', () => {
    render(<LoginPage />);
    
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows error message on failed login', async () => {
    const errorMessage = 'Invalid login credentials';
    mockSupabaseClient.auth.signInWithPassword.mockRejectedValueOnce(new Error(errorMessage));
    
    render(<LoginPage />);
    
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('redirects to tickets page on successful login', async () => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: '123' } },
      error: null,
    });
    
    render(<LoginPage />);
    
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/tickets');
    });
  });

  it('navigates to signup page when create account is clicked', () => {
    render(<LoginPage />);
    
    fireEvent.click(screen.getByRole('button', { name: /create an account/i }));
    
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/signup');
  });

  it('disables submit button during login attempt', async () => {
    mockSupabaseClient.auth.signInWithPassword.mockImplementationOnce(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(<LoginPage />);
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });
    
    fireEvent.click(submitButton);
    
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent(/signing in/i);
  });

  it('redirects to original URL after successful login if redirect query param exists', async () => {
    const redirectUrl = '/some/protected/page';
    (useRouter as jest.Mock).mockReturnValue({
      ...mockRouter,
      query: { redirect: redirectUrl },
    });

    mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: '123' } },
      error: null,
    });
    
    render(<LoginPage />);
    
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith(redirectUrl);
    });
  });
}); 
