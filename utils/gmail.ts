import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { gmail_v1, google } from 'googleapis';
import { resolve } from 'path';
import { GmailMessage, GmailProfile, GmailTokens, ParsedEmail } from '../types/gmail';
import { Database } from '../types/supabase';
import { processPotentialPromotionalEmail } from './agent/gmailPromotionAgent';
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
    // logger.info(logMessage, data);
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
    // logger.warn(logMessage, data);
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
      // console.log('Returning cached Gmail profile');
      return cached.profile;
    }

    // console.log('Fetching Gmail profile...');
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
        // console.log('Access token expired, attempting to refresh...');
        const newTokens = await refreshGmailTokens(tokens.refresh_token);
        return getGmailProfile(newTokens);
      }
      throw new Error(`Failed to fetch Gmail profile: ${response.statusText}`);
    }
    
    const profile = await response.json();
    // console.log('Successfully fetched Gmail profile');

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

interface GmailListMessage {
  id: string;
  threadId?: string;
}

export async function pollGmailInbox(tokens: GmailTokens): Promise<GmailMessage[]> {
  try {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&format=full', {
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
    const messages = (data.messages || []) as GmailListMessage[];
    
    // Fetch full message details for each message
    const fullMessages = await Promise.all(messages.map(async (msg: GmailListMessage) => {
      const msgResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!msgResponse.ok) {
        throw new Error(`Failed to fetch message ${msg.id}: ${msgResponse.statusText}`);
      }
      return msgResponse.json();
    }));

    return fullMessages;
  } catch (error) {
    gmailLogger.error('Error polling Gmail inbox', error);
    throw error;
  }
}

// Helper function to ensure date is in string format
const formatDate = (date: Date): string => date.toISOString();

export async function parseGmailMessage(message: gmail_v1.Schema$Message): Promise<ParsedEmail | null> {
  try {
    if (!message.payload || !message.id || !message.threadId || !message.historyId) {
      // logger.warn('Missing required fields in Gmail message', {
      //   messageId: message.id,
      //   hasPayload: !!message.payload,
      //   hasThreadId: !!message.threadId,
      //   hasHistoryId: !!message.historyId
      // });
      return null;
    }

    const headers = message.payload.headers || [];
    const fromHeader = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
    const toHeader = headers.find(h => h.name?.toLowerCase() === 'to')?.value || '';
    const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '(No Subject)';
    const date = headers.find(h => h.name?.toLowerCase() === 'date')?.value || new Date().toISOString();
    const ccHeader = headers.find(h => h.name?.toLowerCase() === 'cc')?.value || '';
    const bccHeader = headers.find(h => h.name?.toLowerCase() === 'bcc')?.value || '';

    if (!fromHeader || !toHeader) {
      // logger.warn('Missing required header fields in Gmail message', {
      //   messageId: message.id,
      //   hasFrom: !!fromHeader,
      //   hasTo: !!toHeader
      // });
      return null;
    }

    // Split email addresses into arrays, but keep 'from' as a single string
    const to = toHeader.split(',').map(addr => addr.trim());
    const cc = ccHeader ? ccHeader.split(',').map(addr => addr.trim()) : [];
    const bcc = bccHeader ? bccHeader.split(',').map(addr => addr.trim()) : [];

    const parts = message.payload.parts || [];
    let bodyText = '';
    let bodyHtml = '';

    // Process message parts recursively
    const processPart = (part: gmail_v1.Schema$MessagePart) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }

      if (part.parts) {
        part.parts.forEach(processPart);
      }
    };

    processPart(message.payload);

    // If no parts were found, try to get the body from the payload directly
    if (!bodyText && !bodyHtml && message.payload.body?.data) {
      const body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
      if (message.payload.mimeType === 'text/html') {
        bodyHtml = body;
      } else {
        bodyText = body;
      }
    }

    // Ensure we have at least one form of body content
    if (!bodyText && !bodyHtml) {
      bodyText = '(No content)';
    }

    const result = {
      id: message.id,
      threadId: message.threadId,
      historyId: message.historyId,
      from: fromHeader,
      to,
      subject,
      date,
      cc,
      bcc,
      bodyText: bodyText || '(No plain text content)',
      bodyHtml: bodyHtml || '',
      attachments: [] // Add empty attachments array to match interface
    } as const;

    // Validate the result before returning
    if (!isValidParsedEmail(result)) {
      // logger.warn('Failed to create valid ParsedEmail object', {
      //   messageId: message.id
      // });
      return null;
    }

    return result;
  } catch (error) {
    logger.error('Error parsing Gmail message:', {
      error: error instanceof Error ? error.message : String(error),
      messageId: message.id
    });
    return null;
  }
}

