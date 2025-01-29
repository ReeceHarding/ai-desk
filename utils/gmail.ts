import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { resolve } from 'path';
import { GmailMessage, GmailProfile, GmailTokens, ParsedEmail } from '../types/gmail';
import { Database } from '../types/supabase';
import { logger } from './logger';

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

const extractHtmlBody = (part: GmailMessagePart): string | null => {
  if (part.mimeType === 'text/html' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64').toString();
  }
  if (part.parts) {
    for (const subPart of part.parts) {
      const body = extractHtmlBody(subPart);
      if (body) return body;
    }
  }
  return null;
};

interface LogData {
  [key: string]: any;
}

// Helper function to format error for logging
const formatError = (error: unknown): LogData => {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name
    };
  }
  return { error: String(error) };
};

// Gmail-specific logger with audit logging
const gmailLogger = {
  info: async (message: string, data?: LogData): Promise<void> => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [Gmail Service] ${message}`;
    logger.info(logMessage, data);
    try {
      await supabase.from('audit_logs').insert({
        action: 'gmail_service_info',
        description: message,
        metadata: {
          ...(data || {}),
          timestamp,
          environment: process.env.NODE_ENV
        }
      });
    } catch (error) {
      logger.error('Failed to log to audit_logs', formatError(error));
    }
  },
  error: async (message: string, error?: unknown): Promise<void> => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [Gmail Service] ERROR: ${message}`;
    const formattedError = formatError(error);
    logger.error(logMessage, formattedError);
    try {
      await supabase.from('audit_logs').insert({
        action: 'gmail_service_error',
        description: message,
        metadata: {
          ...formattedError,
          timestamp,
          environment: process.env.NODE_ENV
        }
      });
    } catch (logError) {
      logger.error('Failed to log to audit_logs', formatError(logError));
    }
  },
  warn: async (message: string, data?: LogData): Promise<void> => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [Gmail Service] WARN: ${message}`;
    logger.warn(logMessage, data);
    try {
      await supabase.from('audit_logs').insert({
        action: 'gmail_service_warn',
        description: message,
        metadata: {
          ...(data || {}),
          timestamp,
          environment: process.env.NODE_ENV
        }
      });
    } catch (error) {
      logger.error('Failed to log to audit_logs', formatError(error));
    }
  }
};

// Cache object to store Gmail profiles
const profileCache: {
  [key: string]: {
    profile: GmailProfile;
    timestamp: number;
  };
} = {};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getGmailProfile(tokens: GmailTokens): Promise<GmailProfile> {
  try {
    // Check cache first
    const cacheKey = tokens.access_token;
    const now = Date.now();
    const cached = profileCache[cacheKey];

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      console.log('Returning cached Gmail profile');
      return cached.profile;
    }

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

    // Cache the profile
    profileCache[cacheKey] = {
      profile,
      timestamp: now,
    };

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
        await gmailLogger.info('Access token expired, refreshing...');
        const newTokens = await refreshGmailTokens(tokens.refresh_token);
        return pollGmailInbox(newTokens);
      }
      throw new Error(`Failed to fetch Gmail messages: ${response.statusText}`);
    }

    const data = await response.json();
    return data.messages || [];
  } catch (error) {
    gmailLogger.error('Error polling Gmail inbox', error);
    throw error;
  }
}

// Helper function to ensure date is in string format
const formatDate = (date: Date): string => date.toISOString();

export async function parseGmailMessage(message: GmailMessage): Promise<ParsedEmail> {
  const headers = message.payload.headers;
  const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

  const attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }> = [];

  const plainTextBody = extractBody(message.payload);
  const htmlBody = extractHtmlBody(message.payload);

  const fromHeader = getHeader('from');
  // Updated regex to better handle email formats
  const fromMatch = fromHeader.match(/^(?:(?:"?([^"]*)"?\s*)?(?:<(.+@[^>]+)>)|(.+@\S+))/i);
  const senderName = fromMatch?.[1]?.trim() || '';
  const senderEmail = fromMatch?.[2]?.trim() || fromMatch?.[3]?.trim() || fromHeader;

  console.log('Parsed email sender info:', {
    fromHeader,
    fromMatch,
    senderName,
    senderEmail,
    displayName: senderName || senderEmail.split('@')[0]
  });

  // If no name was found, use the local part of the email as a fallback
  const displayName = senderName || senderEmail.split('@')[0];

  const to = getHeader('to');
  const cc = getHeader('cc');
  const bcc = getHeader('bcc');
  const subject = getHeader('subject');
  const date = new Date(getHeader('date'));

  // Parse email addresses
  const parseAddresses = (addressStr: string): string[] => {
    if (!addressStr) return [];
    return addressStr.split(',').map(addr => addr.trim());
  };

  return {
    id: message.id,
    threadId: message.threadId,
    historyId: message.historyId,
    from: getHeader('from'),
    to: getHeader('to').split(',').map(addr => addr.trim()),
    cc: getHeader('cc') ? getHeader('cc').split(',').map(addr => addr.trim()) : [],
    bcc: getHeader('bcc') ? getHeader('bcc').split(',').map(addr => addr.trim()) : [],
    subject: getHeader('subject'),
    date: message.internalDate,
    bodyText: plainTextBody || '',
    bodyHtml: htmlBody || '',
    attachments,
    raw: message.raw
  };
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
    gmailLogger.info(`Creating ticket from email: ${parsedEmail.id}`, { 
      subject: parsedEmail.subject,
      from: parsedEmail.from,
      to: parsedEmail.to
    });
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();
      
    if (profileError) {
      gmailLogger.error('Failed to fetch user profile', { userId, error: profileError });
      throw profileError;
    }

    // Validate required fields
    if (!parsedEmail.subject && !parsedEmail.bodyText) {
      gmailLogger.warn('Email missing subject and body text, using default subject');
      parsedEmail.subject = '(No Subject)';
    }

    const senderName = parsedEmail.from.match(/^([^<]+)/)?.[1]?.trim() || parsedEmail.from;

    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({
        subject: parsedEmail.subject || '(No Subject)',
        description: parsedEmail.bodyText || parsedEmail.bodyHtml || '',
        status: 'open',
        priority: 'medium',
        customer_id: userId,
        org_id: profile.org_id,
        metadata: JSON.stringify({
          email_message_id: parsedEmail.id,
          email_thread_id: parsedEmail.threadId,
          email_from: parsedEmail.from,
          email_to: parsedEmail.to.join(', '),
          email_cc: parsedEmail.cc?.join(', ') || '',
          email_bcc: parsedEmail.bcc?.join(', ') || ''
        })
      })
      .select()
      .single();

    if (error) {
      gmailLogger.error('Failed to create ticket', { error });
      throw error;
    }

    const { error: chatError } = await supabase
      .from('ticket_email_chats')
      .insert({
        ticket_id: ticket.id,
        message_id: parsedEmail.id,
        thread_id: parsedEmail.threadId,
        from_name: senderName,
        from_address: parsedEmail.from,
        to_address: parsedEmail.to,
        cc_address: parsedEmail.cc || [],
        bcc_address: parsedEmail.bcc || [],
        subject: parsedEmail.subject,
        body: parsedEmail.bodyText || parsedEmail.bodyHtml || '',
        attachments: {},
        gmail_date: new Date(parsedEmail.date).toISOString(),
        org_id: profile.org_id,
        ai_classification: 'unknown',
        ai_confidence: 0,
        ai_auto_responded: false,
        ai_draft_response: null
      });

    if (chatError) {
      gmailLogger.error('Failed to create ticket_email_chats record', { error: chatError });
      // Don't throw here, as we still want to return the ticket
    }

    gmailLogger.info('Successfully created ticket from email', {
      ticketId: ticket.id,
      emailId: parsedEmail.id,
      subject: parsedEmail.subject
    });

    return ticket;
  } catch (error) {
    gmailLogger.error('Error in createTicketFromEmail', {
      error,
      messageId: parsedEmail.id
    });
    throw error;
  }
}

export async function pollAndCreateTickets(userId: string): Promise<any[]> {
  await gmailLogger.info(`Starting email polling for user { userId: '${userId}' }`);

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('gmail_access_token, gmail_refresh_token')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('Failed to get user profile');
    }

    const tokens: GmailTokens = {
      access_token: profile.gmail_access_token!,
      refresh_token: profile.gmail_refresh_token!,
      scope: 'https://www.googleapis.com/auth/gmail.modify',
      token_type: 'Bearer',
      expiry_date: Date.now() + 3600000 // 1 hour from now
    };

    try {
      const messages = await pollGmailInbox(tokens);
      const results = [];

      for (const message of messages) {
        try {
          const parsedEmail = await parseGmailMessage(message);
          const ticket = await createTicketFromEmail(parsedEmail, userId);
          results.push({ success: true, ticket });
        } catch (error) {
          await gmailLogger.error('Error creating ticket from email', error);
          results.push({ success: false, error });
        }
      }

      return results;
    } catch (error: any) {
      if (error.message.includes('401')) {
        await gmailLogger.info('Access token expired, refreshing...');
        const newTokens = await refreshGmailTokens(tokens.refresh_token);
        return pollAndCreateTickets(userId);
      }
      throw error;
    }
  } catch (error: any) {
    await gmailLogger.error('Error in pollAndCreateTickets', error);
    throw error;
  }
}

export async function fetchLastTenEmails(tokens: GmailTokens): Promise<GmailMessage[]> {
  try {
    gmailLogger.info('Fetching last 10 emails');
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

    gmailLogger.info(`Successfully fetched ${messages.length} emails`);
    return messages;
  } catch (error) {
    gmailLogger.error('Error fetching last 10 emails', error);
    throw error;
  }
}

export async function importInitialEmails(userId: string, tokens: GmailTokens) {
  try {
    await gmailLogger.info('Starting initial email import', { userId });
    
    // Fetch last 10 emails
    const messages = await fetchLastTenEmails(tokens);
    await gmailLogger.info('Fetched initial emails', { count: messages.length });
    
    // Process each message
    const results = await Promise.allSettled(
      messages.map(async (message) => {
        try {
          const parsedEmail = await parseGmailMessage(message);
          await createTicketFromEmail(parsedEmail, userId);
          return { success: true, messageId: message.id };
        } catch (error) {
          await gmailLogger.error(`Failed to process message ${message.id}`, error);
          return { success: false, messageId: message.id, error };
        }
      })
    );
    
    // Log results
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
    
    await gmailLogger.info('Completed initial email import', {
      total: messages.length,
      successful,
      failed,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
    });
    
    return results;
  } catch (error) {
    await gmailLogger.error('Failed to import initial emails', error);
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

interface SendGmailReplyParams {
  threadId: string;
  inReplyTo: string;
  to: string[];
  subject: string;
  htmlBody: string;
}

/**
 * Send a Gmail reply in an existing thread
 */
export async function sendGmailReply({
  threadId,
  inReplyTo,
  to,
  subject,
  htmlBody,
}: SendGmailReplyParams): Promise<void> {
  try {
    // Get organization's Gmail tokens
    const { data: org } = await supabase
      .from('organizations')
      .select('gmail_access_token, gmail_refresh_token')
      .single();

    if (!org?.gmail_access_token) {
      throw new Error('No Gmail access token found');
    }

    // Construct email in RFC 2822 format
    const email = [
      `To: ${to.join(', ')}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `References: ${inReplyTo}`,
      `In-Reply-To: ${inReplyTo}`,
      '',
      htmlBody
    ].join('\r\n');

    // Base64 encode the email
    const encodedEmail = Buffer.from(email).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send via Gmail API
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${org.gmail_access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encodedEmail,
          threadId,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, refresh and retry
        const newTokens = await refreshGmailTokens(org.gmail_refresh_token);
        return sendGmailReply({
          threadId,
          inReplyTo,
          to,
          subject,
          htmlBody,
        });
      }
      throw new Error(`Failed to send email: ${response.statusText}`);
    }

    gmailLogger.info('Sent Gmail reply', { threadId, to });
  } catch (error) {
    gmailLogger.error('Error sending Gmail reply', { error });
    throw error;
  }
}

/**
 * Get a configured Gmail client using organization tokens
 * This assumes you're using organization-level Gmail integration
 */
export async function getGmailClient() {
  try {
    // Get organization's Gmail tokens
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('gmail_access_token, gmail_refresh_token')
      .single();

    if (orgError || !org) {
      gmailLogger.error('Failed to get organization tokens', { error: orgError });
      throw new Error('Failed to get organization tokens');
    }

    const { gmail_access_token, gmail_refresh_token } = org;

    if (!gmail_access_token || !gmail_refresh_token) {
      gmailLogger.error('Gmail tokens not found in organization');
      throw new Error('Gmail tokens not configured');
    }

    // Set up Gmail OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: gmail_access_token,
      refresh_token: gmail_refresh_token,
    });

    // Create and return Gmail client
    return google.gmail({ version: 'v1', auth: oauth2Client });
  } catch (error: any) {
    gmailLogger.error('Failed to initialize Gmail client', { error: error.message });
    throw error;
  }
} 