import { v4 as uuidv4 } from 'uuid';
import { classifyInboundEmail, generateRagResponse } from '../utils/ai-responder';
import { logger } from '../utils/logger';

async function testLangSmithIntegration() {
  try {
    logger.info('Starting LangSmith integration test for ai-zendesk project');

    // Test email classification
    const testEmail = `
Subject: Help with account access
Hi support team,

I'm having trouble logging into my account. I've tried resetting my password but I'm still getting an error message.
Can you please help me regain access?

Thanks,
Test User
    `;

    logger.info('Testing email classification...');
    const classification = await classifyInboundEmail(testEmail);
    logger.info('Classification result:', { classification });

    // Test RAG response generation
    logger.info('Testing RAG response generation...');
    const response = await generateRagResponse(
      testEmail,
      uuidv4(), // Test org ID
      3, // topK
      true // debug mode
    );
    logger.info('RAG response:', { response });

    logger.info('LangSmith integration test completed successfully');
  } catch (error: any) {
    logger.error('Error in LangSmith integration test:', { error: error.message || error });
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testLangSmithIntegration();
} 