export async function refreshGmailTokens(refreshToken: string): Promise<GmailTokens> {
  try {
    // console.log('Refreshing Gmail tokens...');
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
    // console.log('Successfully refreshed Gmail tokens');

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
    // console.log(`Adding label "${labelName}" to message ${messageId}...`);
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
        // console.log('Access token expired, attempting to refresh...');
        const newTokens = await refreshGmailTokens(tokens.refresh_token);
        return addGmailLabel(messageId, labelName, newTokens);
      }
      throw new Error(`Failed to add Gmail label: ${response.statusText}`);
    }

    // console.log(`Successfully added label "${labelName}" to message ${messageId}`);
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

    // Convert Gmail's internal date (Unix timestamp in milliseconds) to ISO string
    let gmailDate: string;
    try {
      const timestamp = typeof parsedEmail.date === 'string' ? parseInt(parsedEmail.date, 10) : parsedEmail.date;
      gmailDate = new Date(timestamp).toISOString();
    } catch (error) {
      gmailLogger.warn('Invalid date format, using current time', { 
        date: parsedEmail.date,
        error 
      });
      gmailDate = new Date().toISOString();
    }

    const { data: emailChat, error: chatError } = await supabase
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
        gmail_date: gmailDate,
        org_id: profile.org_id,
        ai_classification: 'unknown',
        ai_confidence: 0,
        ai_auto_responded: false,
        ai_draft_response: null
      })
      .select()
      .single();

    if (chatError) {
      gmailLogger.error('Failed to create email chat', { error: chatError });
      throw chatError;
    }

    return {
      ticket,
      emailChatId: emailChat.id
    };
  } catch (error) {
    gmailLogger.error('Error in createTicketFromEmail', {
      error,
      messageId: parsedEmail.id
    });
    throw error;
  }
}

/**
 * Type guard to check if a value is a valid ParsedEmail
 */
function isValidParsedEmail(email: unknown): email is ParsedEmail {
  if (!email || typeof email !== 'object') return false;
  
  const e = email as any;
  
  // Check all required fields are present and valid
  if (!e.id || typeof e.id !== 'string' ||
      !e.threadId || typeof e.threadId !== 'string' ||
      !e.historyId || typeof e.historyId !== 'string' ||
      !e.from || typeof e.from !== 'string' ||
      !e.subject || typeof e.subject !== 'string' ||
      !e.date || typeof e.date !== 'string' ||
      !e.bodyText || typeof e.bodyText !== 'string' ||
      !e.bodyHtml || typeof e.bodyHtml !== 'string') {
    return false;
  }

  // Ensure arrays are present and valid
  if (!Array.isArray(e.to) || !Array.isArray(e.cc) || !Array.isArray(e.bcc)) {
    return false;
  }

  // Ensure array elements are strings
  if (!e.to.every((x: any) => typeof x === 'string') ||
      !e.cc.every((x: any) => typeof x === 'string') ||
      !e.bcc.every((x: any) => typeof x === 'string')) {
    return false;
  }

  // Ensure attachments array is present
  if (!Array.isArray(e.attachments)) {
    return false;
  }

  // All checks passed
  return true;
}

