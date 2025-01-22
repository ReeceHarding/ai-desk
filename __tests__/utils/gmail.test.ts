import { GmailMessage, GmailTokens, ParsedEmail } from '../../types/gmail';
import {
    createTicketFromEmail,
    parseGmailMessage,
    pollAndCreateTickets,
    pollGmailInbox
} from '../../utils/gmail';

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock fetch
global.fetch = jest.fn();

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe('Gmail Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.update.mockReturnThis();
    mockSupabase.insert.mockReturnThis();
  });

  // Mock data
  const mockUserId = 'test-user-id';
  const mockUserProfile = {
    id: mockUserId,
    organization_id: 'test-org-id',
    gmail_tokens: {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      expiry_date: Date.now() + 3600000
    } as GmailTokens
  };

  const mockTokens: GmailTokens = {
    access_token: 'mock_access_token',
    refresh_token: 'mock_refresh_token',
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    expiry_date: Date.now() + 3600000
  };

  describe('createTicketFromEmail', () => {
    const mockParsedEmail: ParsedEmail = {
      messageId: 'test-message-id',
      threadId: 'test-thread-id',
      subject: 'Test Subject',
      from: 'test@example.com',
      to: 'support@example.com',
      date: new Date('2024-01-01T00:00:00Z'),
      body: {
        text: 'Test body',
        html: '<p>Test body</p>'
      },
      snippet: 'Test snippet',
      labels: ['INBOX'],
      attachments: []
    };

    it('should create a ticket from email successfully', async () => {
      const result = await createTicketFromEmail(mockParsedEmail, mockUserId);
      expect(result).toBe('test-ticket-id');
    });

    it('should throw error if user profile not found', async () => {
      // Mock user profile not found
      jest.mock('@supabase/supabase-js', () => ({
        createClient: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: null, error: null })
              })
            })
          })
        })
      }));

      await expect(createTicketFromEmail(mockParsedEmail, mockUserId))
        .rejects
        .toThrow('User organization not found');
    });

    it('should throw error if ticket creation fails', async () => {
      // Mock ticket creation failure
      jest.mock('@supabase/supabase-js', () => ({
        createClient: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ 
                  data: {
                    id: 'test-user-id',
                    org_id: 'test-org-id',
                    gmail_refresh_token: 'test-refresh-token',
                    gmail_access_token: 'test-access-token'
                  }, 
                  error: null 
                })
              })
            }),
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: null, error: new Error('Failed to create ticket') })
              })
            })
          })
        })
      }));

      await expect(createTicketFromEmail(mockParsedEmail, mockUserId))
        .rejects
        .toThrow('Failed to create ticket');
    });
  });

  describe('pollGmailInbox', () => {
    it('should fetch messages successfully', async () => {
      const mockMessages = [
        { id: 'msg1', labelIds: ['INBOX'] },
        { id: 'msg2', labelIds: ['INBOX'] }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: mockMessages })
      });

      const result = await pollGmailInbox(mockTokens);
      expect(result).toEqual(mockMessages);
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(pollGmailInbox(mockTokens))
        .rejects
        .toThrow('Failed to fetch Gmail messages: Internal Server Error');
    });

    test('successfully polls inbox with valid tokens', async () => {
      const mockMessages = [
        { id: '1', threadId: 'thread1' },
        { id: '2', threadId: 'thread2' }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMessages
      });

      const result = await pollGmailInbox(mockTokens);
      expect(result).toEqual(mockMessages);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/gmail/messages'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            access_token: mockTokens.access_token,
            refresh_token: mockTokens.refresh_token,
          })
        })
      );
    });

    test('handles expired token by refreshing', async () => {
      const newTokens = { ...mockTokens, access_token: 'new_access_token' };
      
      // First call fails with 401
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      // Token refresh succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...newTokens })
      });

      // Second poll with new token succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ id: '1' }])
      });

      const result = await pollGmailInbox(mockTokens);
      expect(result).toEqual([{ id: '1' }]);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    test('throws error on network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(pollGmailInbox(mockTokens)).rejects.toThrow('Network error');
    });
  });

  describe('pollAndCreateTickets', () => {
    const mockUserId = 'test-user-id';
    const mockOrgId = 'test-org-id';
    
    beforeEach(() => {
      // Reset mocks
      (global.fetch as jest.Mock).mockReset();
      
      // Mock Supabase profile query
      mockSupabase.select.mockImplementation((query: string) => {
        if (query === '*') {
          return Promise.resolve({
            data: {
              id: mockUserId,
              org_id: mockOrgId,
              gmail_access_token: 'mock_access_token',
              gmail_refresh_token: 'mock_refresh_token'
            },
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      });
    });

    test('successfully polls Gmail and creates tickets', async () => {
      // Mock Gmail messages response
      const mockMessages = [
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

      // Mock successful Gmail API responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMessages
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'ticket1' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'ticket2' })
        });

      const result = await pollAndCreateTickets(mockUserId);
      
      expect(result).toEqual({
        success: true,
        ticketsCreated: 2,
        messages: mockMessages.length
      });

      // Verify Gmail API was called
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/gmail/messages'),
        expect.any(Object)
      );

      // Verify tickets were created
      const createTicketCalls = mockSupabase.from.mock.calls
        .filter(call => call[0] === 'tickets');
      expect(createTicketCalls.length).toBe(2);
    });

    test('handles Gmail API errors gracefully', async () => {
      // Mock Gmail API error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Gmail API error'));

      await expect(pollAndCreateTickets(mockUserId))
        .rejects
        .toThrow('Gmail API error');

      // Verify error was logged
      const errorLogCalls = mockSupabase.from.mock.calls
        .filter(call => call[0] === 'audit_logs')
        .filter(call => call[1]?.metadata?.error === 'Gmail API error');
      expect(errorLogCalls.length).toBeGreaterThan(0);
    });

    test('handles missing Gmail tokens', async () => {
      // Mock profile without Gmail tokens
      mockSupabase.select.mockResolvedValueOnce({
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

    test('refreshes expired access token', async () => {
      // Mock initial 401 response and successful token refresh
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'new_access_token',
            token_type: 'Bearer'
          })
        })
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
      const tokenUpdateCalls = mockSupabase.from.mock.calls
        .filter(call => call[0] === 'profiles')
        .filter(call => call[1]?.gmail_access_token === 'new_access_token');
      expect(tokenUpdateCalls.length).toBeGreaterThan(0);
    });

    test('creates tickets from Gmail messages', async () => {
      const mockGmailMessage: GmailMessage = {
        id: 'msg1',
        threadId: 'thread1',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        date: new Date('2024-01-20T12:00:00Z').toISOString(),
        labelIds: ['INBOX'],
        snippet: 'Test snippet'
      };

      const messages = [mockGmailMessage];
      // ... rest of test
    });

    test('handles partial message data', () => {
      const partialMessage: GmailMessage = {
        id: 'msg1',
        threadId: 'thread1',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        date: new Date('2024-01-20T12:00:00Z').toISOString(),
        labelIds: ['INBOX']
      };

      const result = parseGmailMessage(partialMessage);
      expect(result).toBeDefined();
      expect(result.messageId).toBe(partialMessage.id);
      expect(result.threadId).toBe(partialMessage.threadId);
      expect(result.from).toBe(partialMessage.from);
      expect(result.to).toBe(partialMessage.to);
      expect(result.date).toBeInstanceOf(Date);
    });
  });

  describe('parseGmailMessage', () => {
    const mockGmailMessage: GmailMessage = {
      id: 'msg1',
      threadId: 'thread1',
      from: 'sender@example.com',
      to: 'recipient@example.com',
      date: new Date('2024-01-20T12:00:00Z').toISOString(),
      labelIds: ['INBOX'],
      snippet: 'Test snippet'
    };

    test('correctly parses Gmail message', () => {
      const result = parseGmailMessage(mockGmailMessage);
      expect(result).toBeDefined();
      expect(result.messageId).toBe(mockGmailMessage.id);
      expect(result.threadId).toBe(mockGmailMessage.threadId);
      expect(result.from).toBe(mockGmailMessage.from);
      expect(result.to).toBe(mockGmailMessage.to);
      expect(result.date).toBeInstanceOf(Date);
      expect(result.labels).toEqual(['INBOX']);
    });
  });
}); 