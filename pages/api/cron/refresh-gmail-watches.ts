import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests from cron jobs
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify the request is from our cron job
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get all profiles with Gmail watch that expires in the next hour
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, gmail_watch_expiration')
      .lt('gmail_watch_expiration', oneHourFromNow)
      .not('gmail_watch_expiration', 'is', null);

    if (profileError) {
      await logger.error('Error fetching profiles to refresh', { error: profileError });
      throw profileError;
    }

    await logger.info(`Found ${profiles.length} profiles needing watch refresh`);

    // Refresh watch for each profile
    const refreshPromises = profiles.map(async (profile) => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/gmail/watch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            profile_id: profile.id,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to refresh watch for profile ${profile.id}: ${response.statusText}`);
        }

        await logger.info(`Refreshed watch for profile ${profile.id}`);
      } catch (error) {
        await logger.error(`Error refreshing watch for profile ${profile.id}`, { error });
      }
    });

    await Promise.all(refreshPromises);

    res.status(200).json({ status: 'success' });
  } catch (error) {
    await logger.error('Error in Gmail watch refresh cron', { error });
    res.status(500).json({ error: String(error) });
  }
} 