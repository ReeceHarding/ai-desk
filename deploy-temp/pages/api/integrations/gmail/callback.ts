import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { Database } from '@/types/supabase';
import { importInitialEmails } from '@/utils/gmail';
import { GMAIL_SCOPES } from '@/types/gmail';

interface GoogleOAuthError extends Error {
  response?: {
    data?: {
      error_description?: string;
      error?: string;
    };
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('\n=== Gmail Callback Started ===');
  console.log('Request details:', {
    method: req.method,
    query: req.query,
    headers: {
      host: req.headers.host,
      referer: req.headers.referer,
      origin: req.headers.origin,
    },
  });

  if (req.method !== 'GET') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization code and state from query parameters
    const { code, state, error: oauthError, error_description } = req.query;
    
    // Handle OAuth errors
    if (oauthError) {
      console.error('OAuth error received:', { error: oauthError, description: error_description });
      return res.redirect(`/profile/settings?error=true&message=${encodeURIComponent(error_description as string || 'OAuth error')}`);
    }

    if (!code || !state) {
      console.error('Missing required parameters:', { code: !!code, state: !!state });
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    // Parse the state to determine if this is for an org or profile
    const [type, id] = (state as string).split(':');
    console.log('State parsed:', { type, id, originalState: state });

    if (!type || !id) {
      console.error('Invalid state format:', { type, id, state });
      return res.redirect('/profile/settings?error=true&message=Invalid state parameter');
    }

    try {
      console.log('Starting token exchange...');
      console.log('Token exchange configuration:', {
        clientId: process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
        redirectUri: process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI,
        hasClientSecret: !!process.env.GMAIL_CLIENT_SECRET,
      });

      // Exchange the authorization code for tokens
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
        client_secret: process.env.GMAIL_CLIENT_SECRET,
        redirect_uri: process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI,
        grant_type: 'authorization_code',
      });

      console.log('Token exchange successful:', {
        hasAccessToken: !!tokenResponse.data.access_token,
        hasRefreshToken: !!tokenResponse.data.refresh_token,
        expiresIn: tokenResponse.data.expires_in,
        tokenType: tokenResponse.data.token_type,
      });

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      if (!access_token || !refresh_token) {
        console.error('Missing tokens in response:', {
          hasAccessToken: !!access_token,
          hasRefreshToken: !!refresh_token,
          responseData: tokenResponse.data,
        });
        throw new Error('Invalid token response');
      }

      // Initialize Supabase client with service role key
      console.log('Initializing Supabase client...');
      console.log('Supabase configuration:', {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      });

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

      // Update the appropriate record with the tokens
      if (type === 'org') {
        console.log('Updating organization:', id);
        const { data: org, error: getError } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', id)
          .single();

        if (getError) {
          console.error('Error fetching organization:', getError);
          throw getError;
        }

        console.log('Found organization:', org?.name);

        const { data: updateData, error: updateError } = await supabase
          .from('organizations')
          .update({
            gmail_access_token: access_token,
            gmail_refresh_token: refresh_token,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('id, name, gmail_refresh_token')
          .single();

        if (updateError) {
          console.error('Error updating organization:', updateError);
          throw updateError;
        }

        console.log('Organization update successful:', {
          id: updateData?.id,
          name: updateData?.name,
          hasGmailToken: !!updateData?.gmail_refresh_token,
        });

        // Redirect back to org settings
        const redirectUrl = `/organizations/${id}/settings?success=true`;
        console.log('Redirecting to:', redirectUrl);
        return res.redirect(redirectUrl);
      } else if (type === 'profile') {
        console.log('Updating profile:', id);
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            gmail_access_token: access_token,
            gmail_refresh_token: refresh_token,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
          throw updateError;
        }

        console.log('Successfully updated profile with Gmail tokens');

        // Import initial emails
        try {
          await importInitialEmails(id, {
            access_token,
            refresh_token,
            token_type: 'Bearer',
            scope: GMAIL_SCOPES.join(' '),
            expiry_date: Date.now() + (expires_in * 1000)
          });
          console.log('Successfully imported initial emails');
        } catch (importError) {
          console.error('Error importing initial emails:', importError);
          // Continue with redirect even if import fails
        }

        // Redirect back to profile settings
        return res.redirect('/profile/settings?success=true');
      } else {
        console.error('Invalid state type:', type);
        throw new Error('Invalid state parameter');
      }
    } catch (tokenError: unknown) {
      const error = tokenError as GoogleOAuthError;
      console.error('Token exchange/update error:', {
        error: error.message,
        response: error.response?.data,
        stack: error.stack,
      });
      const errorMessage = error.response?.data?.error_description || error.message || 'Failed to exchange token';
      return res.redirect(`/profile/settings?error=true&message=${encodeURIComponent(errorMessage)}`);
    }
  } catch (error: unknown) {
    const err = error as GoogleOAuthError;
    console.error('Gmail OAuth callback error:', {
      error: err.message,
      stack: err.stack,
    });
    const errorMessage = err.message || 'Unknown error occurred';
    
    // Redirect to settings with error
    return res.redirect(`/profile/settings?error=true&message=${encodeURIComponent(errorMessage)}`);
  }
} 