import { classifyInboundEmail, decideAutoSend, generateRagResponse } from '@/utils/ai-responder';
import { generateEmbedding, queryPinecone } from '@/utils/rag';
import OpenAI from 'openai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/rag');
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })),
  };
});

describe('AI Responder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('classifyInboundEmail', () => {
    it('classifies support questions as should_respond', async () => {
      const mockOpenAI = new OpenAI({});
      (mockOpenAI.chat.completions.create as any).mockResolvedValue({
        choices: [{
          message: {
            content: '{"classification":"should_respond","confidence":90}',
          },
        }],
      });

      const result = await classifyInboundEmail('I need help with my account');
      expect(result).toEqual({
        classification: 'should_respond',
        confidence: 90,
      });
    });

    it('classifies spam as no_response', async () => {
      const mockOpenAI = new OpenAI({});
      (mockOpenAI.chat.completions.create as any).mockResolvedValue({
        choices: [{
          message: {
            content: '{"classification":"no_response","confidence":95}',
          },
        }],
      });

      const result = await classifyInboundEmail('Buy cheap watches now!');
      expect(result).toEqual({
        classification: 'no_response',
        confidence: 95,
      });
    });

    it('returns unknown for unclear cases', async () => {
      const mockOpenAI = new OpenAI({});
      (mockOpenAI.chat.completions.create as any).mockResolvedValue({
        choices: [{
          message: {
            content: '{"classification":"unknown","confidence":50}',
          },
        }],
      });

      const result = await classifyInboundEmail('');
      expect(result).toEqual({
        classification: 'unknown',
        confidence: 50,
      });
    });

    it('handles API errors gracefully', async () => {
      const mockOpenAI = new OpenAI({});
      (mockOpenAI.chat.completions.create as any).mockRejectedValue(
        new Error('API Error')
      );

      const result = await classifyInboundEmail('test');
      expect(result).toEqual({
        classification: 'unknown',
        confidence: 50,
      });
    });
  });

  describe('generateRagResponse', () => {
    it('generates a response using relevant context', async () => {
      // Mock embedding and Pinecone query
      (generateEmbedding as any).mockResolvedValue([0.1, 0.2, 0.3]);
      (queryPinecone as any).mockResolvedValue([
        {
          id: 'chunk1',
          metadata: {
            orgId: 'org123',
            text: 'Relevant context for the query',
          },
        },
      ]);

      // Mock OpenAI response
      const mockOpenAI = new OpenAI({});
      (mockOpenAI.chat.completions.create as any).mockResolvedValue({
        choices: [{
          message: {
            content: '{"answer":"Here is the answer","confidence":85}',
          },
        }],
      });

      const result = await generateRagResponse('How do I reset my password?', 'org123');

      expect(result).toEqual({
        response: 'Here is the answer',
        confidence: 85,
        references: ['chunk1'],
      });
    });

    it('returns not enough info when no relevant context found', async () => {
      // Mock empty Pinecone results
      (generateEmbedding as any).mockResolvedValue([0.1, 0.2, 0.3]);
      (queryPinecone as any).mockResolvedValue([]);

      const result = await generateRagResponse('How do I reset my password?', 'org123');

      expect(result).toEqual({
        response: 'Not enough info.',
        confidence: 50,
        references: [],
      });
    });

    it('handles errors gracefully', async () => {
      // Mock error in embedding generation
      (generateEmbedding as any).mockRejectedValue(new Error('Embedding failed'));

      const result = await generateRagResponse('How do I reset my password?', 'org123');

      expect(result).toEqual({
        response: 'Not enough info.',
        confidence: 50,
        references: [],
      });
    });
  });

  describe('decideAutoSend', () => {
    it('returns true when confidence meets threshold', () => {
      expect(decideAutoSend(85, 85).autoSend).toBe(true);
      expect(decideAutoSend(90, 85).autoSend).toBe(true);
    });

    it('returns false when confidence below threshold', () => {
      expect(decideAutoSend(84, 85).autoSend).toBe(false);
      expect(decideAutoSend(70, 85).autoSend).toBe(false);
    });

    it('uses default threshold of 85 when not specified', () => {
      expect(decideAutoSend(85).autoSend).toBe(true);
      expect(decideAutoSend(84).autoSend).toBe(false);
    });
  });
}); 