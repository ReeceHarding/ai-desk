import { Database } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data: logs, error } = await supabase
      .from('logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch logs' });
    }

    return res.status(200).json(logs);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
} 