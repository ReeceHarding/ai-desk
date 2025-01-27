import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';
import { Database } from '../../../types/supabase';
import { getAuthUrl } from '../../../utils/gmail-server';

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
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { user_id, org_id } = req.body;

    if (!user_id || !org_id) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    // Generate state parameter for security
    const state = Buffer.from(JSON.stringify({ user_id, org_id })).toString('base64');
    
    // Get authorization URL
    const authUrl = await getAuthUrl(state);

    res.status(200).json({ url: authUrl });
  } catch (error) {
    console.error('Error initiating Gmail auth:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
} 