// Import Jest DOM matchers
import '@testing-library/jest-dom';

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock crypto.subtle for PKCE tests
const crypto = require('crypto');
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: async (algorithm, data) => {
        const hash = crypto.createHash(algorithm.replace('-', '').toLowerCase());
        hash.update(data);
        return hash.digest();
      }
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

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID = 'test-gmail-client-id';
process.env.GMAIL_CLIENT_SECRET = 'test-gmail-client-secret';
process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI = 'http://localhost:3000/api/integrations/gmail/callback';

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
); 