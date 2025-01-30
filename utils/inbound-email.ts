import type { Database } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { processPotentialPromotionalEmail } from './agent/gmailPromotionAgent';
import { processInboundEmailWithAI } from './ai-email-processor';
import { logger } from './logger';

// Load environment variables
config();

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ParsedEmail {
  messageId: string;
  threadId: string;
  from: string;
  fromName?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  body: {
    text?: string;
    html?: string;
  };
  date: string;
}

interface TicketCreationResult {
  ticketId: string;
  isNewTicket: boolean;
  emailChatId: string;
}

export async function handleInboundEmail(
  parsedEmail: ParsedEmail,
  orgId: string
): Promise<TicketCreationResult> {
  try {
    // Ensure we have a valid date for gmail_date
    let gmailDate: string;
    try {
      // If parsedEmail.date is already an ISO string, this will work
      gmailDate = new Date(parsedEmail.date).toISOString();
    } catch (error) {
      // If there's any error parsing the date, use current time
      logger.warn('Invalid date format in email, using current time', { 
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
          description: parsedEmail.body.text || parsedEmail.body.html || '(No content)',
          customer_id: await getOrCreateCustomerProfile(parsedEmail.from, orgId),
          org_id: orgId,
          metadata: {
            thread_id: parsedEmail.threadId,
            message_id: parsedEmail.messageId,
            email_date: gmailDate
          }
        })
        .select()
        .single();

      if (!ticket) {
        throw new Error('Failed to create ticket');
      }

      ticketId = ticket.id;
      isNewTicket = true;
    }

    // Create email chat entry
    const { data: emailChat, error: emailChatError } = await supabase
      .from('ticket_email_chats')
      .insert({
        ticket_id: ticketId,
        message_id: parsedEmail.messageId,
        thread_id: parsedEmail.threadId,
        from_name: parsedEmail.fromName || null,
        from_address: parsedEmail.from,
        to_address: Array.isArray(parsedEmail.to) ? parsedEmail.to : [parsedEmail.to],
        cc_address: parsedEmail.cc ? (Array.isArray(parsedEmail.cc) ? parsedEmail.cc : [parsedEmail.cc]) : [],
        bcc_address: parsedEmail.bcc ? (Array.isArray(parsedEmail.bcc) ? parsedEmail.bcc : [parsedEmail.bcc]) : [],
        subject: parsedEmail.subject || null,
        body: parsedEmail.body.text || parsedEmail.body.html || '',
        gmail_date: gmailDate,
        org_id: orgId,
        ai_classification: 'unknown',
        ai_confidence: 0,
        ai_auto_responded: false,
        ai_draft_response: null,
        metadata: {} // Initialize empty metadata
      })
      .select()
      .single();

    if (emailChatError || !emailChat) {
      logger.error('Error creating email chat:', { error: emailChatError });
      throw new Error(`Failed to create email chat: ${emailChatError?.message}`);
    }

    // Process with AI
    try {
      // Add a small delay to ensure the record is available
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check for promotional emails first
      await processPotentialPromotionalEmail(
        emailChat.id,
        orgId,
        parsedEmail.body.text || parsedEmail.body.html || '',
        parsedEmail.messageId,
        parsedEmail.threadId,
        parsedEmail.from,
        parsedEmail.subject || ''
      );

      // Only process with AI if not marked as promotional
      const { data: updatedChat } = await supabase
        .from('ticket_email_chats')
        .select('metadata')
        .eq('id', emailChat.id)
        .single();

      if (!updatedChat?.metadata?.promotional) {
        await processInboundEmailWithAI(
          emailChat.id,
          parsedEmail.body.text || parsedEmail.body.html || '',
          orgId
        );
      }
    } catch (aiError) {
      // Log but don't fail the whole process if AI fails
      logger.error('Error processing email with AI:', { error: aiError });
    }

    return {
      ticketId,
      isNewTicket,
      emailChatId: emailChat.id
    };
  } catch (error) {
    logger.error('Error in handleInboundEmail:', { error });
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