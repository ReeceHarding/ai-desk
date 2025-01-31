import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { Document } from 'langchain/document';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LangChainProcessor } from '../../../utils/langchain';
import { VectorStoreManager } from '../../../utils/langchain/vectorStore';

// Mock dependencies
vi.mock('../../../utils/langchain/vectorStore');
vi.mock('langchain/chains');

describe('LangChainProcessor', () => {
  let processor: LangChainProcessor;
  const mockVectorStore = {
    initialize: vi.fn(),
    addDocuments: vi.fn(),
    getRetriever: vi.fn()
  };
  const mockChain = {
    call: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock VectorStoreManager
    (VectorStoreManager as any).mockImplementation(() => mockVectorStore);
    
    // Mock ConversationalRetrievalQAChain
    (ConversationalRetrievalQAChain.fromLLM as any).mockReturnValue(mockChain);
    
    processor = new LangChainProcessor();
  });

  describe('initialize', () => {
    it('initializes successfully', async () => {
      await processor.initialize();
      
      expect(mockVectorStore.initialize).toHaveBeenCalled();
      expect(ConversationalRetrievalQAChain.fromLLM).toHaveBeenCalled();
    });

    it('only initializes once', async () => {
      await processor.initialize();
      await processor.initialize();
      
      expect(mockVectorStore.initialize).toHaveBeenCalledTimes(1);
      expect(ConversationalRetrievalQAChain.fromLLM).toHaveBeenCalledTimes(1);
    });

    it('handles initialization errors', async () => {
      mockVectorStore.initialize.mockRejectedValueOnce(new Error('Init failed'));
      
      await expect(processor.initialize()).rejects.toThrow('Init failed');
    });
  });

  describe('processDocument', () => {
    const mockText = 'test document';
    const mockMetadata = { docId: 'doc1', orgId: 'org1' };

    beforeEach(async () => {
      await processor.initialize();
    });

    it('processes document successfully', async () => {
      const mockProcessed = {
        chunks: ['chunk1', 'chunk2'],
        metadata: [
          { ...mockMetadata, chunkIndex: 0 },
          { ...mockMetadata, chunkIndex: 1 }
        ]
      };
      
      mockVectorStore.addDocuments.mockResolvedValueOnce(undefined);
      
      await processor.processDocument(mockText, mockMetadata);
      
      expect(mockVectorStore.addDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          chunks: expect.any(Array),
          metadata: expect.any(Array)
        })
      );
    });

    it('initializes when not initialized', async () => {
      processor = new LangChainProcessor();
      await processor.processDocument(mockText, mockMetadata);
      
      expect(mockVectorStore.initialize).toHaveBeenCalled();
    });

    it('handles processing errors', async () => {
      mockVectorStore.addDocuments.mockRejectedValueOnce(new Error('Processing failed'));
      
      await expect(processor.processDocument(mockText, mockMetadata))
        .rejects
        .toThrow('Processing failed');
    });
  });

  describe('generateResponse', () => {
    const mockQuery = 'test query';
    const mockOrgId = 'org1';
    const mockChatHistory: string[] = ['previous message'];

    beforeEach(async () => {
      await processor.initialize();
    });

    it('generates response successfully', async () => {
      const mockLLMResponse = {
        text: JSON.stringify({
          answer: 'test answer',
          confidence: 85,
          reasoning: 'high confidence due to relevant context'
        }),
        sourceDocuments: [
          new Document({
            pageContent: 'source1',
            metadata: { docId: 'doc1', score: 0.9 }
          })
        ]
      };
      
      mockChain.call.mockResolvedValueOnce(mockLLMResponse);
      
      const response = await processor.generateResponse(
        mockQuery,
        mockOrgId,
        mockChatHistory
      );
      
      expect(response).toEqual({
        response: 'test answer',
        confidence: 85,
        sources: [{
          docId: 'doc1',
          chunk: 'source1',
          relevance: 0.9
        }],
        debugInfo: expect.objectContaining({
          processingTimeMs: expect.any(Number),
          chunks: expect.any(Array)
        })
      });
    });

    it('handles malformed LLM responses', async () => {
      const mockLLMResponse = {
        text: 'invalid json',
        sourceDocuments: []
      };
      
      mockChain.call.mockResolvedValueOnce(mockLLMResponse);
      
      const response = await processor.generateResponse(
        mockQuery,
        mockOrgId
      );
      
      expect(response).toEqual({
        response: 'Error processing response',
        confidence: 0,
        sources: [],
        debugInfo: expect.objectContaining({
          processingTimeMs: expect.any(Number),
          modelResponse: 'invalid json'
        })
      });
    });

    it('throws if not initialized', async () => {
      processor = new LangChainProcessor();
      await expect(processor.generateResponse(mockQuery, mockOrgId))
        .rejects
        .toThrow();
    });

    it('handles generation errors', async () => {
      mockChain.call.mockRejectedValueOnce(new Error('Generation failed'));
      
      await expect(processor.generateResponse(mockQuery, mockOrgId))
        .rejects
        .toThrow('Generation failed');
    });

    it('formats chat history correctly', async () => {
      mockChain.call.mockResolvedValueOnce({
        text: JSON.stringify({
          answer: 'test',
          confidence: 80
        }),
        sourceDocuments: []
      });

      await processor.generateResponse(
        mockQuery,
        mockOrgId,
        ['user msg', 'assistant msg', 'user msg 2']
      );

      expect(mockChain.call).toHaveBeenCalledWith(
        expect.objectContaining({
          chat_history: 'Human: user msg\nAssistant: assistant msg\nHuman: user msg 2'
        })
      );
    });
  });
}); 