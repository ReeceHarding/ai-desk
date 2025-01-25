import { logger } from '@/utils/logger';
import { NextApiRequest, NextApiResponse } from 'next';

// Verify cron secret to ensure only authorized calls
const verifyCronSecret = (req: NextApiRequest): boolean => {
  const cronSecret = req.headers['x-cron-secret'];
  return cronSecret === process.env.CRON_SECRET;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyCronSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logger.info('Starting notification processing cron job');

    // Call the notification processing endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/notifications/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to process notifications: ${response.statusText}`);
    }

    const result = await response.json();
    
    logger.info('Completed notification processing cron job', result);
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Error in notification processing cron job', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 