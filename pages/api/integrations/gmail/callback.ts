import { GMAIL_SCOPES } from '@/types/gmail';
import { Database } from '@/types/supabase';
import { importInitialEmails, setupGmailWatch } from '@/utils/gmail';
import { logger } from '@/utils/logger';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { NextApiRequest, NextApiResponse } from 'next';

interface GoogleOAuthError extends Error {
  response?: {
    data?: {
      error_description?: string;
      error?: string;
    };
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  logger.info('Gmail callback handler started', {
    method: req.method,
    langsmithTracing: process.env.LANGCHAIN_TRACING_V2,
    langsmithProject: process.env.LANGCHAIN_PROJECT
  });
  
  // Add request ID for tracing
  const requestId = Math.random().toString(36).substring(7);
  const log = (message: string, data?: any) => {
    console.log(`[${requestId}] ${message}`, data || '');
  };
  
  log('Request details:', {
    method: req.method,
    query: req.query,
    headers: {
      host: req.headers.host,
      referer: req.headers.referer,
      origin: req.headers.origin,
    },
  });

  if (req.method !== 'GET') {
    log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization code and state from query parameters
    const { code, state, error: oauthError, error_description } = req.query;
    
    // Handle OAuth errors
    if (oauthError) {
      log('OAuth error received:', { error: oauthError, description: error_description });
      return res.redirect(`/profile/settings?error=true&message=${encodeURIComponent(error_description as string || 'OAuth error')}`);
    }

    if (!code || !state) {
      log('Missing required parameters:', { code: !!code, state: !!state });
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    // Parse the state to determine if this is for an org or profile
    const [type, id] = (state as string).split(':');
    log('State parsed:', { type, id, originalState: state });

    if (!type || !id) {
      log('Invalid state format:', { type, id, state });
      return res.redirect('/profile/settings?error=true&message=Invalid state parameter');
    }

    // Initialize Supabase client with service role key
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
      log('Missing Supabase configuration');
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    try {
      log('Starting token exchange...');
      
      // Verify required environment variables
      if (!process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI) {
        throw new Error('Missing Gmail OAuth configuration');
      }

      // Exchange the authorization code for tokens
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
        client_secret: process.env.GMAIL_CLIENT_SECRET,
        redirect_uri: process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI,
        grant_type: 'authorization_code',
      });

      log('Token exchange successful:', {
        hasAccessToken: !!tokenResponse.data.access_token,
        hasRefreshToken: !!tokenResponse.data.refresh_token,
        expiresIn: tokenResponse.data.expires_in,
        tokenType: tokenResponse.data.token_type,
      });

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      if (!access_token || !refresh_token) {
        log('Missing tokens in response:', {
          hasAccessToken: !!access_token,
          hasRefreshToken: !!refresh_token,
          responseData: tokenResponse.data,
        });
        throw new Error('Invalid token response');
      }

      // Update the appropriate record with the tokens
      if (type === 'organization') {
        log('Updating organization:', id);
        const { error: updateError } = await supabase
          .from('organizations')
          .update({
            gmail_access_token: access_token,
            gmail_refresh_token: refresh_token,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) {
          log('Error updating organization:', updateError);
          throw updateError;
        }

        // Set up Gmail watch for organization
        try {
          const watchResult = await setupGmailWatch({
            access_token,
            refresh_token,
            token_type: 'Bearer',
            scope: GMAIL_SCOPES.join(' '),
            expiry_date: Date.now() + (expires_in * 1000)
          },
          'organization',
          id);

          // Update watch status in database
          await supabase
            .from('organizations')
            .update({
              gmail_watch_status: 'active',
              gmail_watch_expiration: watchResult.expiration 
                ? new Date(parseInt(watchResult.expiration)).toISOString() 
                : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              gmail_watch_resource_id: watchResult.resourceId,
              updated_at: new Date().toISOString()
            })
            .eq('id', id);

          log('Successfully set up Gmail watch for organization', {
            resourceId: watchResult.resourceId,
            expiration: new Date(watchResult.expiration).toISOString()
          });
        } catch (watchError) {
          log('Error setting up Gmail watch for organization:', watchError);
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
        logger.info('Gmail connection completed successfully', {
          orgId: id,
          historyId: requestId,
          langsmithTracing: process.env.LANGCHAIN_TRACING_V2,
          langsmithProject: process.env.LANGCHAIN_PROJECT
        });
        return res.redirect(`/organizations/${id}/settings?success=true`);
      } else if (type === 'profile') {
        log('Updating profile:', id);
        
        // First get the user's organization
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', id)
          .single();

        if (profileError || !profile?.org_id) {
          log('Error fetching profile organization:', profileError);
          throw profileError || new Error('No organization found for profile');
        }

        // Update profile and organization with Gmail tokens
        const { error: updateError } = await supabase.from('profiles')
          .update({
            gmail_access_token: access_token,
            gmail_refresh_token: refresh_token,
            gmail_token_expiry: new Date(Date.now() + (expires_in * 1000)).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (updateError) {
          log('Error updating profile:', updateError);
          throw updateError;
        }

        // Update organization with Gmail tokens
        const { error: orgUpdateError } = await supabase.from('organizations')
          .update({
            gmail_access_token: access_token,
            gmail_refresh_token: refresh_token,
            gmail_token_expiry: new Date(Date.now() + (expires_in * 1000)).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.org_id);

        if (orgUpdateError) {
          log('Error updating organization:', orgUpdateError);
          throw orgUpdateError;
        }

        log('Successfully updated profile and organization with Gmail tokens');

        // Set up Gmail watch for profile
        try {
          const watchResult = await setupGmailWatch({
            access_token,
            refresh_token,
            token_type: 'Bearer',
            scope: GMAIL_SCOPES.join(' '),
            expiry_date: Date.now() + (expires_in * 1000)
          },
          'profile',
          id);

          // Update watch status in database
          await supabase
            .from('profiles')
            .update({
              gmail_watch_status: 'active',
              gmail_watch_expiration: watchResult.expiration ? new Date(Number(watchResult.expiration)).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              gmail_watch_resource_id: watchResult.resourceId,
              updated_at: new Date().toISOString()
            })
            .eq('id', id);

          log('Successfully set up Gmail watch for profile', {
            resourceId: watchResult.resourceId,
            expiration: watchResult.expiration ? new Date(Number(watchResult.expiration)).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          });
        } catch (watchError) {
          log('Error setting up Gmail watch for profile:', watchError);
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
          const results = await importInitialEmails(id, {
            access_token,
            refresh_token,
            token_type: 'Bearer',
            scope: GMAIL_SCOPES.join(' '),
            expiry_date: Date.now() + (expires_in * 1000)
          });
          
          const successful = results.filter(r => r.success).length;
          const failed = results.filter(r => !r.success).length;
          
          logger.info('Initial email import completed', {
            total: results.length,
            successful,
            failed,
            orgId: id,
            langsmithTracing: process.env.LANGCHAIN_TRACING_V2,
            langsmithProject: process.env.LANGCHAIN_PROJECT
          });

          if (failed > 0) {
            logger.warn('Some emails failed to import', {
              failedEmails: results.filter(r => !r.success).map(r => ({
                messageId: r.messageId,
                error: r.error
              }))
            });
          }
        } catch (error) {
          logger.error('Error importing initial emails', {
            error,
            orgId: id
          });
        }

        // Redirect back to profile settings
        return res.redirect('/profile/settings?success=true');
      } else {
        log('Invalid state type:', type);
        throw new Error('Invalid state parameter');
      }
    } catch (tokenError: unknown) {
      const error = tokenError as GoogleOAuthError;
      log('Token exchange/update error:', {
        error: error.message,
        response: error.response?.data,
        stack: error.stack,
      });
      const errorMessage = error.response?.data?.error_description || error.message || 'Failed to exchange token';
      return res.redirect(`/profile/settings?error=true&message=${encodeURIComponent(errorMessage)}`);
    }
  } catch (error: unknown) {
    const err = error as GoogleOAuthError;
    log('Gmail OAuth callback error:', {
      error: err.message,
      stack: err.stack,
    });
    const errorMessage = err.message || 'Unknown error occurred';
    
    // Redirect to settings with error
    return res.redirect(`/profile/settings?error=true&message=${encodeURIComponent(errorMessage)}`);
  }
} 