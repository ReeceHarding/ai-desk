import { Database } from '@/types/supabase';
import { getGmailClient } from '@/utils/gmail';
import { logger } from '@/utils/logger';
import { createClient } from '@supabase/supabase-js';
import { gmail_v1 } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';

// Type definition for Gmail watch response that includes all base properties
interface ExtendedWatchResponse extends gmail_v1.Schema$WatchResponse {
  historyId?: string;
  expiration?: string;
  resourceId?: string;
}

// Initialize Supabase client with service role
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await logger.info('Setting up Gmail watch', { 
      headers: req.headers,
      timestamp: new Date().toISOString()
    });
    
    // Organization-based setup (multiple accounts)
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, gmail_access_token, gmail_refresh_token')
      .not('gmail_refresh_token', 'is', null)
      .is('gmail_watch_expiration', null);

    if (orgsError) {
      await logger.error('Failed to get organizations', { error: orgsError });
      return res.status(500).json({ error: 'Failed to get organizations' });
    }

    if (!orgs || orgs.length === 0) {
      await logger.info('No organizations need watch setup');
      return res.status(200).json({ message: 'No organizations need watch setup' });
    }

    const results = [];

    // Set up watch for each organization
    for (const org of orgs) {
      try {
        if (!org.gmail_access_token || !org.gmail_refresh_token) {
          await logger.warn('Organization missing Gmail tokens', { orgId: org.id });
          continue;
        }

        const gmail = await getGmailClient(org.id);

        // Set up Gmail watch with all labels except SPAM and TRASH
        const watchResponse = await gmail.users.watch({
          userId: 'me',
          requestBody: {
            labelIds: [], // Empty array means all labels except SPAM and TRASH
            topicName: process.env.GMAIL_PUBSUB_TOPIC,
            labelFilterAction: 'include'
          },
        });

        const response = watchResponse.data as ExtendedWatchResponse;

        if (response.expiration) {
          // Update organization with watch expiration and resourceId
          const { error: updateError } = await supabase
            .from('organizations')
            .update({
              gmail_watch_expiration: new Date(parseInt(response.expiration)).toISOString(),
              gmail_history_id: response.historyId,
              gmail_watch_resource_id: response.resourceId || null,
              gmail_watch_status: 'active'
            })
            .eq('id', org.id);

          if (updateError) {
            await logger.error('Failed to update organization watch expiration', {
              error: updateError,
              orgId: org.id,
            });
          } else {
            await logger.info('Successfully set up Gmail watch', {
              orgId: org.id,
              expiration: response.expiration,
              historyId: response.historyId,
              resourceId: response.resourceId || null
            });
          }
        }

        results.push({
          orgId: org.id,
          success: true,
          watchResponse: response,
        });
      } catch (error) {
        await logger.error('Error setting up Gmail watch for organization', {
          error,
          orgId: org.id,
        });
        results.push({
          orgId: org.id,
          success: false,
          error,
        });
      }
    }

    return res.status(200).json({
      message: 'Gmail watch setup complete',
      results,
    });
  } catch (error) {
    await logger.error('Error in Gmail watch setup', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 