export async function getThreadMessages(threadId: string, orgId: string): Promise<ParsedEmail[]> {
  try {
    const gmail = await getGmailClient(orgId);
    const response = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full'
    });

    const messages = response.data.messages || [];
    const parsedMessages: ParsedEmail[] = [];

    for (const message of messages) {
      const parsedEmailResult = await parseGmailMessage(message);
      if (isValidParsedEmail(parsedEmailResult)) {
        parsedMessages.push(parsedEmailResult);
      } else {
        logger.warn('Failed to parse or validate thread message', {
          messageId: message.id,
          threadId,
          orgId
        });
      }
    }

    return parsedMessages;
  } catch (error) {
    logger.error('Error fetching thread messages:', {
      error: error instanceof Error ? error.message : String(error),
      threadId,
      orgId
    });
    throw error;
  }
}

export async function processGmailMessages(messages: GmailMessage[], userId: string) {
  const results = [];

  for (const message of messages) {
    try {
      const parsedEmail = await parseGmailMessage(message);
      if (!parsedEmail) {
        logger.warn(`Failed to parse email ${message.id}`);
        results.push({
          success: false,
          messageId: message.id,
          error: 'Failed to parse email'
        });
        continue;
      }

      // At this point, TypeScript knows parsedEmail is a valid ParsedEmail
      const { ticket, emailChatId } = await createTicketFromEmail(parsedEmail, userId);
      
      // Process for promotional content
      const emailBody = parsedEmail.bodyText.length > 0 ? parsedEmail.bodyText : parsedEmail.bodyHtml;
      
      await processPotentialPromotionalEmail(
        emailChatId,
        ticket.org_id,
        emailBody,
        parsedEmail.id,
        parsedEmail.threadId,
        parsedEmail.from,
        parsedEmail.subject
      );

      results.push({
        success: true,
        messageId: parsedEmail.id
      });
    } catch (error) {
      logger.error('Error processing message:', {
        error: error instanceof Error ? error.message : String(error),
        messageId: message.id,
        userId
      });
      results.push({
        success: false,
        messageId: message.id,
        error: String(error)
      });
    }
  }

  return results;
}

export async function pollAndCreateTickets(userId: string): Promise<any[]> {
  try {
    // Get user's Gmail tokens
    const { data: user } = await supabase
      .from('profiles')
      .select('gmail_access_token, gmail_refresh_token')
      .eq('id', userId)
      .single();

    if (!user?.gmail_access_token || !user?.gmail_refresh_token) {
      throw new Error('Gmail tokens not found');
    }

    const tokens: GmailTokens = {
      access_token: user.gmail_access_token,
      refresh_token: user.gmail_refresh_token,
      expiry_date: Date.now() + 3600000 // 1 hour from now
    };

    const messages = await pollGmailInbox(tokens);
    return processGmailMessages(messages, userId);
  } catch (error) {
    logger.error('Error polling and creating tickets:', {
      error: error instanceof Error ? error.message : String(error),
      userId
    });
    throw error;
  }
}

export async function fetchLastTenEmails(tokens: GmailTokens): Promise<GmailMessage[]> {
  try {
    await gmailLogger.info('Fetching last 10 emails');
    
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&format=full', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        const newTokens = await refreshGmailTokens(tokens.refresh_token);
        return fetchLastTenEmails(newTokens);
      }
      throw new Error(`Failed to fetch emails: ${response.statusText}`);
    }

    const data = await response.json();
    const messages = (data.messages || []) as GmailListMessage[];

    // Fetch full message details for each message
    const fullMessages = await Promise.all(messages.map(async (msg: GmailListMessage) => {
      const msgResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!msgResponse.ok) {
        throw new Error(`Failed to fetch message ${msg.id}: ${msgResponse.statusText}`);
      }
      return msgResponse.json();
    }));

    await gmailLogger.info('Successfully fetched 10 emails');
    return fullMessages;
  } catch (error) {
    gmailLogger.error('Error fetching last 10 emails', error);
    throw error;
  }
}

