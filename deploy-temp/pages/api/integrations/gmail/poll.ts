import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { pollGmailInbox, parseGmailMessage } from '@/utils/gmail';
import { handleInboundEmail } from '@/utils/inbound-email';
import { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
    // Get all organizations and profiles with Gmail tokens
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, gmail_refresh_token, gmail_access_token')
      .not('gmail_refresh_token', 'is', null);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, org_id, gmail_refresh_token, gmail_access_token')
      .not('gmail_refresh_token', 'is', null);

    const processPromises = [];

    // Process org mailboxes
    if (orgs) {
      for (const org of orgs) {
        if (org.gmail_refresh_token && org.gmail_access_token) {
          processPromises.push(
            pollGmailInbox({ 
              refresh_token: org.gmail_refresh_token,
              access_token: org.gmail_access_token,
              token_type: 'Bearer',
              scope: 'https://www.googleapis.com/auth/gmail.modify',
              expiry_date: 0 // Will force token refresh
            }).then(async (messages) => {
              for (const message of messages) {
                const parsedEmail = parseGmailMessage(message);
                await handleInboundEmail(parsedEmail, org.id);
              }
            }).catch(error => {
              console.error(`Error processing org ${org.id} mailbox:`, error);
            })
          );
        }
      }
    }

    // Process personal mailboxes
    if (profiles) {
      for (const profile of profiles) {
        if (profile.gmail_refresh_token && profile.gmail_access_token) {
          processPromises.push(
            pollGmailInbox({
              refresh_token: profile.gmail_refresh_token,
              access_token: profile.gmail_access_token,
              token_type: 'Bearer',
              scope: 'https://www.googleapis.com/auth/gmail.modify',
              expiry_date: 0 // Will force token refresh
            }).then(async (messages) => {
              for (const message of messages) {
                const parsedEmail = parseGmailMessage(message);
                await handleInboundEmail(parsedEmail, profile.org_id);
              }
            }).catch(error => {
              console.error(`Error processing profile ${profile.id} mailbox:`, error);
            })
          );
        }
      }
    }

    // Wait for all processing to complete
    await Promise.all(processPromises);

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Error polling Gmail:', error);
    res.status(500).json({ error: String(error) });
  }
} 