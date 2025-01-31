import { classifyInboundEmail, decideAutoSend, generateRagResponse } from '@/utils/ai-responder';
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

// Mock isServer
vi.mock('../../utils/env', () => ({
  isServer: true
}));

// Mock OpenAI
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async ({ messages }) => {
          if (messages[0].content.includes('spam')) {
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    should_respond: false,
                    reason: 'spam'
                  })
                }
              }]
            };
          }
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  should_respond: true,
                  reason: 'support question'
                })
              }
            }]
          };
        })
      }
    }
  }))
}));

describe('AI Responder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('classifyInboundEmail', () => {
    it('classifies support questions as should_respond', async () => {
      const result = await classifyInboundEmail('How do I reset my password?');
      expect(result.should_respond).toBe(true);
      expect(result.reason).toBe('support question');
    });

    it('classifies spam as no_response', async () => {
      const result = await classifyInboundEmail('Buy cheap watches! spam');
      expect(result.should_respond).toBe(false);
      expect(result.reason).toBe('spam');
    });

    it('returns unknown for unclear cases', async () => {
      vi.mocked(OpenAI).mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: vi.fn().mockResolvedValueOnce({
              choices: [{
                message: {
                  content: 'invalid json'
                }
              }]
            })
          }
        }
      }));

      const result = await classifyInboundEmail('unclear message');
      expect(result.should_respond).toBe(false);
      expect(result.reason).toBe('unknown');
    });

    it('handles API errors gracefully', async () => {
      vi.mocked(OpenAI).mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: vi.fn().mockRejectedValueOnce(new Error('API Error'))
          }
        }
      }));

      const result = await classifyInboundEmail('test message');
      expect(result.should_respond).toBe(false);
      expect(result.reason).toBe('error');
    });
  });

  describe('generateRagResponse', () => {
    it('generates a response using relevant context', async () => {
      const result = await generateRagResponse({
        question: 'How do I reset my password?',
        context: ['To reset your password, click the "Forgot Password" link.'],
        history: []
      });

      expect(result.response).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('returns not enough info when no relevant context found', async () => {
      const result = await generateRagResponse({
        question: 'How do I reset my password?',
        context: [],
        history: []
      });

      expect(result.response).toBe('I apologize, but I don\'t have enough information to answer your question accurately.');
      expect(result.confidence).toBe(0);
    });

    it('handles errors gracefully', async () => {
      vi.mocked(OpenAI).mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: vi.fn().mockRejectedValueOnce(new Error('API Error'))
          }
        }
      }));

      const result = await generateRagResponse({
        question: 'test question',
        context: ['test context'],
        history: []
      });

      expect(result.response).toBe('I apologize, but I encountered an error while processing your request.');
      expect(result.confidence).toBe(0);
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