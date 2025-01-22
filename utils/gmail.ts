import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { getTestSupabaseClient } from '../__tests__/utils/test-setup';
import { GmailMessage, GmailProfile, GmailTokens, ParsedEmail } from '../types/gmail';
import { Database } from '../types/supabase';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

// Verify environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables for Supabase');
}

// Initialize Supabase client
const supabase = process.env.NODE_ENV === 'test' 
  ? getTestSupabaseClient()
  : createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface GmailMessagePart {
  mimeType?: string | null;
  body?: {
    data?: string | null;
  } | null;
  parts?: GmailMessagePart[] | null;
}

const extractBody = (part: GmailMessagePart): string | null => {
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64').toString();
  }
  if (part.parts) {
    for (const subPart of part.parts) {
      const body = extractBody(subPart);
      if (body) return body;
    }
  }
  return null;
};

// Enhance logger with more detailed logging
const logger = {
  info: async (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [Gmail Service] ${message}`;
    console.log(logMessage, data || '');
    try {
      await supabase.from('audit_logs').insert({
        action: 'gmail_service_info',
        description: message,
        metadata: {
          ...data,
          timestamp,
          environment: process.env.NODE_ENV
        },
        created_at: timestamp,
        status: 'success'
      });
    } catch (error) {
      console.error('Failed to log info:', error);
    }
  },
  error: async (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [Gmail Service] ERROR: ${message}`;
    console.error(logMessage, error || '');
    try {
      await supabase.from('audit_logs').insert({
        action: 'gmail_service_error',
        description: message,
        metadata: {
          error: error ? JSON.stringify(error) : undefined,
          stack: error?.stack,
          timestamp,
          environment: process.env.NODE_ENV
        },
        created_at: timestamp,
        status: 'error',
        error_stack: error?.stack
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }
};

export async function getGmailProfile(tokens: GmailTokens): Promise<GmailProfile> {
  try {
    console.log('Fetching Gmail profile...');
    const response = await fetch(`${API_BASE_URL}/api/gmail/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      }),
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        console.log('Access token expired, attempting to refresh...');
        const newTokens = await refreshGmailTokens(tokens.refresh_token);
        return getGmailProfile(newTokens);
      }
      throw new Error(`Failed to fetch Gmail profile: ${response.statusText}`);
    }
    
    const profile = await response.json();
    console.log('Successfully fetched Gmail profile');
    return profile;
  } catch (error) {
    console.error('Error fetching Gmail profile:', error);
    throw error;
  }
}

export async function pollGmailInbox(tokens: GmailTokens): Promise<GmailMessage[]> {
  try {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logger.info('Access token expired, refreshing...');
        const newTokens = await refreshGmailTokens(tokens.refresh_token);
        return pollGmailInbox(newTokens);
      }
      throw new Error(`Failed to fetch Gmail messages: ${response.statusText}`);
    }

    const data = await response.json();
    return data.messages || [];
  } catch (error) {
    logger.error('Error polling Gmail inbox', error);
    throw error;
  }
}

export function parseGmailMessage(message: GmailMessage): ParsedEmail {
  logger.info('Parsing message', { messageId: message.id });

  const parsedEmail: ParsedEmail = {
    messageId: message.id,
    threadId: message.threadId,
    subject: message.subject || '',
    from: Array.isArray(message.from) ? message.from[0] : message.from,
    to: Array.isArray(message.to) ? message.to[0] : message.to,
    date: new Date(message.date),
    body: message.body || { text: '', html: '' },
    snippet: message.snippet || '',
    labels: message.labelIds || [],
    attachments: message.attachments || []
  };

  logger.info('Successfully parsed message', { messageId: message.id });
  return parsedEmail;
}

export async function refreshGmailTokens(refreshToken: string): Promise<GmailTokens> {
  try {
    console.log('Refreshing Gmail tokens...');
    const response = await fetch('/api/gmail/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Successfully refreshed Gmail tokens');

    // Update tokens in database
    const { data: orgs } = await supabase
      .from('organizations')
      .update({
        gmail_access_token: data.access_token,
      })
      .eq('gmail_refresh_token', refreshToken);

    const { data: profiles } = await supabase
      .from('profiles')
      .update({
        gmail_access_token: data.access_token,
      })
      .eq('gmail_refresh_token', refreshToken);

    return {
      access_token: data.access_token,
      refresh_token: refreshToken,
      token_type: data.token_type,
      scope: data.scope,
      expiry_date: Date.now() + (data.expires_in * 1000)
    };
  } catch (error) {
    console.error('Error refreshing Gmail tokens:', error);
    throw error;
  }
}

export async function addGmailLabel(messageId: string, labelName: string, tokens: GmailTokens) {
  try {
    console.log(`Adding label "${labelName}" to message ${messageId}...`);
    const response = await fetch('/api/gmail/label', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messageId,
        labelName,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.log('Access token expired, attempting to refresh...');
        const newTokens = await refreshGmailTokens(tokens.refresh_token);
        return addGmailLabel(messageId, labelName, newTokens);
      }
      throw new Error(`Failed to add Gmail label: ${response.statusText}`);
    }

    console.log(`Successfully added label "${labelName}" to message ${messageId}`);
  } catch (error) {
    console.error('Error adding Gmail label:', error);
    throw error;
  }
}

export async function getMessageContent(messageId: string, tokens: GmailTokens): Promise<string | null> {
  try {
    const response = await fetch('/api/gmail/content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messageId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.log('Access token expired, attempting to refresh...');
        const newTokens = await refreshGmailTokens(tokens.refresh_token);
        return getMessageContent(messageId, newTokens);
      }
      throw new Error(`Failed to get message content: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error('Error getting message content:', error);
    return null;
  }
}

export async function createTicketFromEmail(parsedEmail: ParsedEmail, userId: string) {
  try {
    logger.info(`Creating ticket from email: ${parsedEmail.messageId}`, { subject: parsedEmail.subject });
    
    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', userId)
      .single();
      
    if (!profile?.org_id) {
      throw new Error('User organization not found');
    }

    // Create ticket with metadata as JSON string
    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({
        subject: parsedEmail.subject,
        description: parsedEmail.body.text || parsedEmail.snippet,
        status: 'open',
        priority: 'medium',
        customer_id: userId,
        org_id: profile.org_id,
        metadata: JSON.stringify({
          email_message_id: parsedEmail.messageId,
          email_thread_id: parsedEmail.threadId,
          email_from: parsedEmail.from,
          email_to: parsedEmail.to,
          email_date: parsedEmail.date
        })
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create ticket', error);
      throw error;
    }

    logger.info(`Successfully created ticket from email`, { ticketId: ticket.id });
    return ticket;
  } catch (error) {
    logger.error('Error in createTicketFromEmail', error);
    throw error;
  }
}

export async function pollAndCreateTickets(userId: string): Promise<any[]> {
  await logger.info(`Starting email polling for user { userId: '${userId}' }`);

  try {
    // Get user's Gmail tokens
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('gmail_access_token, gmail_refresh_token, email, org_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      throw new Error('Failed to fetch user profile');
    }

    if (!profile || !profile.gmail_access_token || !profile.gmail_refresh_token) {
      throw new Error('Gmail not connected');
    }

    const tokens: GmailTokens = {
      access_token: profile.gmail_access_token,
      refresh_token: profile.gmail_refresh_token,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/gmail.modify',
      expiry_date: Date.now() + (3600 * 1000) // Default 1 hour expiry
    };

    try {
      const messages = await pollGmailInbox(tokens);
      const tickets = [];

      for (const message of messages) {
        try {
          const parsedEmail = parseGmailMessage(message);
          const ticket = await createTicketFromEmail(parsedEmail, userId);
          if (ticket) {
            tickets.push(ticket);
          }
        } catch (error) {
          await logger.error('Error creating ticket from email', error);
        }
      }

      return tickets;
    } catch (error: any) {
      if (error.message.includes('401')) {
        await logger.info('Access token expired, refreshing...');
        const newTokens = await refreshGmailTokens(tokens.refresh_token);
        return pollAndCreateTickets(userId);
      }
      if (error.response?.status === 500) {
        throw new Error('Failed to fetch Gmail messages: Internal Server Error');
      }
      throw error;
    }
  } catch (error: any) {
    await logger.error('Error in pollAndCreateTickets', error);
    throw error;
  }
}

export async function fetchLastTenEmails(tokens: GmailTokens): Promise<GmailMessage[]> {
  try {
    logger.info('Fetching last 10 emails');
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.statusText}`);
    }

    const data = await response.json();
    const messages: GmailMessage[] = [];

    for (const message of data.messages || []) {
      const messageResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        }
      );

      if (messageResponse.ok) {
        const messageData = await messageResponse.json();
        messages.push(messageData);
      }
    }

    logger.info(`Successfully fetched ${messages.length} emails`);
    return messages;
  } catch (error) {
    logger.error('Error fetching last 10 emails', error);
    throw error;
  }
}

export async function importInitialEmails(userId: string, tokens: GmailTokens) {
  try {
    logger.info('Starting initial email import', { userId });
    
    // Fetch the last 10 emails
    const messages = await fetchLastTenEmails(tokens);
    
    // Create tickets from these emails
    for (const message of messages) {
      const parsedEmail = parseGmailMessage(message);
      await createTicketFromEmail(parsedEmail, userId);
    }
    
    logger.info('Completed initial email import', { 
      userId, 
      emailCount: messages.length 
    });
  } catch (error) {
    logger.error('Error during initial email import', error);
    throw error;
  }
} 