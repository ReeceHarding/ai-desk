import handler from '@/pages/api/gmail/webhook';
import { classifyInboundEmail, decideAutoSend, generateRagResponse } from '@/utils/ai-responder';
import { handleInboundEmail } from '@/utils/inbound-email';
import { createClient } from '@supabase/supabase-js';
import { createMocks } from 'node-mocks-http';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/utils/ai-responder', () => ({
  classifyInboundEmail: jest.fn(),
  generateRagResponse: jest.fn(),
  decideAutoSend: jest.fn(),
}));

jest.mock('@/utils/inbound-email', () => ({
  handleInboundEmail: jest.fn(),
}));

jest.mock('@/utils/gmail');

describe('Gmail Webhook Handler', () => {
  const mockMessage = {
    id: 'msg123',
    threadId: 'thread123',
    snippet: 'Test email content',
    payload: {
      headers: [
        { name: 'From', value: 'test@example.com' },
        { name: 'Subject', value: 'Test Subject' },
      ],
    },
  };

  const mockSupabase = {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'chat123' },
        error: null,
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      }),
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    (handleInboundEmail as jest.Mock).mockResolvedValue({ ticketId: 'ticket123' });
    (classifyInboundEmail as jest.Mock).mockResolvedValue({
      classification: 'should_respond',
      confidence: 90,
    });
    (generateRagResponse as jest.Mock).mockResolvedValue({
      response: 'AI generated response',
      confidence: 95,
      references: ['ref1', 'ref2'],
    });
    (decideAutoSend as jest.Mock).mockReturnValue({ autoSend: true });
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  it('returns 405 for non-POST requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Method not allowed' });
  });

  it('returns 400 if message ID or thread ID is missing', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        message: { ...mockMessage, id: undefined },
        orgId: 'org123',
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Missing message ID or thread ID' });
  });

  it('returns 400 if organization ID is missing', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        message: mockMessage,
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Missing organization ID' });
  });

  it('processes inbound email and generates response when should_respond', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        message: mockMessage,
        orgId: 'org123',
      },
    });

    await handler(req, res);

    expect(handleInboundEmail).toHaveBeenCalledWith({
      messageId: 'msg123',
      threadId: 'thread123',
      fromEmail: 'test@example.com',
      body: 'Test email content',
      orgId: 'org123',
    });

    expect(classifyInboundEmail).toHaveBeenCalledWith('Test email content');
    expect(generateRagResponse).toHaveBeenCalledWith('Test email content', 'org123', 5);
    expect(decideAutoSend).toHaveBeenCalledWith(95, 85);

    expect(mockSupabase.from).toHaveBeenCalledWith('ticket_email_chats');
    expect(global.fetch).toHaveBeenCalled();
    expect(res._getStatusCode()).toBe(200);
  });

  it('does not generate response when classification is no_response', async () => {
    (classifyInboundEmail as jest.Mock).mockResolvedValueOnce({
      classification: 'no_response',
      confidence: 90,
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        message: mockMessage,
        orgId: 'org123',
      },
    });

    await handler(req, res);

    expect(generateRagResponse).not.toHaveBeenCalled();
    expect(res._getStatusCode()).toBe(200);
  });

  it('handles errors gracefully', async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      }),
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        message: mockMessage,
        orgId: 'org123',
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Failed to find chat record' });
  });

  it('stores response as draft when confidence is below threshold', async () => {
    (generateRagResponse as jest.Mock).mockResolvedValueOnce({
      response: 'AI generated response',
      confidence: 75,
      references: ['ref1', 'ref2'],
    });
    (decideAutoSend as jest.Mock).mockReturnValueOnce({ autoSend: false });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        message: mockMessage,
        orgId: 'org123',
      },
    });

    await handler(req, res);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('ticket_email_chats');
    expect(res._getStatusCode()).toBe(200);
  });
}); 