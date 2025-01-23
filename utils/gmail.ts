import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { GmailMessage, GmailProfile, GmailTokens, ParsedEmail } from '../types/gmail';
import { Database } from '../types/supabase';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

// Verify environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables for Supabase');
}

// Initialize Supabase client
const supabase = createClient<Database>(
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
  warn: async (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [Gmail Service] WARN: ${message}`;
    console.warn(logMessage, data || '');
    try {
      await supabase.from('audit_logs').insert({
        action: 'gmail_service_warning',
        description: message,
        metadata: {
          ...data,
          timestamp,
          environment: process.env.NODE_ENV
        },
        created_at: timestamp,
        status: 'warning'
      });
    } catch (error) {
      console.error('Failed to log warning:', error);
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
    subject: message.subject || '(No Subject)',
    from: Array.isArray(message.from) ? message.from[0] : (message.from || 'unknown@gmail.com'),
    to: Array.isArray(message.to) ? message.to[0] : (message.to || 'unknown@gmail.com'),
    date: message.date ? new Date(message.date) : new Date(),
    body: message.body || { text: '', html: '' },
    snippet: message.snippet || '',
    labels: message.labelIds || [],
    attachments: message.attachments || []
  };

  logger.info('Successfully parsed message', { 
    messageId: message.id,
    from: parsedEmail.from,
    to: parsedEmail.to,
    subject: parsedEmail.subject
  });
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
    logger.info(`Creating ticket from email: ${parsedEmail.messageId}`, { 
      subject: parsedEmail.subject,
      from: parsedEmail.from,
      to: parsedEmail.to
    });
    
    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', userId)
      .single();
      
    if (profileError) {
      logger.error('Failed to fetch user profile', { userId, error: profileError });
      throw profileError;
    }

    if (!profile?.org_id) {
      throw new Error('User organization not found');
    }

    // Validate required fields
    if (!parsedEmail.subject && !parsedEmail.snippet) {
      logger.warn('Email missing subject and snippet, using default subject');
      parsedEmail.subject = '(No Subject)';
    }

    // Create ticket with metadata as JSON string
    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({
        subject: parsedEmail.subject || '(No Subject)',
        description: parsedEmail.body.text || parsedEmail.snippet || 'No content',
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
      logger.error('Failed to create ticket', { 
        error,
        emailId: parsedEmail.messageId,
        subject: parsedEmail.subject
      });
      throw error;
    }

    // Store the email in ticket_email_chats
    const { error: chatError } = await supabase
      .from('ticket_email_chats')
      .insert({
        ticket_id: ticket.id,
        message_id: parsedEmail.messageId,
        thread_id: parsedEmail.threadId,
        from_address: parsedEmail.from,
        to_address: [parsedEmail.to],
        cc_address: [],
        bcc_address: [],
        subject: parsedEmail.subject || '(No Subject)',
        body: parsedEmail.body.html || parsedEmail.body.text || '',
        attachments: parsedEmail.attachments || {},
        gmail_date: parsedEmail.date instanceof Date && !isNaN(parsedEmail.date.getTime()) 
          ? parsedEmail.date.toISOString() 
          : new Date().toISOString(),
        org_id: profile.org_id
      } as any);

    if (chatError) {
      logger.error('Failed to store email in ticket_email_chats', {
        error: chatError,
        ticketId: ticket.id,
        emailId: parsedEmail.messageId
      });
      // Don't throw here, as we still want to return the ticket
    }

    logger.info(`Successfully created ticket from email`, { 
      ticketId: ticket.id,
      emailId: parsedEmail.messageId,
      subject: ticket.subject
    });
    
    return ticket;
  } catch (error) {
    logger.error('Error in createTicketFromEmail', {
      error: error instanceof Error ? error.message : String(error),
      emailId: parsedEmail.messageId,
      userId
    });
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
        const headers = messageData.payload.headers;
        const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value;
        const to = headers.find((h: any) => h.name.toLowerCase() === 'to')?.value;
        const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value;
        const date = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value;
        
        messages.push({
          ...messageData,
          from,
          to,
          subject,
          date: new Date(date).toISOString()
        });
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
    await logger.info('Starting initial email import', { userId });
    
    // Fetch last 10 emails
    const messages = await fetchLastTenEmails(tokens);
    await logger.info('Fetched initial emails', { count: messages.length });
    
    // Process each message
    const results = await Promise.allSettled(
      messages.map(async (message) => {
        try {
          const parsedEmail = parseGmailMessage(message);
          await createTicketFromEmail(parsedEmail, userId);
          return { success: true, messageId: message.id };
        } catch (error) {
          await logger.error(`Failed to process message ${message.id}`, error);
          return { success: false, messageId: message.id, error };
        }
      })
    );
    
    // Log results
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
    
    await logger.info('Completed initial email import', {
      total: messages.length,
      successful,
      failed,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
    });
    
    return results;
  } catch (error) {
    await logger.error('Failed to import initial emails', error);
    // Don't throw error - we want the OAuth flow to complete even if import fails
    return [];
  }
}

interface WatchResponse {
  historyId: string;
  expiration: string;
  resourceId: string;
}

/**
 * Sets up or refreshes a Gmail watch for a mailbox
 */
export async function setupOrRefreshWatch(
  tokens: GmailTokens, 
  type: 'organization' | 'profile', 
  id: string
): Promise<WatchResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/gmail/watch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        type,
        id
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        const newTokens = await refreshGmailTokens(tokens.refresh_token);
        return setupOrRefreshWatch(newTokens, type, id);
      }
      throw new Error(`Failed to setup watch: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error setting up Gmail watch:', error);
    throw error;
  }
}

/**
 * Stops watching a Gmail mailbox
 */
export async function stopWatch(tokens: GmailTokens, resourceId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/gmail/watch/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        resourceId
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        const newTokens = await refreshGmailTokens(tokens.refresh_token);
        return stopWatch(newTokens, resourceId);
      }
      throw new Error(`Failed to stop watch: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error stopping Gmail watch:', error);
    throw error;
  }
}

/**
 * Checks and refreshes watches that are about to expire
 */
export async function checkAndRefreshWatches(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/gmail/watch/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to check watches: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error checking Gmail watches:', error);
    throw error;
  }
}

export const setupGmailWatch = setupOrRefreshWatch; 