import { unarchivePromotionalEmail } from '@/utils/agent/gmailPromotionAgent';
import { logger } from '@/utils/logger';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createPagesServerClient({ req, res });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { ticketEmailChatId, orgId, messageId, reason } = req.body;

    if (!ticketEmailChatId || !orgId || !messageId || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify user has access to this org
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', session.user.id)
      .single();

    if (!profile || profile.org_id !== orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await unarchivePromotionalEmail(ticketEmailChatId, orgId, messageId, reason);

    logger.info('Successfully unarchived email', {
      ticketEmailChatId,
      orgId,
      messageId,
      userId: session.user.id
    });

    return res.status(200).json({ message: 'OK' });
  } catch (error: any) {
    logger.error('Error unarchiving email:', { error: error.message || 'Unknown error' });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
} 