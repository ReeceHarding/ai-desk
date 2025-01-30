import { maintainGmailWatches } from '@/utils/gmail-maintenance';
import { logger } from '@/utils/logger';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await maintainGmailWatches();
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error('Failed to run Gmail watch maintenance', {
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 