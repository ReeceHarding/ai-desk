import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';
import { GmailTokens } from '../../../types/gmail';
import { Database } from '../../../types/supabase';
import { getGmailProfile } from '../../../utils/gmail-server';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { org_id } = req.body;

    if (!org_id) {
      return res.status(400).json({ message: 'Missing organization ID' });
    }

    // Get organization's Gmail tokens
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('gmail_access_token, gmail_refresh_token')
      .eq('id', org_id)
      .single();

    if (orgError || !org) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    if (!org.gmail_access_token || !org.gmail_refresh_token) {
      return res.status(400).json({ message: 'Organization missing Gmail tokens' });
    }

    // Get Gmail profile
    const profile = await getGmailProfile({
      access_token: org.gmail_access_token,
      refresh_token: org.gmail_refresh_token,
      expiry_date: 0 // We'll refresh the token if needed
    } as GmailTokens);

    res.status(200).json(profile);
  } catch (error) {
    console.error('Error fetching Gmail profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
} 