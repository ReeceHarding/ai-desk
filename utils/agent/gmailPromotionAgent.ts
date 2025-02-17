import { Database } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';
import { Client } from "langsmith";
import { traceable } from "langsmith/traceable";
import OpenAI from 'openai';
import { getGmailClient } from '../gmail';
import { logger } from '../logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize LangSmith client
let langsmith: Client | null = null;
if (process.env.LANGCHAIN_TRACING_V2 === 'true') {
  try {
    langsmith = new Client({
      apiUrl: process.env.LANGCHAIN_ENDPOINT,
      apiKey: process.env.LANGCHAIN_API_KEY,
    });
    logger.info('LangSmith client initialized successfully', {
      project: process.env.LANGCHAIN_PROJECT,
      endpoint: process.env.LANGCHAIN_ENDPOINT
    });
  } catch (error) {
    logger.error('Failed to initialize LangSmith client', { error });
  }
}

// Wrap the classification function with tracing
const classifyEmailAsPromotionalWithTrace = traceable(
  async (
    emailText: string,
    fromAddress: string = '',
    subject: string = '',
    messageId: string = ''
  ): Promise<{isPromotional: boolean; reason: string} | null> => {
    try {
      // Log classification start with minimal info
      logger.info('Classifying email', {
        from: fromAddress,
        subject,
        preview: emailText.substring(0, 100)
      });

      const systemPrompt = `You are an expert email classifier for a helpdesk system. Your task is to determine if an incoming email is promotional/marketing/automated or requires a human response. You must analyze each email with sophisticated criteria while maintaining strict output format compliance.

DETAILED CLASSIFICATION RULES:

1. Mark as PROMOTIONAL (isPromotional: true) if the email:
   - Contains any marketing language or promotional offers
   - Is from a no-reply email address
   - Contains words like "newsletter", "update", "announcement", "offer", "discount"
   - Is an automated system notification (e.g., password changes, login alerts)
   - Contains tracking numbers or order confirmations
   - Is a social media notification or alert
   - Is a mass-sent newsletter or company update
   - Contains promotional imagery or multiple marketing links
   - Is an automated calendar invite or reminder
   - Contains phrases like "Don't miss out", "Limited time", "Special offer"
   - Is an automated receipt or transaction confirmation
   - Contains unsubscribe links or marketing footers
   - Is from known marketing domains or bulk email services
   - Uses HTML-heavy formatting typical of marketing emails

2. Mark as NEEDS_RESPONSE (isPromotional: false) if the email:
   - Contains direct questions requiring human judgment
   - Includes specific technical issues or bug reports
   - Contains personal or unique inquiries
   - References previous conversations or tickets
   - Includes screenshots or specific problem descriptions
   - Contains urgent support requests or time-sensitive issues
   - Includes phrases like "Please help", "I need assistance", "Can someone explain"
   - Contains detailed customer feedback requiring analysis
   - Includes business proposals or partnership inquiries
   - Contains specific account or service questions
   - Includes personal contact information for follow-up
   - References specific transactions or interactions
   - Contains unique situations not covered by FAQs
   - Shows signs of human authorship (typos, conversational tone)

ANALYSIS STEPS:
1. Check sender address and format
2. Scan for automated/marketing indicators
3. Look for personal/human elements
4. Evaluate content complexity
5. Check for direct questions or requests
6. Analyze tone and urgency
7. Look for unique/specific details

OUTPUT FORMAT:
You must respond in this exact JSON format with only these two fields:
{
    "isPromotional": boolean,
    "reason": "Brief explanation of classification decision"
}

EXAMPLES:

Input: "Dear Support, I can't log into my account and I've tried resetting my password three times. Can someone please help?"
{
    "isPromotional": false,
    "reason": "Contains specific technical issue and direct request for assistance"
}

Input: "🎉 Don't miss out! 50% off all products this weekend only! Click here to shop now!"
{
    "isPromotional": true,
    "reason": "Marketing email with promotional offers and sale announcement"
}`;

      const userPrompt = `Please classify this email:
From: ${fromAddress}
Subject: ${subject}
Content: ${emailText}`;

      // Log the complete input being sent to GPT
      logger.info('\n=== GPT Classification Input ===', {
        timestamp: new Date().toISOString(),
        systemPrompt,
        userPrompt,
        emailDetails: {
          fromAddress,
          subject,
          contentLength: emailText.length,
          contentPreview: emailText.substring(0, 200) + (emailText.length > 200 ? '...' : '')
        }
      });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 150,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        logger.error('GPT classification failed', {
          error: 'No response from GPT'
        });
        throw new Error('No response from GPT');
      }

      const classification = JSON.parse(response);
      
      // Log the final classification concisely
      logger.info('Classification result', {
        id: messageId || 'unknown',
        isPromotional: classification.isPromotional,
        reason: classification.reason
      });

      return {
        isPromotional: classification.isPromotional,
        reason: classification.reason
      };
    } catch (error) {
      logger.error('Classification error', {
        error: error instanceof Error ? error.message : String(error),
        id: messageId || 'unknown'
      });
      return null;
    }
  },
  {
    name: "classify_email_promotional",
    tags: ["production", "gmail", "classification"],
    metadata: {
      useCase: "email-classification",
      component: "promotion-agent",
      environment: process.env.NODE_ENV || 'development'
    }
  }
);

