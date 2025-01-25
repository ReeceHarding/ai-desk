import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { GmailAttachment, GmailMessage, GmailProfile, GmailTokens, ParsedEmail } from '../types/gmail';
import { Database } from '../types/supabase';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface GmailMessagePart {
  mimeType?: string;
  headers?: { name: string; value: string; }[];
  body?: {
    data?: string;
    size?: number;
    attachmentId?: string;
  };
  parts?: GmailMessagePart[];
  filename?: string;
  partId?: string;
}

const extractAttachments = (part: GmailMessagePart | undefined, messageId: string): GmailAttachment[] => {
  const attachments: GmailAttachment[] = [];
  
  if (!part) return attachments;

  // Check if current part is an attachment
  if (part.filename && part.body?.attachmentId) {
    attachments.push({
      filename: part.filename,
      mimeType: part.mimeType || 'application/octet-stream',
      size: part.body.size || 0,
      attachmentId: part.body.attachmentId,
      partId: part.partId || ''
    });
  }

  // Recursively check parts
  if (part.parts) {
    for (const subPart of part.parts) {
      attachments.push(...extractAttachments(subPart, messageId));
    }
  }

  return attachments;
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
    
    // First get the organization ID for the current user
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .single();

    if (profileError || !userProfile?.org_id) {
      throw new Error('Failed to get organization ID');
    }

    const response = await fetch(`${API_BASE_URL}/api/gmail/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        org_id: userProfile.org_id
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
    
    const gmailProfile = await response.json();
    console.log('Successfully fetched Gmail profile');
    return gmailProfile;
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
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

  const from = getHeader('from');
  const to = getHeader('to');
  const cc = getHeader('cc');
  const bcc = getHeader('bcc');
  const subject = getHeader('subject');
  const date = new Date(getHeader('date'));

  // Extract body
  const body = {
    text: '',
    html: ''
  };

  const extractBody = (part: GmailMessagePart | undefined) => {
    if (!part) return;

    if (part.mimeType === 'text/plain' && part.body?.data) {
      body.text = Buffer.from(part.body.data, 'base64').toString();
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      body.html = Buffer.from(part.body.data, 'base64').toString();
    }

    if (part.parts) {
      part.parts.forEach(extractBody);
    }
  };

  extractBody(message.payload);

  // If no body was found, use snippet
  if (!body.text && !body.html) {
    body.text = message.snippet || '';
  }

  // Parse email addresses
  const parseAddresses = (addressStr: string): string[] => {
    if (!addressStr) return [];
    return addressStr.split(',').map(addr => addr.trim());
  };

  // Extract attachments
  const attachments = extractAttachments(message.payload, message.id || '');

  return {
    messageId: message.id || '',
    threadId: message.threadId || '',
    from,
    to: parseAddresses(to),
    cc: parseAddresses(cc),
    bcc: parseAddresses(bcc),
    subject,
    snippet: message.snippet || '',
    body,
    date,
    attachments
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

    // Check if sender already exists as a user
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', parsedEmail.from)
      .single();

    let customerId: string;

    if (existingUser) {
      customerId = existingUser.id;
    } else {
      // Create a new user profile for the sender
      const { data: auth, error: authError } = await supabase.auth.admin.createUser({
        email: parsedEmail.from,
        email_confirm: true,
        user_metadata: {
          email: parsedEmail.from,
          email_verified: true,
          signup_completed: true
        }
      });

      if (authError) {
        logger.error('Failed to create auth user for sender', { error: authError });
        throw authError;
      }

      // Create profile for the new user
      const { data: newProfile, error: profileCreateError } = await supabase
        .from('profiles')
        .insert({
          id: auth.user.id,
          email: parsedEmail.from,
          role: 'customer'
        })
        .select()
        .single();

      if (profileCreateError) {
        logger.error('Failed to create profile for sender', { error: profileCreateError });
        throw profileCreateError;
      }

      customerId = auth.user.id;
    }

    // Create ticket with metadata as JSON string
    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({
        subject: parsedEmail.subject || '(No Subject)',
        description: parsedEmail.body.text || parsedEmail.snippet || 'No content',
        status: 'open',
        priority: 'medium',
        customer_id: customerId,
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
      logger.error('Failed to create ticket', { error });
      throw error;
    }

    // Create ticket_email_chats record
    const { error: chatError } = await supabase
      .from('ticket_email_chats')
      .insert({
        ticket_id: ticket.id,
        message_id: parsedEmail.messageId,
        thread_id: parsedEmail.threadId,
        from_address: parsedEmail.from,
        to_address: Array.isArray(parsedEmail.to) ? parsedEmail.to : [parsedEmail.to],
        cc_address: parsedEmail.cc || [],
        bcc_address: parsedEmail.bcc || [],
        subject: parsedEmail.subject,
        body: parsedEmail.body.text || parsedEmail.body.html || parsedEmail.snippet || '',
        gmail_date: parsedEmail.date,
        org_id: profile.org_id
      });

    if (chatError) {
      logger.error('Failed to create ticket_email_chats record', { error: chatError });
      // Don't throw here, as we still want to return the ticket
    }

    logger.info('Successfully created ticket from email', {
      ticketId: ticket.id,
      emailId: parsedEmail.messageId,
      subject: parsedEmail.subject
    });

    return ticket;
  } catch (error) {
    logger.error('Error in createTicketFromEmail', {
      error,
      messageId: parsedEmail.messageId
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
    
    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.org_id) {
      throw profileError || new Error('No organization found for profile');
    }

    // Fetch last 10 emails
    const messages = await fetchLastTenEmails(tokens);
    await logger.info('Fetched initial emails', { count: messages.length, orgId: profile.org_id });
    
    // Process each message
    const results = await Promise.allSettled(
      messages.map(async (message) => {
        try {
          const parsedEmail = parseGmailMessage(message);
          const ticket = await createTicketFromEmail(parsedEmail, userId);
          return { success: true, messageId: message.id, ticketId: ticket.id };
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
      orgId: profile.org_id,
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

export async function downloadAndStoreAttachment(
  auth: any,
  messageId: string,
  attachment: GmailAttachment,
  orgId: string
): Promise<{ filePath: string; metadata: any } | null> {
  try {
    const gmail = google.gmail({ version: 'v1', auth });
    
    // Get the attachment data from Gmail
    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachment.attachmentId
    });

    if (!response.data.data) {
      console.error('No attachment data received from Gmail');
      return null;
    }

    // Decode the attachment data
    const buffer = Buffer.from(response.data.data, 'base64');

    // Generate a unique filename
    const timestamp = new Date().getTime();
    const safeFilename = attachment.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${orgId}/${messageId}/${timestamp}_${safeFilename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('private-attachments')
      .upload(filePath, buffer, {
        contentType: attachment.mimeType,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Failed to upload attachment to Supabase:', uploadError);
      return null;
    }

    // Get the file URL
    const { data: urlData } = supabase.storage
      .from('private-attachments')
      .getPublicUrl(filePath);

    if (!urlData.publicUrl) {
      console.error('Failed to get public URL for uploaded attachment');
      return null;
    }

    // Return the file path and metadata
    return {
      filePath: urlData.publicUrl,
      metadata: {
        originalName: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
        messageId,
        gmailAttachmentId: attachment.attachmentId
      }
    };
  } catch (error) {
    console.error('Error downloading and storing attachment:', error);
    return null;
  }
} 