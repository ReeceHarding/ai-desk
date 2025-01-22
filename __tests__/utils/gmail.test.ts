import { gmail_v1 } from 'googleapis';
import { GmailMessage } from '../../types/gmail';
import { parseGmailMessage, pollGmailInbox } from '../../utils/gmail';
import {
    generateTestEmail,
    setupTestEnvironment,
    setupTestGmailTokens,
    teardownTestEnvironment
} from './test-setup';

describe('Gmail Integration', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('pollGmailInbox', () => {
    it('successfully polls inbox with valid tokens', async () => {
      const tokens = setupTestGmailTokens();
      const mockEmail1 = generateTestEmail();
      const mockEmail2 = generateTestEmail();

      // Mock Gmail API response with our test data
      const mockGmailResponse: gmail_v1.Schema$ListMessagesResponse = {
        messages: [mockEmail1, mockEmail2]
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockGmailResponse
      });

      const result = await pollGmailInbox(tokens);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(mockEmail1.id);
      expect(result[1].id).toBe(mockEmail2.id);
    });

    it('handles expired token by refreshing', async () => {
      const tokens = {
        ...setupTestGmailTokens(),
        expiry_date: Date.now() - 3600000 // Expired token
      };

      // Mock 401 response for expired token
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized'
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'new_test_access_token',
            token_type: 'Bearer',
            scope: 'https://www.googleapis.com/auth/gmail.modify',
            expires_in: 3600
          })
        });

      await pollGmailInbox(tokens);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('handles rate limiting', async () => {
      const tokens = setupTestGmailTokens();

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      await expect(pollGmailInbox(tokens)).rejects.toThrow('Failed to fetch Gmail messages: Too Many Requests');
    });
  });

  describe('parseGmailMessage', () => {
    it('correctly parses Gmail message', () => {
      const message = generateTestEmail();
      const result = parseGmailMessage(message as unknown as GmailMessage);
      
      expect(result.messageId).toBe(message.id);
      expect(result.threadId).toBe(message.threadId);
      expect(result.from).toBe('sender@test.com');
      expect(result.to).toBe('recipient@test.com');
      expect(result.date).toBeInstanceOf(Date);
      expect(result.subject).toBe('Test Subject');
      expect(result.snippet).toBe('Test email snippet');
    });

    it('handles missing headers', () => {
      const message: gmail_v1.Schema$Message = {
        id: `test-${Date.now()}`,
        threadId: `thread-${Date.now()}`,
        labelIds: ['INBOX'],
        snippet: 'Test email snippet',
        internalDate: Date.now().toString(),
        payload: {
          mimeType: 'text/plain',
          body: { data: Buffer.from('Test email body').toString('base64') }
        }
      };

      const result = parseGmailMessage(message as unknown as GmailMessage);
      expect(result.messageId).toBe(message.id);
      expect(result.from).toBe('');
      expect(result.to).toBe('');
      expect(result.subject).toBe('');
    });
  });
}); 