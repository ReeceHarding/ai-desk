import '@testing-library/jest-dom';

// Mock fetch
global.fetch = jest.fn();

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID = 'test-client-id';
process.env.GMAIL_CLIENT_SECRET = 'test-client-secret';
process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI = 'http://localhost:3000/api/integrations/gmail/callback';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'your-service-role-key';
process.env.OPENAI_API_KEY = 'your-openai-key';
process.env.PINECONE_API_KEY = 'your-pinecone-key';
process.env.PINECONE_ENVIRONMENT = 'your-pinecone-env';

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  // Uncomment to ignore specific console methods during tests
  // log: jest.fn(),
  // error: jest.fn(),
  // warn: jest.fn(),
  // info: jest.fn(),
  // debug: jest.fn(),
}; 