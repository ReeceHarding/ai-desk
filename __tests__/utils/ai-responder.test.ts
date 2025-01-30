import { classifyInboundEmail, decideAutoSend, generateRagResponse } from '@/utils/ai-responder';
import { generateEmbedding, queryPinecone } from '@/utils/rag';

// Mock dependencies
jest.mock('@/utils/rag');
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: class {
      chat = {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: '{"classification":"should_respond","confidence":87}'
                }
              }
            ]
          })
        }
      }
    }
  };
});

// Mock rag utilities
jest.mock('@/utils/rag', () => ({
  generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  queryPinecone: jest.fn().mockResolvedValue([
    {
      id: 'doc123_0',
      metadata: {
        orgId: 'org123',
        text: 'This is a test knowledge base chunk.'
      }
    }
  ])
}));

describe('AI Responder', () => {
  describe('classifyInboundEmail', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });

    it('should classify a support question as should_respond', async () => {
      const emailText = 'Hello, I need help with my product. It is not working.';
      const result = await classifyInboundEmail(emailText);
      expect(result.classification).toBe('should_respond');
      expect(result.confidence).toBe(87);
    });

    it('should handle malformed GPT responses gracefully', async () => {
      // Mock a bad response
      jest.mock('openai', () => ({
        __esModule: true,
        default: class {
          chat = {
            completions: {
              create: jest.fn().mockResolvedValue({
                choices: [{ message: { content: 'Invalid JSON' } }]
              })
            }
          }
        }
      }));

      const emailText = 'Test email';
      const result = await classifyInboundEmail(emailText);
      expect(result.classification).toBe('unknown');
      expect(result.confidence).toBe(50);
    });

    it('handles API errors gracefully', async () => {
      // Mock OpenAI to throw an error
      const openai = require('openai').default;
      openai.prototype.chat.completions.create = jest.fn().mockRejectedValue(
        new Error('API Error')
      );

      const result = await classifyInboundEmail('Test email');
      expect(result.classification).toBe('unknown');
      expect(result.confidence).toBe(50);
    });
  });

  describe('generateRagResponse', () => {
    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();
      
      // Mock OpenAI response for RAG
      const openai = require('openai').default;
      openai.chat.completions.create = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: '{"answer":"Here is the answer from the knowledge base.","confidence":92}'
            }
          }
        ]
      });
    });

    it('should generate a response with confidence and references', async () => {
      const result = await generateRagResponse(
        'How do I reset my password?',
        'org123',
        5
      );

      expect(result.response).toBe('Here is the answer from the knowledge base.');
      expect(result.confidence).toBe(92);
      expect(result.references).toHaveLength(1);
      expect(result.references[0]).toBe('doc123_0');

      // Verify the embedding was generated
      expect(generateEmbedding).toHaveBeenCalledWith('How do I reset my password?');
      
      // Verify Pinecone was queried
      expect(queryPinecone).toHaveBeenCalled();
    });

    it('should handle no relevant chunks gracefully', async () => {
      // Mock no results from Pinecone
      (queryPinecone as jest.Mock).mockResolvedValueOnce([]);

      const result = await generateRagResponse(
        'How do I reset my password?',
        'org123',
        5
      );

      expect(result.response).toBe('Not enough info.');
      expect(result.confidence).toBe(50);
      expect(result.references).toHaveLength(0);
    });

    it('should filter chunks by orgId', async () => {
      // Mock mixed org results
      (queryPinecone as jest.Mock).mockResolvedValueOnce([
        {
          id: 'doc123_0',
          metadata: { orgId: 'org123', text: 'Relevant chunk' }
        },
        {
          id: 'doc456_0',
          metadata: { orgId: 'different_org', text: 'Irrelevant chunk' }
        }
      ]);

      const result = await generateRagResponse(
        'How do I reset my password?',
        'org123',
        5
      );

      // Should only use the chunk from org123
      expect(result.references).toHaveLength(1);
      expect(result.references[0]).toBe('doc123_0');
    });
  });

  describe('decideAutoSend', () => {
    it('should return true if confidence meets threshold', () => {
      const result = decideAutoSend(85, 85);
      expect(result.autoSend).toBe(true);
    });

    it('should return false if confidence is below threshold', () => {
      const result = decideAutoSend(84, 85);
      expect(result.autoSend).toBe(false);
    });

    it('uses default threshold of 85 if not provided', () => {
      expect(decideAutoSend(86).autoSend).toBe(true);
      expect(decideAutoSend(84).autoSend).toBe(false);
    });
  });
}); 
