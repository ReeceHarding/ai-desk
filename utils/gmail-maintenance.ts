import { Database } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { refreshGmailTokens, setupGmailWatch } from './gmail';
import { logger } from './logger';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const gmail = google.gmail('v1');

/**
 * Refresh Gmail watch subscription for a mailbox
 */
async function refreshWatchSubscription(
  mailbox: { 
    id: string; 
    gmail_access_token: string; 
    gmail_refresh_token: string;
  },
  type: 'organization' | 'profile'
): Promise<void> {
  try {
    logger.info('Refreshing Gmail watch subscription', { 
      type, 
      id: mailbox.id 
    });

    // First refresh tokens if needed
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: mailbox.gmail_access_token,
      refresh_token: mailbox.gmail_refresh_token,
    });

    // Test the current token
    try {
      await gmail.users.getProfile({ auth, userId: 'me' });
    } catch (error: any) {
      if (error.response?.status === 401) {
        logger.info('Access token expired, refreshing...', { type, id: mailbox.id });
        const newTokens = await refreshGmailTokens(mailbox.gmail_refresh_token);
        
        // Update the tokens in the database
        await supabase
          .from(type === 'organization' ? 'organizations' : 'profiles')
          .update({
            gmail_access_token: newTokens.access_token,
            gmail_refresh_token: newTokens.refresh_token,
            updated_at: new Date().toISOString()
          })
          .eq('id', mailbox.id);

        // Update auth with new tokens
        auth.setCredentials({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
        });
      } else {
        throw error;
      }
    }

    // Set up new watch
    const watchResult = await setupGmailWatch(
      {
        access_token: auth.credentials.access_token!,
        refresh_token: auth.credentials.refresh_token!,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/gmail.modify',
        expiry_date: Date.now() + 3600000
      },
      type,
      mailbox.id
    );

    // Update watch status
    await supabase
      .from(type === 'organization' ? 'organizations' : 'profiles')
      .update({
        gmail_watch_status: 'active',
        gmail_watch_expiration: new Date(watchResult.expiration).toISOString(),
        gmail_watch_resource_id: watchResult.resourceId,
        updated_at: new Date().toISOString()
      })
      .eq('id', mailbox.id);

    logger.info('Successfully refreshed Gmail watch subscription', {
      type,
      id: mailbox.id,
      expiration: new Date(watchResult.expiration).toISOString()
    });
  } catch (error) {
    logger.error('Failed to refresh Gmail watch subscription', {
      type,
      id: mailbox.id,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Update status to failed
    await supabase
      .from(type === 'organization' ? 'organizations' : 'profiles')
      .update({
        gmail_watch_status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', mailbox.id);

    throw error;
  }
}

/**
 * Check and refresh all Gmail watch subscriptions that are expiring soon
 */
export async function maintainGmailWatches(): Promise<void> {
  const EXPIRATION_THRESHOLD_HOURS = 24; // Refresh if expiring within 24 hours

  try {
    // Get organizations with Gmail integration
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, gmail_access_token, gmail_refresh_token, gmail_watch_expiration, gmail_watch_status')
      .not('gmail_refresh_token', 'is', null);

    if (orgError) {
      logger.error('Failed to fetch organizations', { error: orgError });
      throw orgError;
    }

    // Get profiles with Gmail integration
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, gmail_access_token, gmail_refresh_token, gmail_watch_expiration, gmail_watch_status')
      .not('gmail_refresh_token', 'is', null);

    if (profileError) {
      logger.error('Failed to fetch profiles', { error: profileError });
      throw profileError;
    }

    const now = new Date();
    const expirationThreshold = new Date(now.getTime() + EXPIRATION_THRESHOLD_HOURS * 60 * 60 * 1000);

    // Process organizations
    for (const org of orgs) {
      if (!org.gmail_watch_expiration || 
          new Date(org.gmail_watch_expiration) <= expirationThreshold ||
          org.gmail_watch_status !== 'active') {
        try {
          await refreshWatchSubscription(org, 'organization');
        } catch (error) {
          logger.error('Failed to refresh organization watch', {
            orgId: org.id,
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue with other orgs even if one fails
        }
      }
    }

    // Process profiles
    for (const profile of profiles) {
      if (!profile.gmail_watch_expiration || 
          new Date(profile.gmail_watch_expiration) <= expirationThreshold ||
          profile.gmail_watch_status !== 'active') {
        try {
          await refreshWatchSubscription(profile, 'profile');
        } catch (error) {
          logger.error('Failed to refresh profile watch', {
            profileId: profile.id,
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue with other profiles even if one fails
        }
      }
    }

    logger.info('Completed Gmail watch maintenance', {
      processedOrgs: orgs.length,
      processedProfiles: profiles.length
    });
  } catch (error) {
    logger.error('Failed to maintain Gmail watches', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
} 