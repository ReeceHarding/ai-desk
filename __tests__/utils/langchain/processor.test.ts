import { Document } from 'langchain/document';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../../../types/chat';
import { LangChainProcessor } from '../../../utils/langchain';
import { initClients } from '../../../utils/langchain/config';

// Mock isServer
vi.mock('../../../utils/env', () => ({
  isServer: true
}));

// Mock LangChain clients
const mockClients = {
  embeddings: {
    embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    embedDocuments: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]])
  },
  vectorStore: {
    addDocuments: vi.fn().mockResolvedValue(undefined),
    similaritySearch: vi.fn().mockResolvedValue([
      { pageContent: 'test content', metadata: { source: 'test.md' } }
    ])
  },
  llm: {
    call: vi.fn().mockImplementation(async (messages) => {
      if (messages[0].content.includes('error')) {
        throw new Error('LLM Error');
      }
      return {
        content: 'This is a test response'
      };
    })
  }
};

vi.mock('../../../utils/langchain/config', () => ({
  initClients: vi.fn().mockReturnValue(mockClients)
}));

describe('LangChainProcessor', () => {
  let processor: LangChainProcessor;
  const mockOrgId = 'test-org';

  beforeEach(() => {
    processor = new LangChainProcessor();
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('initializes successfully', async () => {
      await expect(processor.initialize()).resolves.toBeUndefined();
    });

    it('only initializes once', async () => {
      await processor.initialize();
      await processor.initialize();
      expect(vi.mocked(initClients)).toHaveBeenCalledTimes(1);
    });

    it('handles initialization errors', async () => {
      vi.mocked(initClients).mockRejectedValueOnce(new Error('Init Error'));
      await expect(processor.initialize()).rejects.toThrow('Init Error');
    });
  });

  describe('processDocument', () => {
    const mockDoc = new Document({
      pageContent: 'test content',
      metadata: { source: 'test.md' }
    });

    it('processes document successfully', async () => {
      await processor.initialize();
      await expect(processor.processDocument(mockDoc, mockOrgId)).resolves.toBeUndefined();
    });

    it('initializes when not initialized', async () => {
      await processor.processDocument(mockDoc, mockOrgId);
      expect(vi.mocked(initClients)).toHaveBeenCalled();
    });

    it('handles processing errors', async () => {
      await processor.initialize();
      mockClients.vectorStore.addDocuments.mockRejectedValueOnce(new Error('Processing Error'));
      await expect(processor.processDocument(mockDoc, mockOrgId)).rejects.toThrow('Processing Error');
    });
  });

  describe('generateResponse', () => {
    const mockQuery = 'test question';
    const mockHistory: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' }
    ];

    it('generates response successfully', async () => {
      await processor.initialize();
      const response = await processor.generateResponse(mockQuery, mockOrgId, mockHistory);
      expect(response).toBe('This is a test response');
    });

    it('handles malformed LLM responses', async () => {
      await processor.initialize();
      mockClients.llm.call.mockResolvedValueOnce({} as any);
      await expect(processor.generateResponse(mockQuery, mockOrgId, mockHistory)).rejects.toThrow();
    });

    it('throws if not initialized', async () => {
      await expect(processor.generateResponse(mockQuery, mockOrgId, mockHistory)).rejects.toThrow();
    });

    it('handles generation errors', async () => {
      await processor.initialize();
      await expect(processor.generateResponse('error test', mockOrgId, mockHistory)).rejects.toThrow('LLM Error');
    });

    it('formats chat history correctly', async () => {
      await processor.initialize();
      await processor.generateResponse(mockQuery, mockOrgId, mockHistory);
      expect(mockClients.llm.call).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'Hello' }),
        expect.objectContaining({ role: 'assistant', content: 'Hi there' }),
        expect.objectContaining({ role: 'user', content: mockQuery })
      ]));
    });
  });
}); 