import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '../../../utils/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { ticketId, page = 0, limit = 20 } = req.query;

    if (!ticketId) {
      return res.status(400).json({ message: 'Missing ticket ID' });
    }

    const from = page ? parseInt(page as string) * parseInt(limit as string) : 0;
    const to = from + parseInt(limit as string) - 1;

    logger.info('Fetching email thread', { ticketId, from, to });

    const { data: messages, error, count } = await supabase
      .from('ticket_email_chats')
      .select('*', { count: 'exact' })
      .eq('ticket_id', ticketId)
      .order('gmail_date', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error('Error fetching email thread', { 
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        ticketId
      });
      return res.status(500).json({ message: 'Error fetching email thread' });
    }

    if (!messages?.length) {
      logger.info('No messages found for ticket', { ticketId });
      return res.status(200).json({ messages: [], count: 0 });
    }

    logger.info('Successfully fetched email thread', { 
      ticketId, 
      messageCount: messages.length,
      totalCount: count,
      hasMore: count ? from + messages.length < count : false
    });

    return res.json({
      messages,
      total: count,
      hasMore: count ? from + messages.length < count : false
    });
  } catch (error) {
    logger.error('Error in ticket thread API route:', { error: error as unknown as Record<string, unknown> });
    return res.status(500).json({ message: 'Internal server error' });
  }
} 