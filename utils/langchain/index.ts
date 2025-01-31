import { ConversationalRetrievalQAChain } from "langchain/chains";
import { Document } from "langchain/document";
import { logger } from "../logger";
import { initClients } from "./config";
import { DocumentProcessor } from "./documentProcessor";
import type { RAGResponse } from "./types";
import { VectorStoreManager } from "./vectorStore";

export class LangChainProcessor {
  private model;
  private vectorStore: VectorStoreManager;
  private docProcessor: DocumentProcessor;
  private chain!: ConversationalRetrievalQAChain;
  private initialized: boolean = false;

  constructor() {
    const { model } = initClients();
    this.model = model;
    this.vectorStore = new VectorStoreManager();
    this.docProcessor = new DocumentProcessor();
  }

  async initialize() {
    if (this.initialized) return;

    try {
      await this.vectorStore.initialize();
      
      this.chain = ConversationalRetrievalQAChain.fromLLM(
        this.model,
        this.vectorStore.getRetriever(),
        {
          returnSourceDocuments: true,
          questionGeneratorTemplate: `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question that captures the full context. Keep the question focused and concise.

Previous conversation:
{chat_history}

Follow up question: {question}

Standalone question:`,
          qaTemplate: `You are a helpful support agent. Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say "I don't have enough information to answer that." Don't try to make up an answer.

Context: {context}

Question: {question}

Instructions:
1. Answer in a helpful and professional tone
2. Include relevant specific details from the context
3. Rate your confidence on a scale of 0-100:
   - 0-30: not enough relevant info
   - 31-70: partial match or uncertain
   - 71-100: high confidence answer
4. Format your response as valid JSON with these fields:
   - answer: your detailed response
   - confidence: your confidence score (0-100)
   - reasoning: brief explanation of your confidence score`,
          metadata: {
            description: "Conversational RAG chain for support agent responses",
            tags: ["support", "rag", "qa"]
          }
        }
      );

      this.initialized = true;
      logger.info('LangChainProcessor initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize LangChainProcessor', { error });
      throw error;
    }
  }

  async processDocument(text: string, metadata: { docId: string; orgId: string }) {
    await this.ensureInitialized();
    
    try {
      const processed = await this.docProcessor.processDocument(text, metadata);
      await this.vectorStore.addDocuments(processed);
      
      logger.info('Document processed and added to vector store', {
        docId: metadata.docId,
        chunkCount: processed.chunks.length
      });
      
      return processed;
    } catch (error) {
      logger.error('Failed to process document', { error, docId: metadata.docId });
      throw error;
    }
  }

  async generateResponse(
    query: string,
    orgId: string,
    chatHistory: string[] = []
  ): Promise<RAGResponse> {
    await this.ensureInitialized();

    const startTime = Date.now();
    
    try {
      // Format chat history for the chain
      const formattedHistory = this.formatChatHistory(chatHistory);
      
      logger.info('Generating RAG response', {
        orgId,
        queryLength: query.length,
        historyLength: chatHistory.length
      });

      const result = await this.chain.call({
        question: query,
        chat_history: formattedHistory,
        metadata: {
          orgId,
          queryType: "support_request",
          tags: ["support", "rag"]
        }
      });

      try {
        const parsed = JSON.parse(result.text);
        const response: RAGResponse = {
          response: parsed.answer,
          confidence: parsed.confidence,
          sources: result.sourceDocuments.map((doc: Document) => ({
            docId: doc.metadata.docId,
            chunk: doc.pageContent,
            relevance: doc.metadata.score || 0
          })),
          debugInfo: {
            processingTimeMs: Date.now() - startTime,
            chunks: result.sourceDocuments.map((doc: Document) => ({
              docId: doc.metadata.docId,
              text: doc.pageContent,
              similarity: doc.metadata.score || 0
            }))
          }
        };

        logger.info('Generated RAG response', {
          confidence: response.confidence,
          sourceCount: response.sources.length,
          processingTimeMs: response.debugInfo?.processingTimeMs
        });

        return response;
      } catch (e) {
        logger.error('Failed to parse LLM response', { 
          error: e, 
          response: result.text,
          processingTimeMs: Date.now() - startTime
        });
        
        return {
          response: "Error processing response",
          confidence: 0,
          sources: [],
          debugInfo: {
            processingTimeMs: Date.now() - startTime,
            modelResponse: result.text
          }
        };
      }
    } catch (error) {
      logger.error('Failed to generate response', { 
        error, 
        query,
        processingTimeMs: Date.now() - startTime
      });
      throw error;
    }
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private formatChatHistory(history: string[]): string {
    if (!history.length) return '';
    
    return history.map((msg, i) => 
      `${i % 2 === 0 ? 'Human' : 'Assistant'}: ${msg}`
    ).join('\n');
  }
} 