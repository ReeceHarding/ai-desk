import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';
import { ParsedEmail } from '../types/gmail';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TicketCreationResult {
  ticketId: string;
  isNewTicket: boolean;
}

export async function handleInboundEmail(
  parsedEmail: ParsedEmail,
  orgId: string
): Promise<TicketCreationResult> {
  try {
    // First try to find an existing ticket by thread ID in metadata
    const { data: existingTickets } = await supabase
      .from('tickets')
      .select('id, subject, metadata')
      .eq('org_id', orgId)
      .filter('metadata->thread_id', 'eq', parsedEmail.threadId)
      .limit(1);

    if (existingTickets && existingTickets.length > 0) {
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

      return {
        ticketId,
        isNewTicket: false
      };
    }

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