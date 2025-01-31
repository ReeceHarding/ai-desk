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
  debugInfo?: RagDebugInfo;
}

export interface RagDebugInfo {
  chunks?: Array<{
    docId: string;
    text: string;
    similarity: number;
  }>;
  prompt?: {
    system: string;
    user: string;
    temperature: number;
    maxTokens: number;
  };
  modelResponse?: string;
  processingTimeMs?: number;
  factCheck?: {
    isFactual: boolean;
    corrections: Array<{
      original: string;
      correction: string;
      type?: string;
    }>;
    confidence: number;
  };
}

export interface ConfidenceScore {
  overall: number;
  relevance: number;
  factualAccuracy: number;
  completeness: number;
} 