export async function importInitialEmails(userId: string, tokens: GmailTokens) {
  try {
    gmailLogger.info('Starting initial email import', { userId });
    
    // Get user profile to get org_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('Failed to get user profile');
    }
    
    const messages = await fetchLastTenEmails(tokens);
    
    const results = await Promise.all(messages.map(async (message) => {
      try {
        if (!message.id || !message.threadId) {
          gmailLogger.warn('Message missing required IDs', {
            messageId: message.id,
            threadId: message.threadId
          });
          return { success: false, messageId: message.id || 'unknown', error: new Error('Message missing required IDs') };
        }

        const parsedEmail = await parseGmailMessage(message);
        if (!parsedEmail) {
          gmailLogger.warn('Failed to parse email', { 
            messageId: message.id,
            reason: 'Parsing returned null',
            headers: message.payload?.headers
          });
          return { success: false, messageId: message.id, error: new Error('Failed to parse email') };
        }

        // Create ticket from email
        const ticket = await createTicketFromEmail(parsedEmail, userId);
        
        // Process for promotional content
        await processPotentialPromotionalEmail(
          ticket.emailChatId,
          profile.org_id,
          parsedEmail.bodyText || parsedEmail.bodyHtml || '',
          message.id,
          message.threadId,
          parsedEmail.from || '',
          parsedEmail.subject || ''
        );
        
        return { success: true, messageId: message.id };
      } catch (error) {
        gmailLogger.error('Failed to process email', {
          messageId: message.id,
          error: formatError(error),
          payload: {
            headers: message.payload?.headers,
            mimeType: message.payload?.mimeType,
            hasBody: !!message.payload?.body,
            hasParts: !!message.payload?.parts
          }
        });
        return { success: false, messageId: message.id || 'unknown', error };
      }
    }));

    const failedCount = results.filter(r => !r.success).length;
    if (failedCount > 0) {
      gmailLogger.warn('Some emails failed to import', {
        total: results.length,
        failed: failedCount,
        failedMessages: results.filter(r => !r.success).map(r => ({
          messageId: r.messageId,
          error: formatError(r.error)
        }))
      });
    }

    return results;
  } catch (error) {
    gmailLogger.error('Failed to import initial emails', {
      userId,
      error: formatError(error)
    });
    throw error;
  }
}

interface WatchResponse {
  historyId: string;
  expiration: string;
  resourceId?: string;  // Optional because it's not in the TypeScript types but is returned by the API
}

type Credentials = {
  access_token: string;
  refresh_token: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
};

/**
 * Sets up or refreshes a Gmail watch for a mailbox
 */
export async function setupGmailWatch(
  tokens: Credentials,
  type: 'organization' | 'profile',
  id: string
): Promise<WatchResponse> {
  try {
    gmailLogger.info('Setting up Gmail watch', { type, id });

    // Get Gmail client using organization ID
    const gmail = await getGmailClient(id, type);

    // Get current history ID
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const currentHistoryId = profile.data.historyId;

    // Format topic name correctly
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'zendesk-clone-448507';
    const topicName = `projects/${projectId}/topics/gmail-updates`;

    // Set up watch
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: [], // Empty array means all labels except SPAM and TRASH
        topicName,
        labelFilterAction: 'include'
      }
    });

    if (!response.data.historyId || !response.data.expiration) {
      throw new Error('Invalid watch response');
    }

    gmailLogger.info('Gmail watch setup successful', {
      type,
      id,
      historyId: response.data.historyId,
      expiration: new Date(Number(response.data.expiration)).toISOString(),
      topicName,
      currentHistoryId
    });

    // Cast the response data to include resourceId
    const watchResponse = response.data as unknown as WatchResponse;

    return {
      historyId: watchResponse.historyId,
      expiration: watchResponse.expiration,
      resourceId: watchResponse.resourceId
    };
  } catch (error) {
    gmailLogger.error('Failed to set up Gmail watch', { error, type, id });
    throw error;
  }
}

