import { Database } from '@/types/supabase';
import { getTokensFromCode, setupGmailWatch } from '@/utils/gmail-server';
import { logger } from '@/utils/logger';
import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next/types';

interface GoogleOAuthError extends Error {
  response?: {
    data?: {
      error_description?: string;
      error?: string;
    };
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  logger.info('=== Gmail Callback Started ===');
  
  // Add request ID for tracing
  const requestId = Math.random().toString(36).substring(7);
  const log = (message: string, data?: any) => {
    logger.info(`[${requestId}] ${message}`, data);
  };
  
  log('Request details', {
    method: req.method,
    query: req.query,
    headers: {
      host: req.headers.host,
      referer: req.headers.referer,
      origin: req.headers.origin,
    },
  });

  if (req.method !== 'GET') {
    log('Method not allowed', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization code and state from query parameters
    const { code, state, error: oauthError, error_description } = req.query;
    
    // Handle OAuth errors
    if (oauthError) {
      log('OAuth error received', { error: oauthError, description: error_description });
      return res.redirect(`/profile/settings?error=true&message=${encodeURIComponent(error_description as string || 'OAuth error')}`);
    }

    if (!code || !state) {
      log('Missing required parameters', { code: !!code, state: !!state });
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    // Parse the state to determine if this is for an org, profile, or onboarding
    const stateParts = (state as string).split(':');
    let type: string;
    let id: string;

    if (stateParts[0] === 'onboarding') {
      // Handle onboarding flow
      type = stateParts[1]; // 'admin' or 'agent'
      id = stateParts[2];
      log('Onboarding state parsed', { type, id, originalState: state });
    } else {
      // Handle regular flow
      [type, id] = stateParts;
      log('Regular state parsed', { type, id, originalState: state });
    }

    if (!type || !id) {
      log('Invalid state format', { type, id, state });
      return res.redirect('/profile/settings?error=true&message=Invalid state parameter');
    }

    // Initialize Supabase client
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      log('Missing Supabase configuration');
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    try {
      log('Starting token exchange...');
      
      // Exchange the authorization code for tokens using our server utility
      const tokens = await getTokensFromCode(code as string);

      log('Token exchange successful', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date,
      });

      // Handle different flows
      if (stateParts[0] === 'onboarding') {
        // Onboarding flow
        const userType = stateParts[1]; // 'admin' or 'agent'
        const userId = stateParts[2];

        log('Handling onboarding flow', { userType, userId });

        // Get user's organization
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', userId)
          .single();

        if (profileError || !profile?.org_id) {
          log('Error fetching profile organization', { error: profileError });
          throw profileError || new Error('No organization found for profile');
        }

        // Update both profile and organization
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            gmail_access_token: tokens.access_token,
            gmail_refresh_token: tokens.refresh_token,
            gmail_token_expiry: new Date(tokens.expiry_date).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (profileUpdateError) {
          log('Error updating profile', { error: profileUpdateError });
          throw profileUpdateError;
        }

        const { error: orgUpdateError } = await supabase
          .from('organizations')
          .update({
            gmail_access_token: tokens.access_token,
            gmail_refresh_token: tokens.refresh_token,
            gmail_token_expiry: new Date(tokens.expiry_date).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.org_id);

        if (orgUpdateError) {
          log('Error updating organization', { error: orgUpdateError });
          // Don't throw, continue with watch setup
        }

        // Set up Gmail watch using our server utility
        try {
          const watchResult = await setupGmailWatch(tokens, userId, profile.org_id);
          
          // Update profile with watch details
          const updateData = {
            gmail_watch_status: 'active',
            gmail_watch_expiration: watchResult.expiration ? new Date(Number(watchResult.expiration)).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            gmail_watch_resource_id: watchResult.resourceId,
            updated_at: new Date().toISOString()
          };

          const { error: updateError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', userId);

          if (updateError) {
            throw updateError;
          }

          log('Successfully set up Gmail watch for onboarding user', {
            resourceId: watchResult.resourceId,
            expiration: updateData.gmail_watch_expiration
          });
        } catch (watchError) {
          log('Error setting up Gmail watch', { error: watchError });
          // Update status to failed
          await supabase
            .from('profiles')
            .update({
              gmail_watch_status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);
          // Continue with redirect even if watch setup fails
        }

        // Import initial emails
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/gmail/import-emails`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: req.headers.cookie || '',
            },
            body: JSON.stringify({ 
              organizationId: profile.org_id,
            })
          });

          if (!response.ok) {
            const error = await response.json();
            log('Error importing emails', { error });
            // Don't throw - we want the OAuth flow to complete
          } else {
            const result = await response.json();
            log('Successfully imported initial emails', { result });
          }
        } catch (importError) {
          log('Error importing initial emails', { error: importError });
          // Continue with redirect even if import fails
        }

        // Redirect based on user type
        if (userType === 'admin') {
          return res.redirect('/admin/dashboard?success=true');
        } else {
          return res.redirect('/tickets?success=true');
        }
      } else {
        // Regular flow (organization or profile)
        if (type === 'organization') {
          log('Updating organization', { id });
          const { error: updateError } = await supabase
            .from('organizations')
            .update({
              gmail_access_token: tokens.access_token,
              gmail_refresh_token: tokens.refresh_token,
              gmail_token_expiry: new Date(tokens.expiry_date).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', id);

          if (updateError) {
            log('Error updating organization', { error: updateError });
            throw updateError;
          }

          // Set up Gmail watch
          try {
            const watchResult = await setupGmailWatch(tokens, id, id);
            
            // Update organization with watch details
            const updateData = {
              gmail_watch_status: 'active',
              gmail_watch_expiration: watchResult.expiration ? new Date(Number(watchResult.expiration)).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              gmail_watch_resource_id: watchResult.resourceId,
              updated_at: new Date().toISOString()
            };

            const { error: updateError } = await supabase
              .from('organizations')
              .update(updateData)
              .eq('id', id);

            if (updateError) {
              throw updateError;
            }

            log('Successfully set up Gmail watch for organization', {
              resourceId: watchResult.resourceId,
              expiration: updateData.gmail_watch_expiration
            });
          } catch (watchError) {
            log('Error setting up Gmail watch for organization', { error: watchError });
            // Update status to failed
            await supabase
              .from('organizations')
              .update({
                gmail_watch_status: 'failed',
                updated_at: new Date().toISOString()
              })
              .eq('id', id);
            // Continue with redirect even if watch setup fails
          }

          log('Organization update successful');
          return res.redirect(`/organizations/${id}/settings?success=true`);
        } else if (type === 'profile') {
          log('Updating profile', { id });
          
          // First get the user's organization
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('org_id')
            .eq('id', id)
            .single();

          if (profileError || !profile?.org_id) {
            log('Error fetching profile organization', { error: profileError });
            throw profileError || new Error('No organization found for profile');
          }

          // Update profile only
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              gmail_access_token: tokens.access_token,
              gmail_refresh_token: tokens.refresh_token,
              gmail_token_expiry: new Date(tokens.expiry_date).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', id);

          if (updateError) {
            log('Error updating profile', { error: updateError });
            throw updateError;
          }

          log('Successfully updated profile with Gmail tokens');

          // Set up Gmail watch
          try {
            const watchResult = await setupGmailWatch(tokens, id, profile.org_id);
            
            // Update profile with watch details
            const updateData = {
              gmail_watch_status: 'active',
              gmail_watch_expiration: watchResult.expiration ? new Date(Number(watchResult.expiration)).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              gmail_watch_resource_id: watchResult.resourceId,
              updated_at: new Date().toISOString()
            };

            const { error: updateError } = await supabase
              .from('profiles')
              .update(updateData)
              .eq('id', id);

            if (updateError) {
              throw updateError;
            }

            log('Successfully set up Gmail watch for profile', {
              resourceId: watchResult.resourceId,
              expiration: updateData.gmail_watch_expiration
            });
          } catch (watchError) {
            log('Error setting up Gmail watch for profile', { error: watchError });
            // Update status to failed
            await supabase
              .from('profiles')
              .update({
                gmail_watch_status: 'failed',
                updated_at: new Date().toISOString()
              })
              .eq('id', id);
            // Continue with import even if watch setup fails
          }

          // Import initial emails
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/gmail/import-emails`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Cookie: req.headers.cookie || '',
              },
              body: JSON.stringify({ 
                organizationId: profile.org_id,
              })
            });

            if (!response.ok) {
              const error = await response.json();
              log('Error importing emails', { error });
            } else {
              const result = await response.json();
              log('Successfully imported emails', { result });
            }
          } catch (importError) {
            log('Error importing initial emails', { error: importError });
            // Continue with redirect even if import fails
          }

          // Redirect back to profile settings
          return res.redirect('/profile/settings?success=true');
        } else {
          log('Invalid state type', { type });
          throw new Error('Invalid state parameter');
        }
      }
    } catch (tokenError: unknown) {
      const error = tokenError as GoogleOAuthError;
      log('Token exchange/update error', {
        error: error.message,
        response: error.response?.data,
        stack: error.stack,
      });
      const errorMessage = error.response?.data?.error_description || error.message || 'Failed to exchange token';
      return res.redirect(`/profile/settings?error=true&message=${encodeURIComponent(errorMessage)}`);
    }
  } catch (error: unknown) {
    const err = error as GoogleOAuthError;
    log('Gmail OAuth callback error', {
      error: err.message,
      stack: err.stack,
    });
    const errorMessage = err.message || 'Unknown error occurred';
    
    // Redirect to settings with error
    return res.redirect(`/profile/settings?error=true&message=${encodeURIComponent(errorMessage)}`);
  }
} 