import { GmailTokens } from '@/types/gmail';
import { Database } from '@/types/supabase';
import { parseGmailMessage } from '@/utils/gmail';
import { logger } from '@/utils/logger';
import { pollGmailInbox } from '@/utils/server/gmail';
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

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('Failed to get user profile');
    }

    // Generate a unique import ID
    const importId = `${userId}-${Date.now()}`;
    global.importProgress.set(importId, 0);

    // Create import record in database
    const { error: importError } = await supabase
      .from('gmail_imports')
      .insert({
        id: importId,
        user_id: userId,
        org_id: profile.org_id,
        status: 'pending',
        progress: 0,
        total_messages: count,
        started_at: new Date().toISOString()
      });

    if (importError) {
      logger.error('Failed to create import record', { error: importError });
      throw importError;
    }

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
    // Update import status to in_progress
    await supabase
      .from('gmail_imports')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('id', importId);

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
      .limit(1)
      .single();

    if (orgError) {
      const errorMessage = orgError.code === 'PGRST116' 
        ? 'No admin organization member found'
        : `Error fetching organization: ${orgError.message}`;
      
      logger.error(errorMessage, { 
        error: orgError,
        userId,
        importId,
        code: orgError.code
      });
      
      global.importProgress.set(importId, -1);
      await updateImportStatus(supabase, importId, 'failed', errorMessage);
      return;
    }

    if (!orgMember?.organizations) {
      const errorMessage = 'Organization data not found';
      logger.error(errorMessage, { userId, importId });
      global.importProgress.set(importId, -1);
      await updateImportStatus(supabase, importId, 'failed', errorMessage);
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
      await updateImportStatus(supabase, importId, 'failed', 'Gmail tokens not found');
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
    const messages = await pollGmailInbox(gmailTokens, count);
    const totalMessages = count === -1 ? messages.length : Math.min(count, messages.length);

    if (totalMessages === 0) {
      logger.info('No messages to import');
      global.importProgress.set(importId, 100);
      await updateImportStatus(supabase, importId, 'completed', null, 0);
      return;
    }

    let processedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < totalMessages; i++) {
      const message = messages[i];
      
      try {
        // Parse the email
        const parsedEmail = await parseGmailMessage(message);
        
        if (!parsedEmail) {
          logger.warn('Failed to parse email', { messageId: message.id });
          failedCount++;
          continue;
        }

        // Create ticket first
        const { data: ticket, error: ticketError } = await supabase
          .from('tickets')
          .insert({
            subject: parsedEmail.subject || '(No Subject)',
            description: parsedEmail.bodyText || parsedEmail.bodyHtml || '',
            status: 'open',
            priority: 'medium',
            customer_id: userId,
            org_id: orgData.id,
            type: 'email',
            source: 'gmail',
            metadata: {
              email_message_id: message.id,
              email_thread_id: message.threadId,
              email_from: parsedEmail.from,
              email_to: parsedEmail.to.join(', '),
              email_cc: parsedEmail.cc?.join(', ') || '',
              email_bcc: parsedEmail.bcc?.join(', ') || ''
            }
          })
          .select()
          .single();

        if (ticketError || !ticket) {
          logger.error('Error creating ticket', { error: ticketError });
          failedCount++;
          continue;
        }
        
        // Create email chat entry
        const { data: chatRecord, error: insertError } = await supabase
          .from('ticket_email_chats')
          .insert({
            ticket_id: ticket.id,
            message_id: message.id,
            thread_id: message.threadId,
            from_address: parsedEmail.from,
            from_name: parsedEmail.from.split('@')[0], // Simple name extraction
            to_address: parsedEmail.to,
            cc_address: parsedEmail.cc || [],
            bcc_address: parsedEmail.bcc || [],
            subject: parsedEmail.subject,
            body: parsedEmail.bodyText || parsedEmail.bodyHtml || '',
            gmail_date: new Date(parsedEmail.date.replace(/\s\(.*\)$/, '')).toISOString(),
            org_id: orgData.id,
            ai_classification: 'unknown',
            ai_confidence: 0,
            ai_auto_responded: false,
            ai_draft_response: null,
            metadata: {}
          })
          .select()
          .single();

        if (insertError || !chatRecord) {
          logger.error('Error creating ticket email chat record', { error: insertError });
          failedCount++;
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
            orgId: orgData.id
          }),
        });

        if (!response.ok) {
          logger.warn('Failed to classify email', { messageId: message.id });
          failedCount++;
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

        processedCount++;

        // Update progress
        const progress = Math.round(((i + 1) / totalMessages) * 100);
        global.importProgress.set(importId, progress);
        
        // Update database progress
        await updateImportProgress(supabase, importId, progress, processedCount, failedCount);
        
        // Add small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error('Error processing email', { error, messageId: message.id });
        failedCount++;
        
        // Update progress even for failed items
        const progress = Math.round(((i + 1) / totalMessages) * 100);
        global.importProgress.set(importId, progress);
        await updateImportProgress(supabase, importId, progress, processedCount, failedCount);
      }
    }

    // Mark import as completed
    await updateImportStatus(supabase, importId, 'completed', null, processedCount, failedCount);
    global.importProgress.set(importId, 100);
  } catch (error) {
    logger.error('Error in background email processing', { error, importId });
    global.importProgress.set(importId, -1);
    await updateImportStatus(
      supabase,
      importId,
      'failed',
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function updateImportProgress(
  supabase: ReturnType<typeof createPagesServerClient<Database>>,
  importId: string,
  progress: number,
  processedCount: number,
  failedCount: number
) {
  const { error } = await supabase
    .from('gmail_imports')
    .update({
      progress,
      processed_messages: processedCount,
      failed_messages: failedCount,
      updated_at: new Date().toISOString()
    })
    .eq('id', importId);

  if (error) {
    logger.error('Failed to update import progress', { error, importId });
  }
}

async function updateImportStatus(
  supabase: ReturnType<typeof createPagesServerClient<Database>>,
  importId: string,
  status: 'pending' | 'in_progress' | 'completed' | 'failed',
  error?: string | null,
  processedCount?: number,
  failedCount?: number
) {
  const update: any = {
    status,
    error,
    updated_at: new Date().toISOString()
  };

  if (status === 'completed' || status === 'failed') {
    update.completed_at = new Date().toISOString();
  }

  if (typeof processedCount === 'number') {
    update.processed_messages = processedCount;
  }

  if (typeof failedCount === 'number') {
    update.failed_messages = failedCount;
  }

  const { error: updateError } = await supabase
    .from('gmail_imports')
    .update(update)
    .eq('id', importId);

  if (updateError) {
    logger.error('Failed to update import status', { error: updateError, importId });
  }
} 