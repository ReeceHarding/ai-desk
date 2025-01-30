import { Database } from '@/types/supabase';
import { processUnclassifiedEmails } from '@/utils/agent/gmailPromotionAgent';
import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// This secret should match what's configured in your cron service
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify the request is from our cron service
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get all organizations
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id');

    if (orgsError) {
      throw orgsError;
    }

    // Process unclassified emails for each organization
    for (const org of orgs) {
      await processUnclassifiedEmails(org.id);
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Error processing unclassified emails:', error);
    res.status(500).json({ error: String(error) });
  }
} 