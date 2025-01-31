import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LangChainProcessor } from '../../../utils/langchain';
import { DocumentProcessor } from '../../../utils/langchain/documentProcessor';
import { VectorStoreManager } from '../../../utils/langchain/vectorStore';

// Mock dependencies
vi.mock('../../../utils/langchain/documentProcessor');
vi.mock('../../../utils/langchain/vectorStore');
vi.mock('langchain/chains', () => ({
  ConversationalRetrievalQAChain: {
    fromLLM: vi.fn().mockReturnValue({
      call: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          answer: "Test response",
          confidence: 85,
          reasoning: "High confidence due to exact match"
        }),
        sourceDocuments: [
          {
            pageContent: "Test content",
            metadata: {
              docId: "test-doc",
              score: 0.95
            }
          }
        ]
      })
    })
  }
}));

describe('LangChainProcessor', () => {
  let processor: LangChainProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new LangChainProcessor();
  });

  describe('processDocument', () => {
    it('processes documents correctly', async () => {
      const mockProcessed = {
        chunks: ['chunk1', 'chunk2'],
        metadata: [
          { docId: 'test', orgId: 'org1', chunkIndex: 0 },
          { docId: 'test', orgId: 'org1', chunkIndex: 1 }
        ]
      };

      (DocumentProcessor.prototype.processDocument as any).mockResolvedValue(mockProcessed);
      (VectorStoreManager.prototype.addDocuments as any).mockResolvedValue(undefined);

      const result = await processor.processDocument('test text', {
        docId: 'test',
        orgId: 'org1'
      });

      expect(result).toEqual(mockProcessed);
      expect(DocumentProcessor.prototype.processDocument).toHaveBeenCalledWith(
        'test text',
        { docId: 'test', orgId: 'org1' }
      );
      expect(VectorStoreManager.prototype.addDocuments).toHaveBeenCalledWith(mockProcessed);
    });
  });

  describe('generateResponse', () => {
    it('generates responses with correct format', async () => {
      const response = await processor.generateResponse(
        'test question',
        'org1',
        ['previous message']
      );

      expect(response).toEqual({
        response: 'Test response',
        confidence: 85,
        sources: [{
          docId: 'test-doc',
          chunk: 'Test content',
          relevance: 0.95
        }],
        debugInfo: expect.objectContaining({
          processingTimeMs: expect.any(Number),
          chunks: expect.any(Array)
        })
      });
    });

    it('handles errors gracefully', async () => {
      (ConversationalRetrievalQAChain.fromLLM as any).mockReturnValue({
        call: vi.fn().mockRejectedValue(new Error('Test error'))
      });

      await expect(processor.generateResponse('test', 'org1'))
        .rejects
        .toThrow('Test error');
    });

    it('handles malformed LLM responses', async () => {
      (ConversationalRetrievalQAChain.fromLLM as any).mockReturnValue({
        call: vi.fn().mockResolvedValue({
          text: 'invalid json',
          sourceDocuments: []
        })
      });

      const response = await processor.generateResponse('test', 'org1');
      
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
  });
}); 