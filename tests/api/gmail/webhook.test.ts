import handler from '@/pages/api/gmail/webhook';
import { classifyInboundEmail, decideAutoSend, generateRagResponse } from '@/utils/ai-responder';
import { sendGmailReply } from '@/utils/gmail';
import { createClient } from '@supabase/supabase-js';
import { createMocks } from 'node-mocks-http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/ai-responder');
vi.mock('@/utils/gmail');
vi.mock('@supabase/supabase-js');

describe('Gmail Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('processes inbound email and auto-sends response', async () => {
    // Mock Supabase client
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    (createClient as any).mockReturnValue(mockSupabase);

    // Mock AI functions
    (classifyInboundEmail as any).mockResolvedValue({
      classification: 'should_respond',
      confidence: 90,
    });
    (generateRagResponse as any).mockResolvedValue({
      response: 'Here is the answer',
      confidence: 90,
      references: ['ref1'],
    });
    (decideAutoSend as any).mockReturnValue({ autoSend: true });
    (sendGmailReply as any).mockResolvedValue({ success: true });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        message: {
          data: Buffer.from(JSON.stringify({
            emailAddress: 'test@example.com',
            historyId: '12345',
            subject: 'Test Subject',
            threadId: 'thread123',
            messageId: 'msg123',
            orgId: 'org123',
          })).toString('base64'),
        },
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(mockSupabase.from).toHaveBeenCalledWith('chats');
    expect(mockSupabase.insert).toHaveBeenCalled();
    expect(sendGmailReply).toHaveBeenCalled();
  });

  it('stores draft when confidence is below threshold', async () => {
    // Mock Supabase client
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    (createClient as any).mockReturnValue(mockSupabase);

    // Mock AI functions with low confidence
    (classifyInboundEmail as any).mockResolvedValue({
      classification: 'should_respond',
      confidence: 90,
    });
    (generateRagResponse as any).mockResolvedValue({
      response: 'Here is the answer',
      confidence: 80, // Below threshold
      references: ['ref1'],
    });
    (decideAutoSend as any).mockReturnValue({ autoSend: false });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        message: {
          data: Buffer.from(JSON.stringify({
            emailAddress: 'test@example.com',
            historyId: '12345',
            subject: 'Test Subject',
            threadId: 'thread123',
            messageId: 'msg123',
            orgId: 'org123',
          })).toString('base64'),
        },
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(mockSupabase.from).toHaveBeenCalledWith('chats');
    expect(mockSupabase.insert).toHaveBeenCalled();
    expect(sendGmailReply).not.toHaveBeenCalled();
  });

  it('skips RAG when no response needed', async () => {
    // Mock Supabase client
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    (createClient as any).mockReturnValue(mockSupabase);

    // Mock AI functions to indicate no response needed
    (classifyInboundEmail as any).mockResolvedValue({
      classification: 'no_response',
      confidence: 95,
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        message: {
          data: Buffer.from(JSON.stringify({
            emailAddress: 'test@example.com',
            historyId: '12345',
            subject: 'Test Subject',
            threadId: 'thread123',
            messageId: 'msg123',
            orgId: 'org123',
          })).toString('base64'),
        },
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(generateRagResponse).not.toHaveBeenCalled();
    expect(sendGmailReply).not.toHaveBeenCalled();
  });

  it('handles database errors gracefully', async () => {
    // Mock Supabase client with error
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      }),
    };
    (createClient as any).mockReturnValue(mockSupabase);

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        message: {
          data: Buffer.from(JSON.stringify({
            emailAddress: 'test@example.com',
            historyId: '12345',
            subject: 'Test Subject',
            threadId: 'thread123',
            messageId: 'msg123',
            orgId: 'org123',
          })).toString('base64'),
        },
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Internal server error',
    });
  });
}); 