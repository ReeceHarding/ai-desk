import { ChatOpenAI } from "@langchain/openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { Client } from "langsmith";
import { logger } from "../logger";

// Initialize LangSmith tracing
if (process.env.LANGCHAIN_TRACING_V2 === 'true') {
  logger.info('Initializing LangSmith tracing');
  const client = new Client({
    apiUrl: process.env.LANGCHAIN_ENDPOINT,
    apiKey: process.env.LANGCHAIN_API_KEY,
  });

  // Set up project tags and metadata
  const projectName = process.env.LANGCHAIN_PROJECT || 'zendesk-clone';
  client.createProject({ 
    projectName,
    metadata: {
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '0.0.0'
    }
  }).catch(error => {
    // Project might already exist, which is fine
    logger.warn('Error creating LangSmith project', { error });
  });
}

// Check if we're on the server side
const isServer = typeof window === 'undefined';

if (!isServer) {
  logger.warn('LangChain utilities should only be used on the server side');
}

export const openAIConfig = {
  modelName: "gpt-4-turbo-preview",
  temperature: 0.2,
  maxTokens: 500
};

export const pineconeConfig = {
  apiKey: process.env.PINECONE_API_KEY!,
  indexName: process.env.PINECONE_INDEX!
};

export function initClients() {
  if (!isServer) {
    throw new Error('LangChain clients can only be initialized on the server side');
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY is required');
  }

  // Initialize OpenAI model with enhanced tracing tags
  const model = new ChatOpenAI({
    modelName: openAIConfig.modelName,
    temperature: openAIConfig.temperature,
    maxTokens: openAIConfig.maxTokens,
    tags: ['gpt4-turbo', 'production', 'support-agent'],
    metadata: {
      useCase: 'support-agent',
      component: 'rag-qa',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '0.0.0'
    }
  });

  // Initialize Pinecone
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!
  });

  return { pinecone, model };
} 