import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createClient } from '@supabase/supabase-js';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';

// Initialize Supabase client with service role
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const oauth2Client = new OAuth2Client(
  process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
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
    
    // Support both direct token input and organization-based setup
    if (req.body.access_token && req.body.refresh_token) {
      // Direct token setup (single account)
      oauth2Client.setCredentials({
        access_token: req.body.access_token,
        refresh_token: req.body.refresh_token,
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const watchResponse = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          labelIds: [], // Empty array means all labels except SPAM and TRASH
          topicName: process.env.GMAIL_PUBSUB_TOPIC,
          labelFilterAction: 'include'
        }
      });

      await logger.info('Single account Gmail watch setup successful', {
        historyId: watchResponse.data.historyId,
        expiration: new Date(Number(watchResponse.data.expiration)).toISOString()
      });

      return res.status(200).json({
        historyId: watchResponse.data.historyId,
        expiration: watchResponse.data.expiration,
        resourceId: watchResponse.data.resourceId || ''
      });
    }

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

        oauth2Client.setCredentials({
          access_token: org.gmail_access_token,
          refresh_token: org.gmail_refresh_token,
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Set up Gmail watch with all labels except SPAM and TRASH
        const watchResponse = await gmail.users.watch({
          userId: 'me',
          requestBody: {
            labelIds: [], // Empty array means all labels except SPAM and TRASH
            topicName: process.env.GMAIL_PUBSUB_TOPIC,
            labelFilterAction: 'include'
          },
        });

        if (watchResponse.data.expiration) {
          // Update organization with watch expiration and resourceId
          const { error: updateError } = await supabase
            .from('organizations')
            .update({
              gmail_watch_expiration: new Date(parseInt(watchResponse.data.expiration)).toISOString(),
              gmail_history_id: watchResponse.data.historyId,
              gmail_resource_id: watchResponse.data.resourceId || null
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
              expiration: watchResponse.data.expiration,
              historyId: watchResponse.data.historyId,
              resourceId: watchResponse.data.resourceId
            });
          }
        }

        results.push({
          orgId: org.id,
          success: true,
          watchResponse: watchResponse.data,
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