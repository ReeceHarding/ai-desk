# Phase 1: LangChain Core Integration

## Overview
This phase focuses on integrating LangChain's core functionality into our existing RAG system, replacing our current confidence scoring mechanism, and enhancing our document processing pipeline.

## Prerequisites
1. Install new dependencies:
```bash
npm install langchain @langchain/openai @langchain/pinecone
```

2. Environment variables needed:
```env
OPENAI_API_KEY=your_key
PINECONE_API_KEY=your_key
PINECONE_ENVIRONMENT=your_env
PINECONE_INDEX=your_index
```

## Implementation Steps

### 1. LangChain Base Setup
Create new directory structure:
```
utils/
  └── langchain/
      ├── index.ts
      ├── config.ts
      ├── documentProcessor.ts
      ├── vectorStore.ts
      └── types.ts
```

#### 1.1 Base Configuration (config.ts)
```typescript
import { OpenAI } from "@langchain/openai";
import { Pinecone } from "@pinecone-database/pinecone";

export const openAIConfig = {
  modelName: "gpt-3.5-turbo",
  temperature: 0.2,
  maxTokens: 500
};

export const pineconeConfig = {
  environment: process.env.PINECONE_ENVIRONMENT!,
  apiKey: process.env.PINECONE_API_KEY!,
  indexName: process.env.PINECONE_INDEX!
};

export const initClients = () => {
  const model = new OpenAI(openAIConfig);
  const pinecone = new Pinecone({
    apiKey: pineconeConfig.apiKey,
    environment: pineconeConfig.environment
  });
  
  return { model, pinecone };
};
```

#### 1.2 Types (types.ts)
```typescript
export interface ProcessedDocument {
  chunks: string[];
  metadata: {
    docId: string;
    orgId: string;
    chunkIndex: number;
  }[];
}

export interface RAGResponse {
  response: string;
  confidence: number;
  sources: {
    docId: string;
    chunk: string;
    relevance: number;
  }[];
}

export interface ConfidenceScore {
  overall: number;
  relevance: number;
  factualAccuracy: number;
  completeness: number;
}
```

### 2. Document Processing Enhancement

#### 2.1 Document Processor (documentProcessor.ts)
```typescript
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";
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
    const docs = await this.splitter.createDocuments([text], [metadata]);
    
    return {
      chunks: docs.map(doc => doc.pageContent),
      metadata: docs.map((_, index) => ({
        ...metadata,
        chunkIndex: index
      }))
    };
  }
}
```

### 3. Vector Store Integration

#### 3.1 Vector Store Manager (vectorStore.ts)
```typescript
import { PineconeStore } from "@langchain/pinecone";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { initClients } from "./config";
import type { ProcessedDocument } from "./types";

export class VectorStoreManager {
  private store: PineconeStore;
  private embeddings: OpenAIEmbeddings;

  constructor() {
    const { pinecone } = initClients();
    this.embeddings = new OpenAIEmbeddings();
    this.store = await PineconeStore.fromExistingIndex(
      this.embeddings,
      { pineconeIndex: pinecone.Index(pineconeConfig.indexName) }
    );
  }

  async addDocuments(processed: ProcessedDocument) {
    const documents = processed.chunks.map((chunk, i) => 
      new Document({
        pageContent: chunk,
        metadata: processed.metadata[i]
      })
    );

    await this.store.addDocuments(documents);
  }

  async similaritySearch(query: string, orgId: string, k = 4) {
    return this.store.similaritySearch(query, k, { orgId });
  }
}
```

### 4. Main Integration Layer

#### 4.1 Core Integration (index.ts)
```typescript
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { initClients } from "./config";
import { DocumentProcessor } from "./documentProcessor";
import { VectorStoreManager } from "./vectorStore";
import type { RAGResponse, ConfidenceScore } from "./types";

export class LangChainProcessor {
  private model;
  private vectorStore: VectorStoreManager;
  private docProcessor: DocumentProcessor;
  private chain: ConversationalRetrievalQAChain;

  constructor() {
    const { model } = initClients();
    this.model = model;
    this.vectorStore = new VectorStoreManager();
    this.docProcessor = new DocumentProcessor();
    
    this.chain = ConversationalRetrievalQAChain.fromLLM(
      this.model,
      this.vectorStore.store.asRetriever(),
      {
        returnSourceDocuments: true,
        questionGeneratorTemplate: `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question. Keep the question focused and concise.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`,
        qaTemplate: `You are a helpful support agent. Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say "I don't have enough information to answer that." Don't try to make up an answer.

{context}

Question: {question}

