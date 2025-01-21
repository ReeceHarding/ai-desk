import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { pollGmailInbox, parseGmailMessage } from '@/utils/gmail';
import { handleInboundEmail } from '@/utils/inbound-email';
import { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify the request is from Google Pub/Sub
    const message = req.body.message;
    if (!message || !message.data) {
      console.error('Invalid Pub/Sub message format');
      return res.status(400).json({ error: 'Invalid message format' });
    }

    // Decode the base64 message data
    const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
    
    // Extract the email ID and history ID
    const { emailId, historyId } = data;
    if (!emailId) {
      console.error('Missing email ID in notification');
      return res.status(400).json({ error: 'Missing email ID' });
    }

    // Get all organizations and profiles with Gmail tokens
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, gmail_refresh_token, gmail_access_token')
      .not('gmail_refresh_token', 'is', null);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, org_id, gmail_refresh_token, gmail_access_token')
      .not('gmail_refresh_token', 'is', null);

    // Process for each connected mailbox
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

    // Acknowledge the message
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Error processing Gmail notification:', error);
    // Still return 200 to acknowledge the message and prevent retries
    res.status(200).json({ status: 'error', error: String(error) });
  }
} 