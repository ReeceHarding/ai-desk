import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization code and state from query parameters
    const { code, state, error: oauthError, error_description } = req.query;
    
    // Handle OAuth errors
    if (oauthError) {
      console.error('OAuth error:', { error: oauthError, description: error_description });
      return res.redirect(`/profile/settings?error=true&message=${encodeURIComponent(error_description as string || 'OAuth error')}`);
    }

    if (!code || !state) {
      console.error('Missing parameters:', { code, state });
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    // Parse the state to determine if this is for an org or profile
    const [type, id] = (state as string).split(':');

    if (!type || !id) {
      console.error('Invalid state format:', state);
      return res.redirect('/profile/settings?error=true&message=Invalid state parameter');
    }

    try {
      // Exchange the authorization code for tokens
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: process.env.GMAIL_CLIENT_ID,
        client_secret: process.env.GMAIL_CLIENT_SECRET,
        redirect_uri: process.env.GMAIL_REDIRECT_URI,
        grant_type: 'authorization_code',
      });

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      if (!access_token || !refresh_token) {
        console.error('Missing tokens in response:', tokenResponse.data);
        throw new Error('Invalid token response');
      }

      // Initialize Supabase client
      const supabase = createServerSupabaseClient({ req, res });

      // Update the appropriate record with the tokens
      if (type === 'org') {
        const { error: updateError } = await supabase
          .from('organizations')
          .update({
            gmail_access_token: access_token,
            gmail_refresh_token: refresh_token,
          })
          .eq('id', id);

        if (updateError) {
          console.error('Error updating organization:', updateError);
          throw updateError;
        }

        // Redirect back to org settings
        return res.redirect(`/organizations/${id}/settings?success=true`);
      } else if (type === 'profile') {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            gmail_access_token: access_token,
            gmail_refresh_token: refresh_token,
          })
          .eq('id', id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
          throw updateError;
        }

        // Redirect back to profile settings
        return res.redirect('/profile/settings?success=true');
      } else {
        console.error('Invalid state type:', type);
        throw new Error('Invalid state parameter');
      }
    } catch (tokenError: any) {
      console.error('Token exchange error:', tokenError.response?.data || tokenError);
      return res.redirect(`/profile/settings?error=true&message=${encodeURIComponent('Failed to exchange token')}`);
    }
  } catch (error: any) {
    console.error('Gmail OAuth callback error:', error);
    const errorMessage = error.message || 'Unknown error occurred';
    
    // Redirect to settings with error
    return res.redirect(`/profile/settings?error=true&message=${encodeURIComponent(errorMessage)}`);
  }
} 