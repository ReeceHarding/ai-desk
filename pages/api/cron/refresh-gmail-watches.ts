import { setupGmailWatch } from '@/utils/gmail';
import { logger } from '@/utils/logger';
import { createClient, PostgrestError } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify the request is from Vercel Cron
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get expiring watches (within next 24 hours)
    const expirationThreshold = new Date();
    expirationThreshold.setHours(expirationThreshold.getHours() + 24);

    // Get all mailboxes with Gmail integration that need refresh
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, email, gmail_refresh_token, gmail_access_token, gmail_watch_status, gmail_watch_expiration')
      .or(`gmail_watch_status.eq.active,gmail_watch_status.eq.failed`)
      .lt('gmail_watch_expiration', expirationThreshold.toISOString());

    if (orgError) {
      logger.error('Error fetching organizations:', { 
        code: (orgError as PostgrestError).code,
        message: (orgError as PostgrestError).message,
        details: (orgError as PostgrestError).details
      });
      throw orgError;
    }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, gmail_refresh_token, gmail_access_token, gmail_watch_status, gmail_watch_expiration')
      .or(`gmail_watch_status.eq.active,gmail_watch_status.eq.failed`)
      .lt('gmail_watch_expiration', expirationThreshold.toISOString());

    if (profileError) {
      logger.error('Error fetching profiles:', { 
        code: (profileError as PostgrestError).code,
        message: (profileError as PostgrestError).message,
        details: (profileError as PostgrestError).details
      });
      throw profileError;
    }

    const mailboxes = [...(orgs || []), ...(profiles || [])];
    logger.info(`Refreshing Gmail watches for ${mailboxes.length} mailboxes`);

    // Refresh watch for each mailbox
    const results = await Promise.allSettled(
      mailboxes.map(async (mailbox) => {
        try {
          // Set status to pending before refresh attempt
          const table = 'organization' in mailbox ? 'organizations' : 'profiles';
          await supabase
            .from(table)
            .update({
              gmail_watch_status: 'pending',
              updated_at: new Date().toISOString()
            })
            .eq('id', mailbox.id);

          const watchResult = await setupGmailWatch({
            access_token: mailbox.gmail_access_token,
            refresh_token: mailbox.gmail_refresh_token,
            token_type: 'Bearer',
            scope: 'https://www.googleapis.com/auth/gmail.modify',
            expiry_date: Date.now() + 3600000 // 1 hour
          },
          'organization' in mailbox ? 'organization' : 'profile',
          mailbox.id);

          // Update watch status
          await supabase
            .from(table)
            .update({
              gmail_watch_status: 'active',
              gmail_watch_expiration: new Date(watchResult.expiration).toISOString(),
              gmail_watch_resource_id: watchResult.resourceId,
              updated_at: new Date().toISOString()
            })
            .eq('id', mailbox.id);

          logger.info(`Refreshed Gmail watch for ${mailbox.email}`, {
            resourceId: watchResult.resourceId,
            expiration: new Date(watchResult.expiration).toISOString()
          });

          return { 
            email: mailbox.email, 
            success: true,
            resourceId: watchResult.resourceId,
            expiration: new Date(watchResult.expiration).toISOString()
          };
        } catch (error) {
          logger.error(`Failed to refresh Gmail watch for ${mailbox.email}:`, { 
            error: error instanceof Error ? error.message : String(error) 
          });

          // Update status to failed
          const table = 'organization' in mailbox ? 'organizations' : 'profiles';
          await supabase
            .from(table)
            .update({
              gmail_watch_status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', mailbox.id);

          return { 
            email: mailbox.email, 
            success: false, 
            error: error instanceof Error ? error.message : String(error)
          };
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failureCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    logger.info('Gmail watch refresh completed', {
      total: mailboxes.length,
      success: successCount,
      failed: failureCount
    });

    return res.status(200).json({
      success: true,
      summary: {
        total: mailboxes.length,
        success: successCount,
        failed: failureCount
      },
      results: results.map(result => 
        result.status === 'fulfilled' ? result.value : { 
          success: false, 
          error: result.reason instanceof Error ? result.reason.message : String(result.reason)
        }
      )
    });
  } catch (error) {
    logger.error('Error refreshing Gmail watches:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 