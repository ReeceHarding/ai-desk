import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { createClient } from '@supabase/supabase-js';
import { Document } from "langchain/document";
import { logger } from "../logger";
import { initClients } from "./config";
import type { ProcessedDocument } from "./types";

export class VectorStoreManager {
  private store: PineconeStore | null = null;
  private embeddings: OpenAIEmbeddings;
  private supabase;

  constructor() {
    this.embeddings = new OpenAIEmbeddings();

    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async initialize() {
    if (this.store) return;

    try {
      const { pinecone } = initClients();
      const index = pinecone.Index(process.env.PINECONE_INDEX!);

      this.store = await PineconeStore.fromExistingIndex(
        this.embeddings,
        { pineconeIndex: index }
      );

      logger.info('VectorStore initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize VectorStore', { error });
      throw error;
    }
  }

  async addDocuments(processed: ProcessedDocument) {
    if (!this.store) {
      throw new Error('VectorStore not initialized');
    }

    try {
      const documents = processed.chunks.map((chunk, i) => 
        new Document({
          pageContent: chunk,
          metadata: processed.metadata[i]
        })
      );

      await this.store.addDocuments(documents);
      logger.info('Documents added to vector store', { 
        count: documents.length,
        docId: processed.metadata[0].docId 
      });
    } catch (error) {
      logger.error('Failed to add documents to vector store', { error });
      throw error;
    }
  }

  getRetriever() {
    if (!this.store) {
      throw new Error('VectorStore not initialized');
    }
    return this.store.asRetriever();
  }

  async similaritySearch(query: string, orgId: string, k = 4) {
    if (!this.store) {
      throw new Error('VectorStore not initialized');
    }

    try {
      const results = await this.store.similaritySearch(query, k, { 
        filter: { orgId },
        includeScore: true
      });

      logger.info('Similarity search completed', {
        query,
        resultCount: results.length,
        orgId
      });

      return results;
    } catch (error) {
      logger.error('Failed to perform similarity search', { error, query });
      throw error;
    }
  }
} 