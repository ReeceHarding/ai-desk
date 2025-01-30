import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    await logger.warn('Invalid method', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createPagesServerClient<Database>({ req, res });
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) {
      await logger.error('Session error', { error: sessionError });
      return res.status(401).json({ error: 'Session error' });
    }

    if (!session) {
      await logger.warn('No session found');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { chatId } = req.body;

    if (!chatId) {
      await logger.warn('Missing chatId');
      return res.status(400).json({ error: 'Missing chatId' });
    }

    // Update the record to mark it as discarded
    const { error: updateError } = await supabase
      .from('ticket_email_chats')
      .update({
        ai_draft_response: null,
        ai_draft_discarded: true,
      })
      .eq('id', chatId);

    if (updateError) {
      await logger.error('Failed to update chat record', { error: updateError });
      return res.status(500).json({ error: 'Failed to update chat record' });
    }

    await logger.info('Draft response discarded successfully', { chatId });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    await logger.error('Error discarding draft response', { error });
    return res.status(500).json({ error: 'Failed to discard draft response' });
  }
} 