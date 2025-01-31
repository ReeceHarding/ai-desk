import { ParsedEmail } from '@/types/gmail';
import { Database } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { processPotentialPromotionalEmail } from './agent/gmailPromotionAgent';
import { processInboundEmailWithAI } from './ai-email-processor';
import { logger } from './logger';
import { createTicketFromEmail } from './server/gmail';

// Load environment variables
config();

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TicketCreationResult {
  ticketId: string;
  isNewTicket: boolean;
  emailChatId: string;
}

const WHITELIST_DOMAINS = ['@google.com', '@wisc.edu'];

function isWhitelisted(email: string): boolean {
  return WHITELIST_DOMAINS.some(domain => 
    email.toLowerCase().endsWith(domain)
  );
}

export async function handleInboundEmail(
  emailData: ParsedEmail,
  userId: string
): Promise<{ ticketId: string; emailChatId: string }> {
  try {
    // Step 1: Create or update ticket and save email
    const { ticket, emailChatId } = await createTicketFromEmail(emailData, userId);

    // Step 2: Check if promotional first
    await processPotentialPromotionalEmail(
      emailChatId,
      ticket.org_id,
      emailData.bodyText || emailData.bodyHtml,
      emailData.id,
      emailData.threadId,
      emailData.from,
      emailData.subject
    );

    // Get the updated record to check if it was marked as promotional
    const { data: chatRecord } = await supabase
      .from('ticket_email_chats')
      .select('metadata')
      .eq('id', emailChatId)
      .single();

    // Step 3: Only generate AI response if not promotional
    if (!chatRecord?.metadata?.promotional) {
      await processInboundEmailWithAI(
        emailChatId,
        emailData.bodyText || emailData.bodyHtml,
        ticket.org_id
      );
    }

    return { ticketId: ticket.id, emailChatId };
  } catch (error) {
    logger.error('Error handling inbound email:', { error });
    throw error;
  }
}

async function getOrCreateCustomerProfile(email: string, orgId: string): Promise<string> {
  // First try to find existing profile
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (existingProfile) {
    return existingProfile.id;
  }

  // Create new profile
  const { data: auth } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      source: 'email_inbound'
    }
  });

  if (!auth.user) {
    throw new Error('Failed to create auth user');
  }

  // Create profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: auth.user.id,
      email,
      org_id: orgId,
      role: 'customer',
      display_name: email.split('@')[0]
    })
    .select()
    .single();

  if (profileError || !profile) {
    throw new Error(`Failed to create profile: ${profileError?.message}`);
  }

  return profile.id;
}

export async function reopenTicketIfNeeded(ticketId: string): Promise<void> {
  const { data: ticket } = await supabase
    .from('tickets')
    .select('status, updated_at, metadata')
    .eq('id', ticketId)
    .single();

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  // If ticket is closed and was updated less than 30 days ago, reopen it
  if (ticket.status === 'closed') {
    const updatedAt = new Date(ticket.updated_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (updatedAt > thirtyDaysAgo) {
      await supabase
        .from('tickets')
        .update({ 
          status: 'open',
          metadata: {
            ...(ticket.metadata as Record<string, unknown>),
            reopened_at: new Date().toISOString(),
            reopened_reason: 'new_email'
          }
        })
        .eq('id', ticketId);
    }
  }
}

async function processWhitelistedEmail(
  parsedEmail: ParsedEmail,
  orgId: string
): Promise<TicketCreationResult> {
  // Ensure we have a valid date for gmail_date
  let gmailDate: string;
  try {
    gmailDate = new Date(parsedEmail.date).toISOString();
  } catch (error) {
    logger.warn('Invalid date format in whitelisted email, using current time', { 
      date: parsedEmail.date,
      error 
    });
    gmailDate = new Date().toISOString();
  }

  // First, check if this thread already has a ticket
  const { data: existingChat } = await supabase
    .from('ticket_email_chats')
    .select('ticket_id')
    .eq('thread_id', parsedEmail.threadId)
    .single();

  let ticketId: string;
  let isNewTicket = false;

  if (existingChat) {
    ticketId = existingChat.ticket_id;
  } else {
    // Create new ticket
    const { data: ticket } = await supabase
      .from('tickets')
      .insert({
        subject: parsedEmail.subject || '(No subject)',
        description: parsedEmail.bodyText || parsedEmail.bodyHtml || '(No content)',
        customer_id: await getOrCreateCustomerProfile(parsedEmail.from, orgId),
        org_id: orgId,
        metadata: {
          thread_id: parsedEmail.threadId,
          message_id: parsedEmail.id,
          email_date: gmailDate,
          whitelisted: true
        }
      })
      .select()
      .single();

    if (!ticket) {
      throw new Error('Failed to create ticket for whitelisted email');
    }

    ticketId = ticket.id;
    isNewTicket = true;
  }

  // Extract sender's name from the from field
  const senderName = parsedEmail.from.match(/^([^<]+)/)?.[1]?.trim() || parsedEmail.from;

  // Create email chat entry
  const { data: emailChat, error: emailChatError } = await supabase
    .from('ticket_email_chats')
    .insert({
      ticket_id: ticketId,
      message_id: parsedEmail.id,
      thread_id: parsedEmail.threadId,
      from_name: senderName,
      from_address: parsedEmail.from,
      to_address: parsedEmail.to,
      cc_address: parsedEmail.cc || [],
      bcc_address: parsedEmail.bcc || [],
      subject: parsedEmail.subject || null,
      body: parsedEmail.bodyText || parsedEmail.bodyHtml || '',
      gmail_date: gmailDate,
      org_id: orgId,
      ai_classification: 'should_respond', // Always mark whitelisted as should_respond
      ai_confidence: 100, // High confidence for whitelisted
      ai_auto_responded: false,
      ai_draft_response: null,
      metadata: {
        whitelisted: true,
        whitelisted_domain: WHITELIST_DOMAINS.find(d => parsedEmail.from.toLowerCase().endsWith(d))
      }
    })
    .select()
    .single();

  if (emailChatError || !emailChat) {
    logger.error('Error creating email chat for whitelisted email:', { error: emailChatError });
    throw new Error(`Failed to create email chat: ${emailChatError?.message}`);
  }

  return {
    ticketId,
    isNewTicket,
    emailChatId: emailChat.id
  };
}

async function getExistingTicketId(threadId: string, orgId: string): Promise<string | null> {
  const { data: existingTicket } = await supabase
    .from('tickets')
    .select('id')
    .eq('gmail_thread_id', threadId)
    .eq('org_id', orgId)
    .single();

  return existingTicket?.id || null;
} 