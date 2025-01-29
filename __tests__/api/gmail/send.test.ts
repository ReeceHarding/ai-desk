import handler from '@/pages/api/gmail/send';
import { getGmailClient } from '@/utils/gmail';
import { createMocks } from 'node-mocks-http';

jest.mock('@/utils/gmail', () => ({
  getGmailClient: jest.fn(),
}));

describe('Gmail Send API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 405 for non-POST requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Method not allowed',
    });
  });

  it('returns 400 for missing required fields', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        // Missing required fields
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Missing required fields',
    });
  });

  it('successfully sends an email', async () => {
    const mockGmail = {
      users: {
        messages: {
          send: jest.fn().mockResolvedValue({
            data: {
              id: 'test-message-id',
              threadId: 'test-thread-id',
            },
          }),
        },
      },
    };

    (getGmailClient as jest.Mock).mockResolvedValue(mockGmail);

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        threadId: 'test-thread-id',
        inReplyTo: 'test-message-id',
        to: ['test@example.com'],
        subject: 'Test Subject',
        htmlBody: '<p>Test body</p>',
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      success: true,
      messageId: 'test-message-id',
    });

    expect(mockGmail.users.messages.send).toHaveBeenCalledWith({
      userId: 'me',
      requestBody: expect.objectContaining({
        threadId: 'test-thread-id',
      }),
    });
  });

  it('handles Gmail API errors', async () => {
    const mockError = new Error('Gmail API error');
    (getGmailClient as jest.Mock).mockRejectedValue(mockError);

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        threadId: 'test-thread-id',
        inReplyTo: 'test-message-id',
        to: ['test@example.com'],
        subject: 'Test Subject',
        htmlBody: '<p>Test body</p>',
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Failed to send email',
      details: 'Gmail API error',
    });
  });
}); 