// Export the traced version
const classifyEmailAsPromotional = classifyEmailAsPromotionalWithTrace;

async function getThreadMessages(threadId: string, orgId: string): Promise<{
  messages: {
    id: string;
    body: string;
    from: string;
    subject: string;
  }[];
  error?: string;
}> {
  try {
    // Get Gmail client using organization ID
    const gmail = await getGmailClient(orgId);

    const thread = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full'
    });

    if (!thread.data.messages) {
      return { messages: [], error: 'No messages found in thread' };
    }

    const messages = thread.data.messages.map(message => {
      const headers = message.payload?.headers || [];
      const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
      const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '';
      const body = message.snippet || '';

      return {
        id: message.id || '',
        body,
        from,
        subject
      };
    });

    return { messages };
  } catch (error: any) {
    logger.error('Error fetching thread messages:', { error: error.message, threadId, orgId });
    return { messages: [], error: error.message };
  }
}

export async function processPotentialPromotionalEmail(
  ticketEmailChatId: string,
  orgId: string,
  emailBody: string,
  messageId: string,
  threadId: string,
  fromAddress: string = '',
  subject: string = ''
): Promise<void> {
  try {
    if (!ticketEmailChatId) {
      logger.error('Missing chat ID', { messageId });
      return;
    }

    // First verify the record exists
    const { data: chatRecord, error: chatError } = await supabase
      .from('ticket_email_chats')
      .select('id, metadata, thread_id')
      .eq('id', ticketEmailChatId)
      .single();

    if (chatError || !chatRecord) {
      logger.error('Chat record not found', { 
        chatId: ticketEmailChatId,
        messageId
      });
      return;
    }

    // Get thread context
    const { messages: threadMessages } = await getThreadMessages(threadId, orgId);
    
    // Classify the email
    const classification = await classifyEmailAsPromotional(emailBody, fromAddress, subject, messageId);
    if (!classification) {
      logger.error('Classification failed', { messageId });
      return;
    }

    const isPromotional = classification.isPromotional;

    // Log classification result concisely
    logger.info('PROMOTION AGENT:', {
      messageId,
      threadId,
      from: fromAddress,
      subject,
      classification: {
        type: isPromotional ? 'PROMOTIONAL' : 'NEEDS RESPONSE',
        reason: classification.reason,
        action: isPromotional ? 'Will Archive' : 'Needs Response',
        threadContext: `Thread has ${threadMessages.length} messages, ${isPromotional ? 'all promotional' : 'requires response'}`
      }
    });

    if (isPromotional) {
      // Update metadata
      const { error: updateError } = await supabase
        .from('ticket_email_chats')
        .update({
          metadata: {
            promotional: isPromotional,
            promotional_reason: classification.reason,
            archivedByAgent: isPromotional,
            classification_timestamp: new Date().toISOString()
          }
        })
        .eq('id', ticketEmailChatId);

      if (updateError) {
        logger.error('Metadata update failed', { chatId: ticketEmailChatId });
        return;
      }

      // Archive if promotional
      try {
        await archiveEmail(messageId, orgId);
        logger.info('Email archived', { messageId });
      } catch (error) {
        logger.error('Archive failed', {
          messageId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } else {
      // Generate AI draft for genuine emails
      const aiDraft = await generateAIDraft(emailBody);
      
      const { error: updateError } = await supabase
        .from('ticket_email_chats')
        .update({ 
          ai_draft_response: aiDraft,
          metadata: {
            ...chatRecord.metadata,
            requires_human_response: true
          }
        })
        .eq('id', ticketEmailChatId);

      if (updateError) {
        logger.error('Failed to store AI draft', { error: updateError });
      } else {
        logger.info('Successfully stored AI draft', { ticketEmailChatId });
      }
    }
  } catch (error) {
    logger.error('Promotion agent error', {
      error: error instanceof Error ? error.message : String(error),
      messageId,
      chatId: ticketEmailChatId
    });
  }
}

async function archiveEmail(messageId: string, orgId: string): Promise<void> {
  try {
    // Get Gmail client using organization ID
    const gmail = await getGmailClient(orgId);
    
    // Remove INBOX label
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['INBOX']
      }
    });

    logger.info('[PROMOTION AGENT] Removed INBOX label', { orgId, messageId });
  } catch (error) {
    logger.error('[PROMOTION AGENT] archiveEmail error', { error, messageId });
    throw error;
  }
}

