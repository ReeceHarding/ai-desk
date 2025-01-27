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
  // Add request ID for tracing
  const requestId = Math.random().toString(36).substring(7);
  const log = (message: string, data?: any) => {
    console.log(`[${requestId}] ${message}`, data || '');
  };

  if (req.method !== 'POST') {
    log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      log('Missing user ID');
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get user's Gmail tokens
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('gmail_access_token, gmail_refresh_token, email, org_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      log('Failed to fetch user profile:', profileError);
      throw new Error('Failed to fetch user profile');
    }

    if (!profile || !profile.gmail_access_token || !profile.gmail_refresh_token) {
      log('Gmail not connected for user:', userId);
      throw new Error('Gmail not connected');
    }

    const tokens: GmailTokens = {
      access_token: profile.gmail_access_token,
      refresh_token: profile.gmail_refresh_token,
      expiry_date: Date.now() + (3600 * 1000) // Default 1 hour expiry
    };

    log('Initializing Gmail client');
    const gmail = await getGmailClient(tokens);
    
    log('Fetching messages');
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10
    });

    const messages = response.data.messages || [];
    const tickets = [];

    log(`Processing ${messages.length} messages`);
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

        log(`Creating ticket for message ${messageData.id}`);
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
          const errorData = await ticketResponse.json();
          log(`Failed to create ticket for message ${messageData.id}:`, errorData);
          throw new Error(`Failed to create ticket: ${errorData.error || 'Unknown error'}`);
        }

        const ticket = await ticketResponse.json();
        tickets.push(ticket);
        log(`Successfully created ticket for message ${messageData.id}`);
      } catch (error) {
        log(`Error processing message ${message.id}:`, error);
        console.error(`Error processing message ${message.id}:`, error);
      }
    }

    log(`Successfully processed ${tickets.length} tickets`);
    return res.status(200).json(tickets);
  } catch (error: any) {
    log('Error polling and creating tickets:', error);
    console.error('Error polling and creating tickets:', error);
    return res.status(error.code || 500).json({ 
      error: error.message,
      requestId // Include request ID for debugging
    });
  }
} 