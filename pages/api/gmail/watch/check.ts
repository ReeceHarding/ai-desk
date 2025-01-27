import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';
import { Database } from '../../../../types/supabase';
import { setupOrRefreshWatch } from '../../../../utils/gmail';

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get all profiles with Gmail watches
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, gmail_access_token, gmail_refresh_token, gmail_watch_expiry')
      .not('gmail_watch_expiry', 'is', null);

    if (profilesError) {
      throw profilesError;
    }

    const now = new Date();
    const refreshPromises = profiles.map(async (profile) => {
      if (!profile.gmail_watch_expiry) return;

      const expiryDate = new Date(profile.gmail_watch_expiry);
      // Refresh if expiring in the next 24 hours
      if (expiryDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
        try {
          const tokens = {
            access_token: profile.gmail_access_token!,
            refresh_token: profile.gmail_refresh_token!,
            expiry_date: Date.now() + 3600000 // Default 1 hour
          };

          const watchResponse = await setupOrRefreshWatch(tokens, 'profile', profile.id);

          // Update watch expiry in database
          await supabase
            .from('profiles')
            .update({
              gmail_watch_expiry: new Date(parseInt(watchResponse.expiration)).toISOString()
            })
            .eq('id', profile.id);

          return {
            profileId: profile.id,
            status: 'refreshed',
            expiry: watchResponse.expiration
          };
        } catch (error) {
          console.error(`Error refreshing watch for profile ${profile.id}:`, error);
          return {
            profileId: profile.id,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
      return {
        profileId: profile.id,
        status: 'skipped',
        expiry: profile.gmail_watch_expiry
      };
    });

    const results = await Promise.all(refreshPromises);
    return res.status(200).json({ results });
  } catch (error: any) {
    console.error('Error checking Gmail watches:', error);
    return res.status(error.code || 500).json({ error: error.message });
  }
} 