import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { logger } from "../logger";
import type { ProcessedDocument } from "./types";

export class DocumentProcessor {
  private splitter: RecursiveCharacterTextSplitter;

  constructor() {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", ".", "!", "?", ",", " ", ""],
      lengthFunction: (text) => text.length,
    });
  }

  async processDocument(
    text: string,
    metadata: { docId: string; orgId: string }
  ): Promise<ProcessedDocument> {
    try {
      logger.info('Processing document', { 
        docId: metadata.docId,
        textLength: text.length 
      });

      const docs = await this.splitter.createDocuments([text], [metadata]);
      
      logger.info('Document split into chunks', {
        docId: metadata.docId,
        chunkCount: docs.length
      });

      return {
        chunks: docs.map(doc => doc.pageContent),
        metadata: docs.map((_, index) => ({
          ...metadata,
          chunkIndex: index
        }))
      };
    } catch (error) {
      logger.error('Error processing document', {
        error,
        docId: metadata.docId
      });
      throw error;
    }
  }

  /**
   * Estimate token count for a text string
   * This is a simple approximation - for more accurate counts, use tiktoken
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.split(/\s+/).length * 1.3);
  }
} 