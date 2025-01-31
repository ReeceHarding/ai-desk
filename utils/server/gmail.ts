import { createClient } from '@supabase/supabase-js';
import { gmail_v1, google } from 'googleapis';
import { GmailMessage, GmailMessagePart, GmailTokens } from '../../types/gmail';
import { Database } from '../../types/supabase';
import { processPotentialPromotionalEmail } from '../agent/gmailPromotionAgent';
import { logger } from '../logger';

// Initialize Supabase client with service role key
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Helper function to format errors for logging
 */
function formatError(error: unknown): Record<string, any> {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }
  return { message: String(error) };
}

/**
 * Gmail logger with structured logging
 */
export const gmailLogger = {
  info: async (message: string, data?: Record<string, any>): Promise<void> => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [Gmail Service] INFO: ${message}`;
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
  warn: async (message: string, data?: Record<string, any>): Promise<void> => {
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

/**
 * Get a configured Gmail client using organization tokens
 */
export async function getGmailClient(orgId: string) {
  try {
    // Get organization's Gmail tokens
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('gmail_access_token, gmail_refresh_token')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      logger.error('Failed to get organization tokens', { error: orgError });
      throw new Error('Failed to get organization tokens');
    }

    const { gmail_access_token, gmail_refresh_token } = org;

    if (!gmail_access_token || !gmail_refresh_token) {
      logger.error('Gmail tokens not found in organization', { orgId });
      throw new Error('Gmail tokens not configured');
    }

    // Set up Gmail OAuth2 client with proper credentials
    const oauth2Client = new google.auth.OAuth2({
      clientId: process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      redirectUri: process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
    });

    // Set credentials
    oauth2Client.setCredentials({
      access_token: gmail_access_token,
      refresh_token: gmail_refresh_token,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/gmail.modify'
    });

    // Create and return Gmail client
    const gmail = google.gmail({ 
      version: 'v1', 
      auth: oauth2Client 
    });

    return gmail;
  } catch (error: any) {
    logger.error('Failed to initialize Gmail client', { 
      error: error.message,
      orgId 
    });
    throw error;
  }
}

/**
 * Send a reply to a Gmail thread
 */
export async function sendGmailReply(params: {
  threadId: string;
  inReplyTo: string;
  to: string[];
  subject: string;
  htmlBody: string;
  orgId: string;
}) {
  try {
    const gmail = await getGmailClient(params.orgId);

    // Create the email message
    const message = [
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `To: ${params.to.join(', ')}`,
      `Subject: ${params.subject}`,
      `In-Reply-To: ${params.inReplyTo}`,
      `References: ${params.inReplyTo}`,
      `Thread-Id: ${params.threadId}`,
      '',
      params.htmlBody
    ].join('\r\n');

    // Encode the message
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        threadId: params.threadId,
      },
    });

    if (!response.data.id) {
      throw new Error('Failed to send email: No message ID returned');
    }

    logger.info('Sent Gmail reply', {
      messageId: response.data.id,
      threadId: params.threadId,
      inReplyTo: params.inReplyTo,
    });

    return response.data;
  } catch (error) {
    logger.error('Failed to send Gmail reply', { error });
    throw error;
  }
}

// Helper function to get header value
function getHeader(message: gmail_v1.Schema$Message, name: string): string {
  return message.payload?.headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

// Helper function to extract text body
function extractBody(part: gmail_v1.Schema$MessagePart): string {
  if (!part) return '';
  
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64').toString();
  }

  if (part.parts) {
    for (const subPart of part.parts) {
      if (subPart) {
        const body = extractBody(subPart);
        if (body) return body;
      }
    }
  }

  return '';
}

// Helper function to extract HTML body
function extractHtmlBody(part: gmail_v1.Schema$MessagePart): string {
  if (!part) return '';
  
  if (part.mimeType === 'text/html' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64').toString();
  }

  if (part.parts) {
    for (const subPart of part.parts) {
      if (subPart) {
        const body = extractHtmlBody(subPart);
        if (body) return body;
      }
    }
  }

  return '';
}

function convertMessagePart(part: gmail_v1.Schema$MessagePart): GmailMessagePart {
  const defaultPart: GmailMessagePart = {
    mimeType: 'text/plain',
    headers: [],
    body: {},
    parts: []
  };

  if (!part) return defaultPart;

  return {
    mimeType: part.mimeType || defaultPart.mimeType,
    headers: part.headers?.map(h => ({
      name: h.name || '',
      value: h.value || ''
    })) || defaultPart.headers,
    body: {
      attachmentId: part.body?.attachmentId || undefined,
      size: typeof part.body?.size === 'number' ? part.body.size : undefined,
      data: part.body?.data || undefined
    },
    parts: part.parts
      ?.filter((p): p is gmail_v1.Schema$MessagePart => !!p)
      .map(p => convertMessagePart(p)) || defaultPart.parts
  };
}

/**
 * Poll Gmail inbox for new messages
 */
export async function pollGmailInbox(tokens: GmailTokens): Promise<GmailMessage[]> {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 50
    });

    return (response.data.messages || []).map(msg => ({
      id: msg.id || '',
      threadId: msg.threadId || '',
      labelIds: msg.labelIds || [],
      snippet: msg.snippet || '',
      historyId: msg.historyId || '',
      internalDate: msg.internalDate || '',
      payload: msg.payload ? convertMessagePart(msg.payload) : {
        mimeType: 'text/plain',
        headers: [],
        body: {},
        parts: []
      },
      sizeEstimate: msg.sizeEstimate || 0,
    }));
  } catch (error) {
    gmailLogger.error('Error polling Gmail inbox', { error });
    throw error;
  }
}

interface ParsedEmail {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: GmailMessagePart;
  sizeEstimate: number;
  raw: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  date: string;
  textBody: string;
  htmlBody: string;
}

/**
 * Parse a Gmail message into a more usable format
 */
export function parseGmailMessage(message: gmail_v1.Schema$Message): ParsedEmail {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

  const subject = getHeader('subject');
  const from = getHeader('from');
  const to = getHeader('to').split(',').map(addr => addr.trim()).filter(Boolean);
  const cc = getHeader('cc').split(',').map(addr => addr.trim()).filter(Boolean);
  const bcc = getHeader('bcc').split(',').map(addr => addr.trim()).filter(Boolean);
  const date = getHeader('date');

  let textBody = '';
  let htmlBody = '';

  const defaultPayload: GmailMessagePart = {
    mimeType: 'text/plain',
    headers: [],
    body: {},
    parts: []
  };

  if (message.payload) {
    const payload = message.payload as gmail_v1.Schema$MessagePart;
    textBody = extractBody(payload);
    htmlBody = extractHtmlBody(payload);
    return {
      id: message.id || '',
      threadId: message.threadId || '',
      labelIds: message.labelIds || [],
      snippet: message.snippet || '',
      historyId: message.historyId || '',
      internalDate: message.internalDate || '',
      payload: convertMessagePart(payload),
      sizeEstimate: message.sizeEstimate || 0,
      raw: message.raw || '',
      subject,
      from,
      to,
      cc,
      bcc,
      date,
      textBody,
      htmlBody
    };
  }

  return {
    id: message.id || '',
    threadId: message.threadId || '',
    labelIds: message.labelIds || [],
    snippet: message.snippet || '',
    historyId: message.historyId || '',
    internalDate: message.internalDate || '',
    payload: defaultPayload,
    sizeEstimate: message.sizeEstimate || 0,
    raw: message.raw || '',
    subject,
    from,
    to,
    cc,
    bcc,
    date,
    textBody,
    htmlBody
  };
}

/**
 * Create a ticket from an email
 */
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

    gmailLogger.info('Found user profile', { userId, orgId: profile.org_id });

    // Validate required fields
    if (!parsedEmail.subject && !parsedEmail.textBody) {
      gmailLogger.warn('Email missing subject and body text, using default subject');
      parsedEmail.subject = '(No Subject)';
    }

    const senderName = parsedEmail.from.match(/^([^<]+)/)?.[1]?.trim() || parsedEmail.from;

    gmailLogger.info('Creating ticket in database', {
      subject: parsedEmail.subject,
      from: parsedEmail.from,
      threadId: parsedEmail.threadId,
      orgId: profile.org_id
    });

    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({
        subject: parsedEmail.subject || '(No Subject)',
        description: parsedEmail.textBody || parsedEmail.htmlBody || '',
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

    gmailLogger.info('Successfully created ticket', { 
      ticketId: ticket.id,
      subject: ticket.subject,
      threadId: parsedEmail.threadId
    });

    // Ensure we have a valid date for gmail_date
    let gmailDate: string;
    try {
      // Handle different date formats
      if (typeof parsedEmail.date === 'string') {
        if (/^\d+$/.test(parsedEmail.date)) {
          // If it's a Unix timestamp (milliseconds)
          gmailDate = new Date(parseInt(parsedEmail.date)).toISOString();
        } else {
          // If it's an ISO string or other date string
          gmailDate = new Date(parsedEmail.date).toISOString();
        }
      } else {
        // Fallback to current time
        gmailDate = new Date().toISOString();
      }
    } catch (error) {
      // If there's any error parsing the date, use current time
      gmailLogger.warn('Invalid date format, using current time', { 
        date: parsedEmail.date,
        error 
      });
      gmailDate = new Date().toISOString();
    }

    gmailLogger.info('Creating email chat entry', {
      ticketId: ticket.id,
      messageId: parsedEmail.id,
      threadId: parsedEmail.threadId
    });

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
        body: parsedEmail.textBody || parsedEmail.htmlBody || '',
        attachments: {},
        gmail_date: gmailDate,
        org_id: profile.org_id,
        ai_classification: 'unknown',
        ai_confidence: 0,
        ai_auto_responded: false,
        ai_draft_response: null
      });

    if (chatError) {
      gmailLogger.error('Failed to create email chat', { error: chatError });
      throw chatError;
    }

    gmailLogger.info('Successfully created email chat', {
      ticketId: ticket.id,
      messageId: parsedEmail.id,
      threadId: parsedEmail.threadId
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

/**
 * Set up Gmail watch for a mailbox
 */
export async function setupGmailWatch(tokens: GmailTokens, type: 'organization' | 'profile', id: string) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: ['INBOX'],
        topicName: process.env.GMAIL_PUBSUB_TOPIC,
      },
    });

    const { historyId, expiration } = response.data;

    if (!historyId) {
      throw new Error('Failed to set up watch: No history ID returned');
    }

    if (!expiration) {
      throw new Error('Failed to set up watch: No expiration returned');
    }

    // Generate a unique resource ID for this watch
    const resourceId = `watch_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    // Update the watch record in the database
    const { error: updateError } = await supabase
      .from(type === 'organization' ? 'organizations' : 'profiles')
      .update({
        gmail_watch_expiry: new Date(expiration).toISOString(),
        gmail_history_id: historyId,
        gmail_resource_id: resourceId,
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    return {
      ...response.data,
      resourceId,
    };
  } catch (error) {
    gmailLogger.error('Failed to set up Gmail watch', { error });
    throw error;
  }
}

/**
 * Refresh Gmail tokens
 */
export async function refreshGmailTokens(refreshToken: string): Promise<GmailTokens> {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const response = await oauth2Client.refreshAccessToken();
    const { credentials } = response;

    return {
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token || refreshToken,
      token_type: credentials.token_type || 'Bearer',
      scope: credentials.scope || '',
      expiry_date: credentials.expiry_date || 0
    };
  } catch (error) {
    gmailLogger.error('Failed to refresh Gmail tokens', { error });
    throw error;
  }
}

