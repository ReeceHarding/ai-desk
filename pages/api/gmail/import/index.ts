import { GmailTokens } from '@/types/gmail';
import { Database } from '@/types/supabase';
import { parseGmailMessage, pollGmailInbox } from '@/utils/gmail';
import { logger } from '@/utils/logger';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { NextApiRequest, NextApiResponse } from 'next';

// Store progress in memory (in production this should be Redis/etc)
declare global {
  var importProgress: Map<string, number>;
}

if (!global.importProgress) {
  global.importProgress = new Map();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Supabase client
    const supabase = createPagesServerClient<Database>({ req, res });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const count = parseInt(req.query.count as string || '10', 10);
    const userId = session.user.id;

    // Generate a unique import ID
    const importId = `${userId}-${Date.now()}`;
    global.importProgress.set(importId, 0);

    // Start the import process in the background
    processEmailsInBackground(importId, count, userId, supabase);

    return res.status(200).json({ importId });
  } catch (error) {
    logger.error('Error starting email import', { error });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function processEmailsInBackground(
  importId: string,
  count: number,
  userId: string,
  supabase: ReturnType<typeof createPagesServerClient<Database>>
) {
  try {
    // Get Gmail client and tokens
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select(`
        organizations (
          id,
          gmail_access_token,
          gmail_refresh_token
        )
      `)
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    if (orgError || !orgMember) {
      logger.error('Error fetching organization', { error: orgError });
      global.importProgress.set(importId, -1);
      return;
    }

    const orgData = orgMember.organizations as unknown as {
      id: string;
      gmail_access_token: string | null;
      gmail_refresh_token: string | null;
    };

    if (!orgData.gmail_access_token || !orgData.gmail_refresh_token) {
      logger.error('Gmail tokens not found', { 
        orgId: orgData.id,
        hasAccessToken: !!orgData.gmail_access_token,
        hasRefreshToken: !!orgData.gmail_refresh_token
      });
      global.importProgress.set(importId, -1);
      return;
    }

    const gmailTokens: GmailTokens = {
      access_token: orgData.gmail_access_token,
      refresh_token: orgData.gmail_refresh_token,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/gmail.modify',
      expiry_date: Date.now() + 3600000 // Add 1 hour as default
    };

    // Get messages
    const messages = await pollGmailInbox(gmailTokens);
    const totalMessages = count === -1 ? messages.length : Math.min(count, messages.length);

    if (totalMessages === 0) {
      logger.info('No messages to import');
      global.importProgress.set(importId, 100);
      return;
    }

    for (let i = 0; i < totalMessages; i++) {
      const message = messages[i];
      
      try {
        // Parse the email
        const parsedEmail = await parseGmailMessage(message);
        
        // First create the ticket email chat record
        const { data: chatRecord, error: insertError } = await supabase
          .from('ticket_email_chats')
          .insert({
            subject: parsedEmail.subject,
            from_address: parsedEmail.from,
            from_name: parsedEmail.from.split('@')[0], // Simple name extraction
            thread_id: message.threadId,
            message_id: message.id,
            org_id: orgData.id,
            metadata: {}
          })
          .select()
          .single();

        if (insertError || !chatRecord) {
          logger.error('Error creating ticket email chat record', { error: insertError });
          continue;
        }

        // Call the promotion agent API endpoint
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/agent/classify-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            emailText: parsedEmail.bodyText || '',
            fromAddress: parsedEmail.from,
            subject: parsedEmail.subject,
          }),
        });

        if (!response.ok) {
          logger.warn('Failed to classify email', { messageId: message.id });
          continue;
        }

        const classification = await response.json();

        // Update the record with classification results
        await supabase
          .from('ticket_email_chats')
          .update({
            metadata: {
              promotional: classification.isPromotional,
              promotional_reason: classification.reason,
              archivedByAgent: classification.isPromotional
            }
          })
          .eq('id', chatRecord.id);

        // Update progress
        const progress = Math.round(((i + 1) / totalMessages) * 100);
        global.importProgress.set(importId, progress);
        
        // Add small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error('Error processing email', { 
          error,
          messageId: message.id,
          importId 
        });
        // Continue with next message
        continue;
      }
    }

    // Mark as complete
    global.importProgress.set(importId, 100);
  } catch (error) {
    logger.error('Error in background email processing', { error, importId });
    global.importProgress.set(importId, -1); // Mark as failed
  }
} 