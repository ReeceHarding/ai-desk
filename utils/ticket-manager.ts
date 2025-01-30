import { Database } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GRACE_PERIOD_DAYS = 30;

/**
 * Check if a ticket is within its grace period after being closed
 */
export async function isWithinGracePeriod(ticketId: string): Promise<boolean> {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('status, updated_at')
    .eq('id', ticketId)
    .single();

  if (error || !ticket) {
    logger.error('Failed to check ticket grace period', { error });
    return false;
  }

  if (ticket.status !== 'closed') {
    return false;
  }

  const closedDate = new Date(ticket.updated_at);
  const now = new Date();
  const daysSinceClosed = Math.floor((now.getTime() - closedDate.getTime()) / (1000 * 60 * 60 * 24));

  return daysSinceClosed <= GRACE_PERIOD_DAYS;
}

/**
 * Reopen a ticket if it's within the grace period
 */
export async function handleTicketReopening(ticketId: string, newEmailId: string): Promise<void> {
  const withinGrace = await isWithinGracePeriod(ticketId);

  if (!withinGrace) {
    logger.info('Ticket outside grace period, not reopening', { ticketId });
    return;
  }

  // Get the ticket details
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('assigned_agent_id, org_id')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    logger.error('Failed to get ticket details for reopening', { ticketError });
    return;
  }

  // Update ticket status to open
  const { error: updateError } = await supabase
    .from('tickets')
    .update({
      status: 'open',
      assigned_agent_id: ticket.assigned_agent_id, // Keep same agent
      updated_at: new Date().toISOString()
    })
    .eq('id', ticketId);

  if (updateError) {
    logger.error('Failed to reopen ticket', { updateError });
    return;
  }

  // Log the reopening
  await supabase.from('logs').insert({
    level: 'info',
    message: 'Ticket reopened due to new email within grace period',
    metadata: {
      ticketId,
      newEmailId,
      previousAgent: ticket.assigned_agent_id
    }
  });

  logger.info('Successfully reopened ticket', {
    ticketId,
    newEmailId,
    assignedAgent: ticket.assigned_agent_id
  });
}

/**
 * Close a ticket and start the grace period
 */
export async function closeTicket(ticketId: string): Promise<void> {
  const { error } = await supabase
    .from('tickets')
    .update({
      status: 'closed',
      updated_at: new Date().toISOString()
    })
    .eq('id', ticketId);

  if (error) {
    logger.error('Failed to close ticket', { error });
    throw error;
  }

  logger.info('Ticket closed, grace period started', { ticketId });
} 