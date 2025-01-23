import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Update organization with new column names
    const { error } = await supabase
      .from('organizations')
      .update({
        gmail_history_id: '2180684', // Current history ID from Gmail profile
        gmail_watch_expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      })
      .eq('id', 'ee0f56a0-4130-4398-bc2d-27529f82efb1');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ message: 'Organization updated successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
} 