/**
 * Import initial emails from Gmail
 */
export async function importInitialEmails(userId: string) {
  try {
    // Get user profile to get org_id and tokens
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id, gmail_access_token, gmail_refresh_token')
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

    const messages = await pollGmailInbox(tokens);
    
    for (const message of messages) {
      try {
        const parsedEmail = await parseGmailMessage(message);
        const ticket = await createTicketFromEmail(parsedEmail, userId);
        
        // Process for promotional content
        await processPotentialPromotionalEmail(
          ticket.emailChatId,
          profile.org_id,
          parsedEmail.textBody || parsedEmail.htmlBody || '',
          message.id,
          parsedEmail.threadId,
          parsedEmail.from,
          parsedEmail.subject || ''
        );
      } catch (error) {
        gmailLogger.error('Failed to import email', { error, messageId: message.id });
      }
    }
  } catch (error) {
    gmailLogger.error('Failed to import initial emails', { error });
    throw error;
  }
}

export async function pollAndCreateTickets(userId: string): Promise<any[]> {
  await gmailLogger.info(`Starting email polling for user { userId: '${userId}' }`);

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('gmail_access_token, gmail_refresh_token, org_id')
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

export async function processGmailMessages(messages: GmailMessage[], userId: string) {
  const results: Array<{ success: boolean; messageId: string; error?: unknown }> = [];

  for (const message of messages) {
    try {
      const parsedEmail = await parseGmailMessage(message);
      const ticket = await createTicketFromEmail(parsedEmail, userId);
      results.push({ success: true, messageId: message.id });
    } catch (error) {
      results.push({ success: false, messageId: message.id, error });
    }
  }

  return results;
} 
