import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'your-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'your-service-role-key';
process.env.OPENAI_API_KEY = 'your-openai-key';
process.env.PINECONE_API_KEY = 'your-pinecone-key';
process.env.PINECONE_ENVIRONMENT = 'your-pinecone-env';

// Mock fetch
global.fetch = vi.fn();

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  // Uncomment to ignore specific console methods during tests
  // log: vi.fn(),
  // error: vi.fn(),
  // warn: vi.fn(),
  // info: vi.fn(),
  // debug: vi.fn(),
}; 
