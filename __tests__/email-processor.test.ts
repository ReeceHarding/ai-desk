import { classifyInboundEmail, generateRagResponse } from '@/utils/ai-responder';
import { processInboundEmail } from '@/utils/email-processor';
import { createClient } from '@supabase/supabase-js';

// Mock dependencies
jest.mock('@/utils/ai-responder');
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: 'chat123',
              metadata: {},
            },
            error: null,
          })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          data: null,
          error: null,
        })),
      })),
    })),
  })),
}));

describe('processInboundEmail', () => {
  const mockMessage = {
    id: 'msg123',
    threadId: 'thread123',
    labelIds: ['INBOX'],
    snippet: 'Test email',
    from: 'sender@example.com',
    to: 'support@company.com',
    subject: 'Test Subject',
    date: '2024-01-01T00:00:00Z',
    body: {
      text: 'This is a test email',
      html: '<p>This is a test email</p>',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes an email and stores it without auto-responding when confidence is low', async () => {
    // Mock classification response
    (classifyInboundEmail as jest.Mock).mockResolvedValue({
      classification: 'should_respond',
      confidence: 75,
    });

    // Mock RAG response
    (generateRagResponse as jest.Mock).mockResolvedValue({
      response: 'AI generated response',
      confidence: 80,
      references: ['doc123'],
    });

    const result = await processInboundEmail(mockMessage, 'org123', 'ticket123');

    expect(result).toEqual({
      processed: true,
      classification: 'should_respond',
      confidence: 75,
      autoResponded: false,
    });

    // Verify Supabase calls
    const supabase = createClient('', '');
    expect(supabase.from).toHaveBeenCalledWith('ticket_email_chats');
    expect(supabase.from('ticket_email_chats').insert).toHaveBeenCalled();
    expect(supabase.from('ticket_email_chats').update).toHaveBeenCalled();
  });

  it('processes an email and auto-responds when confidence is high', async () => {
    // Mock classification response
    (classifyInboundEmail as jest.Mock).mockResolvedValue({
      classification: 'should_respond',
      confidence: 95,
    });

    // Mock RAG response
    (generateRagResponse as jest.Mock).mockResolvedValue({
      response: 'AI generated response',
      confidence: 90,
      references: ['doc123'],
    });

    const result = await processInboundEmail(mockMessage, 'org123', 'ticket123');

    expect(result).toEqual({
      processed: true,
      classification: 'should_respond',
      confidence: 95,
      autoResponded: true,
    });
  });

  it('handles errors gracefully', async () => {
    // Mock classification to throw
    (classifyInboundEmail as jest.Mock).mockRejectedValue(new Error('Classification failed'));

    const result = await processInboundEmail(mockMessage, 'org123', 'ticket123');

    expect(result).toEqual({
      processed: false,
    });
  });

  it('skips RAG for no_response classification', async () => {
    // Mock classification response
    (classifyInboundEmail as jest.Mock).mockResolvedValue({
      classification: 'no_response',
      confidence: 90,
    });

    const result = await processInboundEmail(mockMessage, 'org123', 'ticket123');

    expect(result).toEqual({
      processed: true,
      classification: 'no_response',
      confidence: 90,
      autoResponded: false,
    });

    // Verify RAG was not called
    expect(generateRagResponse).not.toHaveBeenCalled();
  });
}); 