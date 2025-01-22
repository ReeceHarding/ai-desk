import { createClient } from '@supabase/supabase-js';
import { pollAndCreateTickets } from '../../utils/gmail';
import { GmailTokens, GmailMessage } from '../../types/gmail';

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Mock fetch
global.fetch = jest.fn();

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe('Gmail Polling Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.not.mockReturnThis();
    mockSupabase.update.mockReturnThis();
    mockSupabase.insert.mockReturnThis();
  });

  const mockUserId = 'test-user-id';
  const mockOrgId = 'test-org-id';
  const mockTokens: GmailTokens = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/gmail.modify',
    expiry_date: Date.now() + 3600000
  };

  describe('pollAndCreateTickets', () => {
    it('should successfully poll Gmail and create tickets', async () => {
      // Mock user profile
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: mockUserId,
          org_id: mockOrgId,
          gmail_access_token: mockTokens.access_token,
          gmail_refresh_token: mockTokens.refresh_token
        },
        error: null
      });

      // Mock Gmail messages
      const mockMessages: GmailMessage[] = [
        {
          id: 'msg1',
          threadId: 'thread1',
          labelIds: ['INBOX'],
          subject: 'Test Subject 1',
          from: 'sender1@example.com',
          to: 'recipient@example.com',
          date: new Date().toISOString(),
          body: { text: 'Test body 1', html: '<p>Test body 1</p>' },
          snippet: 'Test snippet 1',
          labels: ['INBOX'],
          attachments: []
        },
        {
          id: 'msg2',
          threadId: 'thread2',
          labelIds: ['INBOX'],
          subject: 'Test Subject 2',
          from: 'sender2@example.com',
          to: 'recipient@example.com',
          date: new Date().toISOString(),
          body: { text: 'Test body 2', html: '<p>Test body 2</p>' },
          snippet: 'Test snippet 2',
          labels: ['INBOX'],
          attachments: []
        }
      ];

      // Mock successful Gmail API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMessages
      });

      // Mock successful ticket creation
      mockSupabase.single.mockResolvedValue({
        data: { id: 'ticket1' },
        error: null
      });

      const result = await pollAndCreateTickets(mockUserId);

      // Verify Gmail API was called
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/gmail/messages'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(mockTokens.access_token)
        })
      );

      // Verify tickets were created
      expect(mockSupabase.from).toHaveBeenCalledWith('tickets');
      expect(result).toHaveLength(2);
    });

    it('should handle missing Gmail tokens', async () => {
      // Mock user profile without tokens
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: mockUserId,
          org_id: mockOrgId,
          gmail_access_token: null,
          gmail_refresh_token: null
        },
        error: null
      });

      await expect(pollAndCreateTickets(mockUserId))
        .rejects
        .toThrow('Gmail not connected');
    });

    it('should handle Gmail API errors', async () => {
      // Mock user profile
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: mockUserId,
          org_id: mockOrgId,
          gmail_access_token: mockTokens.access_token,
          gmail_refresh_token: mockTokens.refresh_token
        },
        error: null
      });

      // Mock Gmail API error
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(pollAndCreateTickets(mockUserId))
        .rejects
        .toThrow('Failed to fetch Gmail messages: Internal Server Error');
    });

    it('should refresh expired access token', async () => {
      // Mock user profile
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: mockUserId,
          org_id: mockOrgId,
          gmail_access_token: mockTokens.access_token,
          gmail_refresh_token: mockTokens.refresh_token
        },
        error: null
      });

      // Mock 401 response for expired token
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401
        })
        // Mock successful token refresh
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'new-access-token',
            token_type: 'Bearer'
          })
        })
        // Mock successful messages fetch with new token
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([])
        });

      await pollAndCreateTickets(mockUserId);

      // Verify token refresh was called
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/gmail/refresh'),
        expect.any(Object)
      );

      // Verify token was updated in database
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          gmail_access_token: 'new-access-token'
        })
      );
    });
  });
}); 