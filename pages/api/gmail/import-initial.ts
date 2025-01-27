import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';
import { GmailTokens } from '../../../types/gmail';
import { Database } from '../../../types/supabase';
import { getGmailClient } from './utils';

// Initialize Supabase client
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;
    const authHeader = req.headers.authorization;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const access_token = authHeader.split(' ')[1];
    const tokens: GmailTokens = {
      access_token,
      refresh_token: '', // Not needed for this request
      expiry_date: Date.now() + 3600000 // Default 1 hour
    };

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.org_id) {
      throw profileError || new Error('No organization found for profile');
    }

    const gmail = await getGmailClient(tokens);
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10
    });

    const messages = response.data.messages || [];
    const results = [];

    for (const message of messages) {
      try {
        const messageResponse = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full'
        });

        const messageData = messageResponse.data;
        const headers = messageData.payload?.headers || [];
        const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

        const parsedEmail = {
          messageId: messageData.id!,
          threadId: messageData.threadId!,
          from: getHeader('from') || '',
          to: (getHeader('to') || '').split(',').map(addr => addr.trim()),
          cc: (getHeader('cc') || '').split(',').map(addr => addr.trim()).filter(Boolean),
          bcc: (getHeader('bcc') || '').split(',').map(addr => addr.trim()).filter(Boolean),
          subject: getHeader('subject') || '(No Subject)',
          snippet: messageData.snippet || '',
          body: {
            text: messageData.snippet || '',
            html: ''
          },
          date: new Date(parseInt(messageData.internalDate!)).toISOString()
        };

        // Create ticket from parsed email
        const ticketResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/create-ticket`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            parsedEmail,
            userId
          })
        });

        if (!ticketResponse.ok) {
          throw new Error('Failed to create ticket');
        }

        const ticket = await ticketResponse.json();
        results.push({
          success: true,
          messageId: message.id,
          ticketId: ticket.id
        });
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        results.push({
          success: false,
          messageId: message.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return res.status(200).json({
      total: messages.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    });
  } catch (error: any) {
    console.error('Error importing initial emails:', error);
    return res.status(error.code || 500).json({ error: error.message });
  }
} 