/**
 * Stops watching a Gmail mailbox
 */
export async function stopWatch(tokens: GmailTokens, resourceId?: string): Promise<void> {
  if (!resourceId) {
    gmailLogger.warn('No resourceId provided to stopWatch, skipping');
    return;
  }

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

interface SendGmailReplyParams {
  threadId: string;
  inReplyTo: string;
  to: string[];
  subject: string;
  htmlBody: string;
  orgId: string;
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
  orgId,
}: SendGmailReplyParams): Promise<void> {
  try {
    // Get Gmail client with organization tokens
    const gmail = await getGmailClient(orgId);

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

    // Base64 encode the email with proper line breaks for MIME
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/(.{76})/g, '$1\n')  // Add line breaks every 76 chars for MIME
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send via Gmail API
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
        threadId,
      },
    });

    if (!response.data) {
      throw new Error('Failed to send email');
    }

    gmailLogger.info('Sent Gmail reply', { threadId, to });
  } catch (error) {
    gmailLogger.error('Error sending Gmail reply', { error });
    throw error;
  }
}

export async function getGmailClient(id: string, type: 'organization' | 'profile' = 'organization'): Promise<gmail_v1.Gmail> {
  try {
    let orgId = id;
    let tokens;

    if (type === 'profile') {
      // Get profile's org_id and tokens
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('org_id, gmail_access_token, gmail_refresh_token')
        .eq('id', id)
        .single();

      if (profileError || !profile) {
        throw new Error(`Failed to get profile Gmail tokens: ${profileError?.message}`);
      }

      if (!profile.gmail_access_token || !profile.gmail_refresh_token) {
        throw new Error('Profile Gmail tokens not found');
      }

      tokens = {
        gmail_access_token: profile.gmail_access_token,
        gmail_refresh_token: profile.gmail_refresh_token
      };
      orgId = profile.org_id;
    } else {
      // Get organization's tokens
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('gmail_access_token, gmail_refresh_token')
        .eq('id', orgId)
        .single();

      if (orgError || !org) {
        throw new Error(`Failed to get organization Gmail tokens: ${orgError?.message}`);
      }

      if (!org.gmail_access_token || !org.gmail_refresh_token) {
        throw new Error('Organization Gmail tokens not found');
      }

      tokens = org;
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token: tokens.gmail_access_token,
      refresh_token: tokens.gmail_refresh_token,
    });

    // Create and return Gmail client
    return google.gmail({ version: 'v1', auth: oauth2Client });
  } catch (error) {
    logger.error('Failed to initialize Gmail client:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Update the logging in processEmailsInBackground
async function updateImportProgress(
  supabase: ReturnType<typeof createClient<Database>>,
  importId: string,
  progress: number,
  processedCount: number,
  failedCount: number
) {
  const { error } = await supabase
    .from('gmail_imports')
    .update({
      progress,
      processed_messages: processedCount,
      failed_messages: failedCount,
      updated_at: new Date().toISOString()
    })
    .eq('id', importId);

  if (error) {
    logger.error(`Progress update failed for ${importId}`);
  }
}

// Update the logging in updateImportStatus
async function updateImportStatus(
  supabase: ReturnType<typeof createClient<Database>>,
  importId: string,
  status: 'pending' | 'in_progress' | 'completed' | 'failed',
  error?: string | null,
  processedCount?: number,
  failedCount?: number
) {
  const update: any = {
    status,
    error,
    updated_at: new Date().toISOString()
  };

  if (status === 'completed' || status === 'failed') {
    update.completed_at = new Date().toISOString();
  }

  if (typeof processedCount === 'number') {
    update.processed_messages = processedCount;
  }

  if (typeof failedCount === 'number') {
    update.failed_messages = failedCount;
  }

  const { error: updateError } = await supabase
    .from('gmail_imports')
    .update(update)
    .eq('id', importId);

  if (updateError) {
    logger.error(`Status update failed for ${importId}`);
  }
} 