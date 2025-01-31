import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { LangChainProcessor } from '../utils/langchain';
import { logger } from '../utils/logger';

async function testLangChainIntegration() {
  try {
    logger.info('Starting LangChain integration test');

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Create test organization with unique name
    const orgId = uuidv4();
    const testOrgName = `Test Organization ${Date.now()}`;
    const { error: orgError } = await supabase
      .from('organizations')
      .insert({
        id: orgId,
        name: testOrgName,
        sla_tier: 'basic',
        config: {
          is_test: true,
          created_at: new Date().toISOString()
        }
      });

    if (orgError) {
      throw orgError;
    }

    logger.info('Created test organization', { orgId, name: testOrgName });
    
    // Initialize processor
    const processor = new LangChainProcessor();
    logger.info('Created LangChainProcessor instance');

    await processor.initialize();
    logger.info('LangChain processor initialized successfully');

    // Test document processing
    const testDoc = {
      text: 'This is a test document about customer support. We help customers with their issues and provide excellent service.',
      metadata: {
        docId: uuidv4(),
        orgId
      }
    };

    logger.info('Processing test document', { docId: testDoc.metadata.docId });
    const processed = await processor.processDocument(testDoc.text, testDoc.metadata);
    logger.info('Document processed successfully', {
      chunks: processed.chunks.length,
      docId: testDoc.metadata.docId
    });

    // Test RAG query
    const testQuery = 'What is this document about?';
    logger.info('Testing RAG query', { 
      query: testQuery,
      orgId: testDoc.metadata.orgId 
    });
    
    const response = await processor.generateResponse(
      testQuery,
      testDoc.metadata.orgId
    );

    logger.info('Successfully generated response', {
      response: response.response,
      confidence: response.confidence,
      sourceCount: response.sources.length
    });

    // Cleanup test organization
    const { error: cleanupError } = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId);

    if (cleanupError) {
      logger.warn('Failed to cleanup test organization', { error: cleanupError });
    } else {
      logger.info('Cleaned up test organization', { orgId });
    }

    return true;
  } catch (error) {
    logger.error('LangChain integration test failed', { 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error 
    });
    throw error;
  }
}

// Run the test
testLangChainIntegration()
  .then(() => {
    logger.info('LangChain integration test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('LangChain integration test failed', { 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error 
    });
    process.exit(1);
  }); 