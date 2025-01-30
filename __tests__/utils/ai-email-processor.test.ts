import { processInboundEmailWithAI, sendDraftResponse } from '@/utils/ai-email-processor';
import { classifyInboundEmail, generateRagResponse } from '@/utils/ai-responder';
import { sendGmailReply } from '@/utils/gmail';

// Mock dependencies
jest.mock('@/utils/ai-responder');
jest.mock('@/utils/gmail');
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {
              id: 'chat123',
              thread_id: 'thread123',
              message_id: 'msg123',
              from_address: 'test@example.com',
              subject: 'Test Subject',
              metadata: {},
            },
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

describe('AI Email Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processInboundEmailWithAI', () => {
    it('should classify and not generate response for no_response classification', async () => {
      (classifyInboundEmail as jest.Mock).mockResolvedValue({
        classification: 'no_response',
        confidence: 90,
      });

      const result = await processInboundEmailWithAI(
        'chat123',
        'Marketing email content',
        'org123'
      );

      expect(result).toEqual({
        classification: 'no_response',
        confidence: 90,
        autoResponded: false,
      });
      expect(generateRagResponse).not.toHaveBeenCalled();
    });

    it('should generate and auto-send response for high confidence', async () => {
      (classifyInboundEmail as jest.Mock).mockResolvedValue({
        classification: 'should_respond',
        confidence: 95,
      });
      (generateRagResponse as jest.Mock).mockResolvedValue({
        response: 'Auto-generated response',
        confidence: 90,
        references: ['ref1', 'ref2'],
      });
      (sendGmailReply as jest.Mock).mockResolvedValue(undefined);

      const result = await processInboundEmailWithAI(
        'chat123',
        'Support question',
        'org123'
      );

      expect(result).toEqual({
        classification: 'should_respond',
        confidence: 95,
        autoResponded: true,
        draftResponse: 'Auto-generated response',
        references: ['ref1', 'ref2'],
      });
      expect(sendGmailReply).toHaveBeenCalled();
    });

    it('should save as draft for low confidence', async () => {
      (classifyInboundEmail as jest.Mock).mockResolvedValue({
        classification: 'should_respond',
        confidence: 95,
      });
      (generateRagResponse as jest.Mock).mockResolvedValue({
        response: 'Draft response',
        confidence: 70, // Below auto-send threshold
        references: ['ref1'],
      });

      const result = await processInboundEmailWithAI(
        'chat123',
        'Complex question',
        'org123'
      );

      expect(result).toEqual({
        classification: 'should_respond',
        confidence: 95,
        autoResponded: false,
        draftResponse: 'Draft response',
        references: ['ref1'],
      });
      expect(sendGmailReply).not.toHaveBeenCalled();
    });
  });

  describe('sendDraftResponse', () => {
    it('should send a draft response and update the record', async () => {
      const mockChatRecord = {
        id: 'chat123',
        thread_id: 'thread123',
        message_id: 'msg123',
        from_address: 'customer@example.com',
        subject: 'Test Subject',
        ai_draft_response: 'Draft response content',
        ticket: {
          org_id: 'org123'
        }
      };

      // Mock Supabase response for getting chat record
      const supabaseMock = require('@supabase/supabase-js').createClient();
      supabaseMock.from().select().eq().single.mockResolvedValue({
        data: mockChatRecord,
        error: null,
      });

      await sendDraftResponse('chat123');

      expect(sendGmailReply).toHaveBeenCalledWith({
        threadId: 'thread123',
        inReplyTo: 'msg123',
        to: ['customer@example.com'],
        subject: 'Re: Test Subject',
        htmlBody: 'Draft response content',
        orgId: 'org123',
      });

      // Verify record was updated
      expect(supabaseMock.from().update().eq).toHaveBeenCalledWith({
        ai_auto_responded: true,
      }, 'chat123');
    });

    it('should throw error if no draft response exists', async () => {
      const supabaseMock = require('@supabase/supabase-js').createClient();
      supabaseMock.from().select().eq().single.mockResolvedValue({
        data: { ai_draft_response: null },
        error: null,
      });

      await expect(sendDraftResponse('chat123')).rejects.toThrow('No draft response found');
      expect(sendGmailReply).not.toHaveBeenCalled();
    });
  });
}); 