Answer in a helpful and professional tone. Include relevant specific details from the context.
Also rate your confidence in the answer on a scale of 0-100 where:
0-30: not enough relevant info
31-70: partial match or uncertain
71-100: high confidence answer

Return your response in JSON format:
{
  "answer": "your response",
  "confidence": number,
  "reasoning": "brief explanation of your confidence score"
}`
      }
    );
  }

  async processDocument(text: string, metadata: { docId: string; orgId: string }) {
    const processed = await this.docProcessor.processDocument(text, metadata);
    await this.vectorStore.addDocuments(processed);
    return processed;
  }

  async generateResponse(
    query: string,
    orgId: string,
    chatHistory: string[] = []
  ): Promise<RAGResponse> {
    const result = await this.chain.call({
      question: query,
      chat_history: chatHistory
    });

    try {
      const parsed = JSON.parse(result.text);
      return {
        response: parsed.answer,
        confidence: parsed.confidence,
        sources: result.sourceDocuments.map(doc => ({
          docId: doc.metadata.docId,
          chunk: doc.pageContent,
          relevance: doc.metadata.score || 0
        }))
      };
    } catch (e) {
      return {
        response: "Error processing response",
        confidence: 0,
        sources: []
      };
    }
  }
}
```

### 5. Integration with Existing Code

1. Update `pages/api/kb/upload.ts`:
```typescript
import { LangChainProcessor } from '@/utils/langchain';

// In your handler:
const processor = new LangChainProcessor();
await processor.processDocument(textContent, {
  docId: doc.id,
  orgId: orgId
});
```

2. Update `utils/ai-responder.ts`:
```typescript
import { LangChainProcessor } from '@/utils/langchain';

export async function generateRagResponse(
  emailText: string,
  orgId: string,
  topK: number = 5,
  debug: boolean = false,
  senderInfo?: { 
    fromName?: string;
    agentName?: string;
  }
): Promise<RagResponse> {
  const processor = new LangChainProcessor();
  const result = await processor.generateResponse(emailText, orgId);
  
  return {
    response: result.response,
    confidence: result.confidence,
    references: result.sources.map(s => s.docId),
    debugInfo: debug ? {
      chunks: result.sources.map(s => ({
        docId: s.docId,
        text: s.chunk,
        similarity: s.relevance
      })),
      processingTimeMs: Date.now() - startTime
    } : undefined
  };
}
```

### 6. Testing

Create new test files:

#### 6.1 Document Processing Tests
```typescript
// __tests__/utils/langchain/documentProcessor.test.ts
import { DocumentProcessor } from '@/utils/langchain/documentProcessor';

describe('DocumentProcessor', () => {
  const processor = new DocumentProcessor();

  it('splits documents with appropriate chunk size', async () => {
    const text = 'A '.repeat(2000);
    const result = await processor.processDocument(text, {
      docId: 'test',
      orgId: 'test'
    });
    
    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.chunks[0].length).toBeLessThanOrEqual(1000);
  });
});
```

#### 6.2 Vector Store Tests
```typescript
// __tests__/utils/langchain/vectorStore.test.ts
import { VectorStoreManager } from '@/utils/langchain/vectorStore';

describe('VectorStoreManager', () => {
  const manager = new VectorStoreManager();

  it('successfully adds and retrieves documents', async () => {
    const processed = {
      chunks: ['test chunk 1', 'test chunk 2'],
      metadata: [
        { docId: 'test1', orgId: 'org1', chunkIndex: 0 },
        { docId: 'test1', orgId: 'org1', chunkIndex: 1 }
      ]
    };

    await manager.addDocuments(processed);
    const results = await manager.similaritySearch('test', 'org1', 1);
    expect(results.length).toBe(1);
  });
});
```

### 7. Migration Steps

1. Deploy new dependencies:
```bash
npm install
```

2. Run database migrations (no changes needed, using existing tables)

3. Test the new implementation:
```bash
npm run test
```

4. Deploy changes:
   - Deploy code changes
   - Update environment variables
   - Monitor logs for any issues

### 8. Rollback Plan

If issues are encountered:
1. Revert code changes using git
2. The database schema remains unchanged, so no rollback needed
3. Remove new dependencies if necessary

## Next Steps
After successful implementation of Phase 1:
1. Monitor performance and error rates
2. Gather metrics on confidence scoring accuracy
3. Prepare for Phase 2: Memory & Context implementation

## Success Criteria
- [ ] All tests passing
- [ ] Document processing working with new chunking
- [ ] RAG responses include confidence scores
- [ ] Response quality maintained or improved
- [ ] Processing time within acceptable limits (< 2s) 