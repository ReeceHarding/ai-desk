import { NextApiRequest, NextApiResponse } from 'next';
import { getTokensFromCode, setupGmailWatch } from '../../../utils/gmail-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('Gmail OAuth error:', error);
      return res.redirect(`/profile/settings?error=${error}`);
    }

    if (!code || !state) {
      return res.redirect('/profile/settings?error=missing_params');
    }

    // Decode state parameter
    const { user_id, org_id } = JSON.parse(Buffer.from(state as string, 'base64').toString());

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code as string);

    // Setup Gmail watch
    await setupGmailWatch(tokens, user_id, org_id);

    res.redirect('/profile/settings?success=true');
  } catch (error) {
    console.error('Error in Gmail callback:', error);
    res.redirect('/profile/settings?error=server_error');
  }
} 