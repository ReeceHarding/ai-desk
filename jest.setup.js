// Import Jest DOM matchers
import '@testing-library/jest-dom';

// Mock window.crypto for PKCE tests
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: () => new Uint8Array(32),
    subtle: {
      digest: () => Promise.resolve(new Uint8Array(32))
    }
  }
});

// Mock Supabase client
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: () => ({
    auth: {
      signInWithOAuth: jest.fn(),
      getSession: jest.fn()
    }
  })
}));

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn()
  })
}));

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Mock fetch
global.fetch = jest.fn();

// Set up environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

// Mock Supabase client
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: () => ({
    auth: {
      getSession: jest.fn(),
      signInWithOAuth: jest.fn(),
      signOut: jest.fn()
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn(),
    update: jest.fn(),
    eq: jest.fn()
  })
}))

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    query: {}
  })
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID = 'test-client-id';
process.env.GMAIL_CLIENT_SECRET = 'test-client-secret';
process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI = 'http://localhost:3000/api/integrations/gmail/callback'; 