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
          questionGeneratorTemplate: `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question. Keep the question focused and concise.

Chat History:
{chat_history}
Follow Up Input: {question}
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
   - reasoning: brief explanation of your confidence score`
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
    const processed = await this.docProcessor.processDocument(text, metadata);
    await this.vectorStore.addDocuments(processed);
    return processed;
  }

  async generateResponse(
    query: string,
    orgId: string,
    chatHistory: string[] = []
  ): Promise<RAGResponse> {
    await this.ensureInitialized();

    try {
      const result = await this.chain.call({
        question: query,
        chat_history: chatHistory
      });

      try {
        const parsed = JSON.parse(result.text);
        return {
          response: parsed.answer,
          confidence: parsed.confidence,
          sources: result.sourceDocuments.map((doc: Document) => ({
            docId: doc.metadata.docId,
            chunk: doc.pageContent,
            relevance: doc.metadata.score || 0
          }))
        };
      } catch (e) {
        logger.error('Failed to parse LLM response', { error: e, response: result.text });
        return {
          response: "Error processing response",
          confidence: 0,
          sources: []
        };
      }
    } catch (error) {
      logger.error('Failed to generate response', { error, query });
      throw error;
    }
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }
} 