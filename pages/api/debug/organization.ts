import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('*');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(orgs);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
} 