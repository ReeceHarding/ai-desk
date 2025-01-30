import { processInboundEmailWithAI, sendDraftResponse } from '../utils/ai-email-processor';
import { classifyInboundEmail, generateRagResponse } from '../utils/ai-responder';
import { sendGmailReply } from '../utils/gmail';

// Mock dependencies
jest.mock('../utils/ai-responder');
jest.mock('../utils/gmail');

// Mock Supabase client
const mockSupabaseResponse = {
  data: {
    id: 'chat123',
    thread_id: 'thread123',
    message_id: 'msg123',
    from_address: 'user@example.com',
    subject: 'Test Subject',
    metadata: {},
    ai_draft_response: 'Draft response'
  },
  error: null
};

const mockSupabaseClient = {
  from: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: null, error: null })
    }),
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(mockSupabaseResponse)
      })
    })
  })
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

describe('AI Email Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processInboundEmailWithAI', () => {
    it('should classify and not generate response for no_response', async () => {
      // Mock classification as no_response
      (classifyInboundEmail as jest.Mock).mockResolvedValueOnce({
        classification: 'no_response',
        confidence: 90
      });

      const result = await processInboundEmailWithAI(
        'chat123',
        'Marketing email content',
        'org123'
      );

      expect(result.classification).toBe('no_response');
      expect(result.autoResponded).toBe(false);
      expect(generateRagResponse).not.toHaveBeenCalled();
    });

    it('should generate and auto-send response with high confidence', async () => {
      // Mock successful classification and RAG
      (classifyInboundEmail as jest.Mock).mockResolvedValueOnce({
        classification: 'should_respond',
        confidence: 90
      });
      (generateRagResponse as jest.Mock).mockResolvedValueOnce({
        response: 'AI generated response',
        confidence: 95,
        references: ['doc1', 'doc2']
      });

      const result = await processInboundEmailWithAI(
        'chat123',
        'Help request content',
        'org123'
      );

      expect(result.classification).toBe('should_respond');
      expect(result.autoResponded).toBe(true);
      expect(result.draftResponse).toBe('AI generated response');
      expect(sendGmailReply).toHaveBeenCalled();
    });

    it('should save as draft with low confidence', async () => {
      // Mock classification success but low RAG confidence
      (classifyInboundEmail as jest.Mock).mockResolvedValueOnce({
        classification: 'should_respond',
        confidence: 90
      });
      (generateRagResponse as jest.Mock).mockResolvedValueOnce({
        response: 'AI generated response',
        confidence: 70,
        references: ['doc1']
      });

      const result = await processInboundEmailWithAI(
        'chat123',
        'Complex help request',
        'org123'
      );

      expect(result.classification).toBe('should_respond');
      expect(result.autoResponded).toBe(false);
      expect(result.draftResponse).toBe('AI generated response');
      expect(sendGmailReply).not.toHaveBeenCalled();
    });
  });

  describe('sendDraftResponse', () => {
    it('should send existing draft and update status', async () => {
      await sendDraftResponse('chat123');

      expect(sendGmailReply).toHaveBeenCalledWith({
        threadId: 'thread123',
        inReplyTo: 'msg123',
        to: ['user@example.com'],
        subject: 'Re: Test Subject',
        htmlBody: 'Draft response'
      });
    });

    it('should throw error if no draft exists', async () => {
      // Mock no draft found
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      await expect(sendDraftResponse('chat123')).rejects.toThrow('No draft response found');
      expect(sendGmailReply).not.toHaveBeenCalled();
    });
  });
}); 