async function unarchiveEmail(messageId: string, orgId: string): Promise<void> {
  try {
    // Get Gmail client using organization ID
    const gmail = await getGmailClient(orgId);
    
    // Add INBOX label back
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: ['INBOX']
      }
    });

    logger.info('[PROMOTION AGENT] Added INBOX label back', { orgId, messageId });
  } catch (error) {
    logger.error('[PROMOTION AGENT] unarchiveEmail error', { error, messageId });
    throw error;
  }
}

export async function unarchivePromotionalEmail(
  ticketEmailChatId: string,
  orgId: string,
  messageId: string,
  reason: string
): Promise<void> {
  try {
    logger.info('[PROMOTION AGENT] Unarchiving promotional email', {
      ticketEmailChatId,
      orgId,
      messageId,
      reason
    });

    // 1. Update metadata in ticket_email_chats
    const { data: existingChat, error: chatError } = await supabase
      .from('ticket_email_chats')
      .select('metadata')
      .eq('id', ticketEmailChatId)
      .single();

    if (chatError || !existingChat) {
      logger.error('[PROMOTION AGENT] Could not get chat record for unarchive', { chatError });
      return;
    }

    const newMetadata = {
      ...(existingChat.metadata || {}),
      promotional: false,
      unarchived_at: new Date().toISOString(),
      unarchive_reason: reason
    };

    const { error: updateError } = await supabase
      .from('ticket_email_chats')
      .update({ 
        metadata: newMetadata,
        ai_classification: 'needs_response'
      })
      .eq('id', ticketEmailChatId);

    if (updateError) {
      logger.error('[PROMOTION AGENT] Failed to update metadata for unarchive', { error: updateError });
      return;
    }

    // 2. Unarchive in Gmail
    await unarchiveEmail(messageId, orgId);
    
    logger.info('[PROMOTION AGENT] Successfully unarchived email', {
      ticketEmailChatId,
      messageId,
      reason
    });
  } catch (error) {
    logger.error('[PROMOTION AGENT] Error in unarchivePromotionalEmail', { error });
    throw error;
  }
}

/**
 * Process all unclassified emails in the system
 */
export async function processUnclassifiedEmails(orgId: string): Promise<void> {
  try {
    logger.info('[PROMOTION AGENT] Starting batch processing of unclassified emails');

    // Get all unclassified emails (where metadata->promotional is null)
    const { data: unclassifiedEmails, error } = await supabase
      .from('ticket_email_chats')
      .select('*')
      .eq('org_id', orgId)
      .is('metadata->promotional', null);

    if (error) {
      logger.error('[PROMOTION AGENT] Failed to fetch unclassified emails', { error });
      return;
    }

    logger.info(`[PROMOTION AGENT] Found ${unclassifiedEmails.length} unclassified emails`);

    // Process each email
    for (const email of unclassifiedEmails) {
      try {
        await processPotentialPromotionalEmail(
          email.id,
          orgId,
          email.body,
          email.message_id,
          email.thread_id,
          email.from_address,
          email.subject || ''
        );
      } catch (error) {
        logger.error('[PROMOTION AGENT] Failed to process email', { 
          error,
          emailId: email.id 
        });
      }
    }

    logger.info('[PROMOTION AGENT] Completed batch processing');
  } catch (error) {
    logger.error('[PROMOTION AGENT] Error in batch processing', { error });
  }
}

async function generateAIDraft(emailBody: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: `Generate a draft response for this email: ${emailBody}` }
      ],
      temperature: 0.1,
      max_tokens: 150,
      response_format: { type: 'text' }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      logger.error('Failed to generate AI draft');
      throw new Error('Failed to generate AI draft');
    }

    return response;
  } catch (error) {
    logger.error('Error generating AI draft', { error });
    throw error;
  }
}