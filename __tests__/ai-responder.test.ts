import { classifyInboundEmail, decideAutoSend, generateRagResponse } from '../utils/ai-responder';

// Mock the OpenAI and Pinecone dependencies
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: class {
      chat = {
        completions: {
          create: async () => ({
            choices: [
              {
                message: {
                  content: `{"classification":"should_respond","confidence":87}`
                }
              }
            ]
          })
        }
      }
    }
  };
});

// Mock the RAG utilities
jest.mock('../utils/rag', () => ({
  generateEmbedding: async () => new Array(1536).fill(0.1),
  queryPinecone: async () => [
    { id: 'doc123_0', metadata: { orgId: 'org123', text: 'Chunk content A' } },
    { id: 'doc123_1', metadata: { orgId: 'org123', text: 'Chunk content B' } }
  ]
}));

describe('AI Responder Utilities', () => {
  describe('classifyInboundEmail', () => {
    it('should return should_respond for a normal query', async () => {
      const emailText = 'Hello, I need help with my product. It is not working.';
      const result = await classifyInboundEmail(emailText);
      expect(result.classification).toBe('should_respond');
      expect(result.confidence).toBe(87);
    });

    it('handles errors gracefully', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress error logs
      const mockOpenAI = jest.requireMock('openai').default;
      mockOpenAI.prototype.chat.completions.create = jest.fn().mockRejectedValue(new Error('API Error'));
      
      const result = await classifyInboundEmail('test');
      expect(result.classification).toBe('unknown');
      expect(result.confidence).toBe(50);
    });
  });

  describe('generateRagResponse', () => {
    it('returns an answer and confidence with references', async () => {
      const { response, confidence, references } = await generateRagResponse(
        'What is your return policy?',
        'org123'
      );
      expect(response).toBe('Not enough info.');
      expect(confidence).toBe(60);
      expect(references).toHaveLength(2);
      expect(references).toContain('doc123_0');
      expect(references).toContain('doc123_1');
    });

    it('handles errors gracefully', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress error logs
      const mockOpenAI = jest.requireMock('openai').default;
      mockOpenAI.prototype.chat.completions.create = jest.fn().mockRejectedValue(new Error('API Error'));
      
      const result = await generateRagResponse('test', 'org123');
      expect(result.response).toBe('Not enough info.');
      expect(result.confidence).toBe(50);
      expect(result.references).toHaveLength(0);
    });
  });

  describe('decideAutoSend', () => {
    it('returns autoSend = true if confidence >= threshold', () => {
      const result = decideAutoSend(85, 85);
      expect(result.autoSend).toBe(true);
    });

    it('returns autoSend = false if confidence < threshold', () => {
      const result = decideAutoSend(80, 85);
      expect(result.autoSend).toBe(false);
    });

    it('uses default threshold of 85 if not specified', () => {
      expect(decideAutoSend(90).autoSend).toBe(true);
      expect(decideAutoSend(80).autoSend).toBe(false);
    });
  });
}); 