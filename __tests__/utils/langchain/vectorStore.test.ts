import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initClients } from '../../../utils/langchain/config';
import { VectorStoreManager } from '../../../utils/langchain/vectorStore';

// Mock dependencies
vi.mock('@langchain/pinecone');
vi.mock('@langchain/openai');
vi.mock('../../../utils/langchain/config');

describe('VectorStoreManager', () => {
  let manager: VectorStoreManager;
  const mockStore = {
    addDocuments: vi.fn(),
    similaritySearch: vi.fn(),
    asRetriever: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock PineconeStore.fromExistingIndex
    (PineconeStore.fromExistingIndex as any).mockResolvedValue(mockStore);
    
    // Mock initClients
    (initClients as any).mockReturnValue({
      pinecone: {
        Index: vi.fn().mockReturnValue('mock-index')
      }
    });

    manager = new VectorStoreManager();
  });

  describe('initialize', () => {
    it('initializes successfully', async () => {
      await manager.initialize();
      
      expect(PineconeStore.fromExistingIndex).toHaveBeenCalledWith(
        expect.any(OpenAIEmbeddings),
        { pineconeIndex: 'mock-index' }
      );
    });

    it('only initializes once', async () => {
      await manager.initialize();
      await manager.initialize();
      
      expect(PineconeStore.fromExistingIndex).toHaveBeenCalledTimes(1);
    });

    it('handles initialization errors', async () => {
      const error = new Error('Init failed');
      (PineconeStore.fromExistingIndex as any).mockRejectedValueOnce(error);
      
      await expect(manager.initialize()).rejects.toThrow('Init failed');
    });
  });

  describe('addDocuments', () => {
    const mockProcessed = {
      chunks: ['chunk1', 'chunk2'],
      metadata: [
        { docId: 'doc1', orgId: 'org1', chunkIndex: 0 },
        { docId: 'doc1', orgId: 'org1', chunkIndex: 1 }
      ]
    };

    beforeEach(async () => {
      await manager.initialize();
    });

    it('adds documents successfully', async () => {
      await manager.addDocuments(mockProcessed);
      
      expect(mockStore.addDocuments).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            pageContent: 'chunk1',
            metadata: mockProcessed.metadata[0]
          }),
          expect.objectContaining({
            pageContent: 'chunk2',
            metadata: mockProcessed.metadata[1]
          })
        ])
      );
    });

    it('throws if not initialized', async () => {
      manager = new VectorStoreManager();
      await expect(manager.addDocuments(mockProcessed))
        .rejects
        .toThrow('VectorStore not initialized');
    });

    it('handles add errors', async () => {
      mockStore.addDocuments.mockRejectedValueOnce(new Error('Add failed'));
      await expect(manager.addDocuments(mockProcessed))
        .rejects
        .toThrow('Add failed');
    });
  });

  describe('similaritySearch', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('performs search successfully', async () => {
      const mockResults = [
        { pageContent: 'result1', metadata: { score: 0.9 } },
        { pageContent: 'result2', metadata: { score: 0.8 } }
      ];
      mockStore.similaritySearch.mockResolvedValueOnce(mockResults);

      const results = await manager.similaritySearch('test query', 'org1');
      
      expect(mockStore.similaritySearch).toHaveBeenCalledWith(
        'test query',
        4,
        { filter: { orgId: 'org1' }, includeScore: true }
      );
      expect(results).toEqual(mockResults);
    });

    it('throws if not initialized', async () => {
      manager = new VectorStoreManager();
      await expect(manager.similaritySearch('query', 'org1'))
        .rejects
        .toThrow('VectorStore not initialized');
    });

    it('handles search errors', async () => {
      mockStore.similaritySearch.mockRejectedValueOnce(new Error('Search failed'));
      await expect(manager.similaritySearch('query', 'org1'))
        .rejects
        .toThrow('Search failed');
    });
  });

  describe('getRetriever', () => {
    it('returns retriever when initialized', async () => {
      const mockRetriever = { type: 'retriever' };
      mockStore.asRetriever.mockReturnValueOnce(mockRetriever);
      
      await manager.initialize();
      const retriever = manager.getRetriever();
      
      expect(retriever).toBe(mockRetriever);
    });

    it('throws if not initialized', () => {
      expect(() => manager.getRetriever())
        .toThrow('VectorStore not initialized');
    });
  });
}); 