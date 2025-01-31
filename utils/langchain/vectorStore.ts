import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { createClient } from '@supabase/supabase-js';
import { Document } from "langchain/document";
import { logger } from "../logger";
import { initClients } from "./config";
import type { ProcessedDocument } from "./types";

export class VectorStoreManager {
  private store!: PineconeStore;
  private embeddings: OpenAIEmbeddings;
  private supabase;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async initialize() {
    try {
      const { pinecone } = initClients();
      const index = pinecone.index(process.env.PINECONE_INDEX!);

      this.store = await PineconeStore.fromExistingIndex(
        this.embeddings,
        { pineconeIndex: index }
      );

      logger.info('VectorStoreManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize VectorStoreManager', { error });
      throw error;
    }
  }

  async addDocuments(processed: ProcessedDocument) {
    try {
      const documents = processed.chunks.map((chunk, i) => 
        new Document({
          pageContent: chunk,
          metadata: processed.metadata[i]
        })
      );

      // First, add to Pinecone
      await this.store.addDocuments(documents);
      
      // Then, create the parent document
      const { data: doc, error: docError } = await this.supabase
        .from('knowledge_docs')
        .insert({
          id: processed.metadata[0].docId,
          org_id: processed.metadata[0].orgId,
          title: 'Processed Document', // You might want to pass this in metadata
          metadata: {
            source: 'langchain_processor',
            created_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (docError) {
        throw docError;
      }

      // Then, add chunks to our database
      const chunks = await Promise.all(
        documents.map(async (doc, index) => ({
          doc_id: doc.metadata.docId,
          content: doc.pageContent,
          chunk_index: index,
          metadata: doc.metadata,
          embedding: await this.embeddings.embedQuery(doc.pageContent),
          confidence_score: 1.0, // Default high confidence for exact matches
          token_length: Math.ceil(doc.pageContent.split(/\s+/).length * 1.3) // Rough token estimate
        }))
      );

      const { error: chunksError } = await this.supabase
        .from('knowledge_doc_chunks')
        .insert(chunks);

      if (chunksError) {
        throw chunksError;
      }

      logger.info('Documents added to vector store and database', {
        chunkCount: documents.length,
        docId: processed.metadata[0].docId
      });
    } catch (error) {
      logger.error('Failed to add documents to vector store', {
        error,
        docId: processed.metadata[0].docId
      });
      throw error;
    }
  }

  async similaritySearch(query: string, orgId: string, k = 4) {
    try {
      // Get results from Pinecone
      const results = await this.store.similaritySearch(query, k, { 
        filter: { orgId } 
      });

      // Update confidence scores in our database
      const docIds = results.map(doc => doc.metadata.docId);
      
      // First, get current metadata
      const { data: currentChunks, error: fetchError } = await this.supabase
        .from('knowledge_doc_chunks')
        .select('doc_id, metadata')
        .in('doc_id', docIds);

      if (fetchError) {
        logger.warn('Failed to fetch current metadata', { error: fetchError });
      } else {
        // Update each chunk with new metadata
        const updates = currentChunks?.map(chunk => ({
          doc_id: chunk.doc_id,
          metadata: {
            ...chunk.metadata,
            last_retrieved: new Date().toISOString()
          },
          confidence_score: 0.8 // High confidence for retrieved results
        }));

        if (updates?.length) {
          const { error: updateError } = await this.supabase
            .from('knowledge_doc_chunks')
            .upsert(updates);

          if (updateError) {
            logger.warn('Failed to update confidence scores', { error: updateError });
          }
        }
      }

      logger.info('Similarity search completed', {
        query,
        resultCount: results.length,
        orgId
      });

      return results;
    } catch (error) {
      logger.error('Failed to perform similarity search', {
        error,
        query,
        orgId
      });
      throw error;
    }
  }

  getRetriever() {
    return this.store.asRetriever();
  }
} 