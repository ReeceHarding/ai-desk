import { Database } from '@/types/supabase';
import { getGmailClient, parseGmailMessage } from '@/utils/gmail';
import { handleInboundEmail } from '@/utils/inbound-email';
import { logger } from '@/utils/logger';
import { createClient } from '@supabase/supabase-js';
import { gmail_v1 } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';

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
    // Get all organizations with Gmail tokens
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, gmail_refresh_token, gmail_access_token')
      .not('gmail_refresh_token', 'is', null);

    const processPromises = [];

    // Process org mailboxes
    if (orgs) {
      for (const org of orgs) {
        if (org.gmail_refresh_token && org.gmail_access_token) {
          processPromises.push(
            (async () => {
              try {
                const gmail = await getGmailClient(org.id);
                const response = await gmail.users.messages.list({
                  userId: 'me',
                  q: 'is:unread',
                  maxResults: 10
                });

                const messages = response.data.messages || [];
                for (const msg of messages) {
                  if (!msg.id) continue;

                  const message = await gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'full'
                  });

                  // Parse the message and convert to the expected format
                  const parsedGmailEmail = await parseGmailMessage(message.data as gmail_v1.Schema$Message);
                  if (!parsedGmailEmail) {
                    logger.warn('Failed to parse email message', {
                      messageId: msg.id,
                      orgId: org.id
                    });
                    continue;
                  }

                  // Map Gmail ParsedEmail to inbound email ParsedEmail format
                  await handleInboundEmail({
                    messageId: parsedGmailEmail.id,
                    threadId: parsedGmailEmail.threadId,
                    from: parsedGmailEmail.from,
                    to: parsedGmailEmail.to,
                    cc: parsedGmailEmail.cc,
                    bcc: parsedGmailEmail.bcc,
                    subject: parsedGmailEmail.subject,
                    body: {
                      text: parsedGmailEmail.bodyText,
                      html: parsedGmailEmail.bodyHtml
                    },
                    date: parsedGmailEmail.date
                  }, org.id);
                }
              } catch (error) {
                logger.error('Error processing org mailbox:', { 
                  error: error instanceof Error ? error.message : String(error),
                  orgId: org.id 
                });
              }
            })()
          );
        }
      }
    }

    // Wait for all processing to complete
    await Promise.all(processPromises);

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error('Error polling Gmail:', { 
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({ error: String(error) });
  }
} 