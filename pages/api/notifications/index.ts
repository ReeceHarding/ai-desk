import { logger } from '@/utils/logger';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerSupabaseClient({ req, res });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    logger.info('Fetching notifications', { userId: user.id });

    const [draftsResult, autoSentResult] = await Promise.all([
      supabase
        .from('ticket_email_chats')
        .select('id, ticket_id, subject, ai_draft_response, created_at, from_address, from_name, thread_id, message_id, ai_confidence')
        .eq('ai_auto_responded', false)
        .not('ai_draft_response', 'is', null)
        .eq('metadata->promotional', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('ticket_email_chats')
        .select('id, ticket_id, subject, ai_draft_response, created_at, from_address, from_name, thread_id, message_id, ai_confidence')
        .eq('ai_auto_responded', true)
        .not('ai_draft_response', 'is', null)
        .eq('metadata->promotional', false)
        .order('created_at', { ascending: false })
    ]);

    if (draftsResult.error) {
      logger.error('Error fetching drafts', { error: draftsResult.error, userId: user.id });
      throw draftsResult.error;
    }

    if (autoSentResult.error) {
      logger.error('Error fetching auto-sent', { error: autoSentResult.error, userId: user.id });
      throw autoSentResult.error;
    }

    return res.status(200).json({
      drafts: draftsResult.data || [],
      autoSent: autoSentResult.data || []
    });
  } catch (error) {
    logger.error('Error in notifications API', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 