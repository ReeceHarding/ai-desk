import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { ParsedEmail } from '../types/gmail';
import { Database } from '../types/supabase';
import { EmailLogger } from './emailLogger';

// Load environment variables
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required environment variables for Supabase connection');
}

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

interface TicketCreationResult {
  ticketId: string;
  isNewTicket: boolean;
}

export async function handleInboundEmail(
  parsedEmail: ParsedEmail,
  orgId: string
): Promise<TicketCreationResult> {
  try {
    console.log(`Processing inbound email: ${parsedEmail.messageId} for org: ${orgId}`);
    
    // First try to find an existing ticket by thread ID in metadata
    const { data: existingTickets } = await supabase
      .from('tickets')
      .select('id, subject, metadata')
      .eq('org_id', orgId)
      .filter('metadata->thread_id', 'eq', parsedEmail.threadId)
      .limit(1);

    if (existingTickets && existingTickets.length > 0) {
      console.log(`Found existing ticket: ${existingTickets[0].id} for thread: ${parsedEmail.threadId}`);
      
      // Found existing ticket - add comment
      const ticketId = existingTickets[0].id;
      
      // Get or create customer profile
      const { data: customerProfile } = await getOrCreateCustomerProfile(parsedEmail.from, orgId);
      
      if (!customerProfile) {
        throw new Error('Failed to get or create customer profile');
      }

      // Add comment to existing ticket
      await supabase.from('comments').insert({
        ticket_id: ticketId,
        author_id: customerProfile.id,
        body: parsedEmail.body.text || parsedEmail.body.html || '(No content)',
        org_id: orgId,
        metadata: {
          message_id: parsedEmail.messageId,
          email_date: parsedEmail.date.toISOString()
        } as Database['public']['Tables']['comments']['Insert']['metadata']
      });

      // Log the email
      await EmailLogger.logEmail({
        ticketId: ticketId,
        messageId: parsedEmail.messageId,
        threadId: parsedEmail.threadId,
        fromAddress: parsedEmail.from,
        toAddress: parsedEmail.to,
        subject: parsedEmail.subject,
        rawContent: parsedEmail.body.text || parsedEmail.body.html,
        orgId: orgId
      });

      console.log(`Added comment to ticket: ${ticketId}`);

      return {
        ticketId,
        isNewTicket: false
      };
    }

    console.log(`No existing ticket found for thread: ${parsedEmail.threadId}, creating new ticket`);

    // No existing ticket found - create new one
    const { data: customerProfile } = await getOrCreateCustomerProfile(parsedEmail.from, orgId);
    
    if (!customerProfile) {
      throw new Error('Failed to get or create customer profile');
    }

    // Create new ticket
    const { data: ticket } = await supabase
      .from('tickets')
      .insert({
        subject: parsedEmail.subject,
        description: parsedEmail.body.text || parsedEmail.body.html || '(No content)',
        customer_id: customerProfile.id,
        org_id: orgId,
        metadata: {
          thread_id: parsedEmail.threadId,
          message_id: parsedEmail.messageId,
          email_date: parsedEmail.date.toISOString()
        } as Database['public']['Tables']['tickets']['Insert']['metadata']
      })
      .select()
      .single();

    if (!ticket) {
      throw new Error('Failed to create ticket');
    }

    // Create corresponding email chat entry
    if (!parsedEmail.from || !parsedEmail.to || !parsedEmail.date) {
      console.error('Missing required fields for email chat:', {
        from: parsedEmail.from,
        to: parsedEmail.to,
        date: parsedEmail.date
      });
      throw new Error('Missing required fields for email chat');
    }

    const { error: emailChatError } = await supabase
      .from('ticket_email_chats')
      .insert({
        ticket_id: ticket.id,
        message_id: parsedEmail.messageId,
        thread_id: parsedEmail.threadId,
        from_name: parsedEmail.fromName || null,
        from_address: parsedEmail.from,
        to_address: Array.isArray(parsedEmail.to) ? parsedEmail.to : [parsedEmail.to],
        cc_address: parsedEmail.cc ? (Array.isArray(parsedEmail.cc) ? parsedEmail.cc : [parsedEmail.cc]) : [],
        bcc_address: parsedEmail.bcc ? (Array.isArray(parsedEmail.bcc) ? parsedEmail.bcc : [parsedEmail.bcc]) : [],
        subject: parsedEmail.subject || null,
        body: parsedEmail.body.text || parsedEmail.body.html || 'No content available',
        gmail_date: parsedEmail.date,
        org_id: orgId,
        ai_classification: 'unknown',
        ai_confidence: 0,
        ai_auto_responded: false,
        ai_draft_response: null
      });

    if (emailChatError) {
      console.error('Error creating email chat:', {
        error: emailChatError,
        ticket_id: ticket.id,
        message_id: parsedEmail.messageId,
        thread_id: parsedEmail.threadId,
        org_id: orgId,
        error_details: emailChatError.details,
        error_message: emailChatError.message,
        error_hint: emailChatError.hint
      });
      throw new Error(`Failed to create email chat: ${emailChatError.message}`);
    } else {
      console.log('Successfully created email chat for ticket:', {
        ticket_id: ticket.id,
        message_id: parsedEmail.messageId
      });
    }

    // Log the email
    await EmailLogger.logEmail({
      ticketId: ticket.id,
      messageId: parsedEmail.messageId,
      threadId: parsedEmail.threadId,
      fromAddress: parsedEmail.from,
      toAddress: parsedEmail.to,
      subject: parsedEmail.subject,
      rawContent: parsedEmail.body.text || parsedEmail.body.html,
      orgId: orgId
    });

    console.log(`Created new ticket: ${ticket.id}`);

    return {
      ticketId: ticket.id,
      isNewTicket: true
    };

  } catch (error) {
    console.error('Error handling inbound email:', error);
    throw error;
  }
}

async function getOrCreateCustomerProfile(emailAddress: string, orgId: string) {
  // First try to find existing profile
  const { data: existingProfiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', emailAddress)
    .eq('org_id', orgId)
    .limit(1);

  if (existingProfiles && existingProfiles.length > 0) {
    return { data: existingProfiles[0] };
  }

  // No existing profile - create new one
  const displayName = emailAddress.split('@')[0];
  const userId = uuidv4();

  const { data: newProfile, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      email: emailAddress,
      display_name: displayName,
      role: 'customer',
      org_id: orgId,
      metadata: {
        source: 'email_integration',
        created_at: new Date().toISOString()
      }
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating customer profile:', error);
    throw error;
  }

  return { data: newProfile };
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