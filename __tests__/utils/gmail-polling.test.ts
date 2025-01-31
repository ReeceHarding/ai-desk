import { jest } from '@jest/globals';
import { GmailTokens } from '../../types/gmail';
import { pollAndCreateTickets } from '../../utils/gmail';
import { cleanupTestDatabase, setupTestEnvironment } from './test-setup';

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Mock types
type MockResponse = Partial<Response> & {
  ok: boolean;
  status?: number;
  statusText?: string;
  json: () => Promise<any>;
};

type MockSupabaseResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

type MockUserProfile = {
  id: string;
  org_id: string;
  gmail_access_token: string;
  gmail_refresh_token: string;
  email: string;
};

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve<MockSupabaseResponse<MockUserProfile>>({
          data: {
            id: 'test-user-id',
            org_id: 'test-org-id',
            gmail_access_token: 'test-access-token',
            gmail_refresh_token: 'test-refresh-token',
            email: 'test@example.com'
          },
          error: null
        }))
      })),
      update: jest.fn(() => Promise.resolve<MockSupabaseResponse<GmailTokens>>({
        data: {
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          token_type: 'Bearer',
          scope: 'email profile',
          expiry_date: Date.now() + 3600000
        },
        error: null
      }))
    })),
    insert: jest.fn(() => Promise.resolve<MockSupabaseResponse<{ id: string }>>({
      data: { id: 'test-ticket-id' },
      error: null
    }))
  }))
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

// Mock fetch
const mockFetch = jest.fn(async () => new Response(
  JSON.stringify({ messages: [] }), 
  { 
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  }
));

(global as any).fetch = mockFetch;

describe('Gmail Polling Integration', () => {
  let testUserId: string
  let testOrgId: string

  beforeAll(async () => {
    // Set up test environment and get test user ID
    try {
      const { user, org } = await setupTestEnvironment()
      testUserId = user.id
      testOrgId = org.id
    } catch (error) {
      console.error('Error in beforeAll:', error)
      throw error
    }
  })

  afterAll(async () => {
    try {
      await cleanupTestDatabase()
    } catch (error) {
      console.error('Error in afterAll:', error)
      throw error
    }
  })

  beforeEach(() => {
    // Reset environment variables before each test
    process.env.TEST_GMAIL_ACCESS_TOKEN = 'test-access-token'
    process.env.TEST_GMAIL_REFRESH_TOKEN = 'test-refresh-token'
  })

  describe('pollAndCreateTickets', () => {
    it('should successfully poll Gmail and create tickets', async () => {
      try {
        const result = await pollAndCreateTickets(testUserId)
        expect(result).toBeDefined()
      } catch (error) {
        console.error('Error in test:', error)
        throw error
      }
    })

    it('should handle missing Gmail tokens', async () => {
      try {
        // Use a non-existent user ID to test missing tokens
        await expect(pollAndCreateTickets('non-existent-user'))
          .rejects
          .toThrow('Gmail not connected')
      } catch (error) {
        console.error('Error in test:', error)
        throw error
      }
    })

    it('should handle Gmail API errors', async () => {
      try {
        // Mock Gmail API error by using invalid tokens
        process.env.TEST_GMAIL_ACCESS_TOKEN = 'invalid-token'
        await expect(pollAndCreateTickets(testUserId))
          .rejects
          .toThrow('Failed to fetch Gmail messages')
      } catch (error) {
        console.error('Error in test:', error)
        throw error
      }
    })
  })
}); 