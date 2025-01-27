import { GmailAttachment, GmailMessage, GmailTokens, ParsedEmail } from '@/types/gmail';
import { logger } from '@/utils/logger';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { Database } from '../../../types/supabase';

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
      data: '',  // Will be populated when downloaded
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

export async function getGmailClient(tokens: GmailTokens) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export function parseGmailMessage(message: GmailMessage): ParsedEmail {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) => headers.find(h => h.name === name)?.value || '';

  const parsedEmail: ParsedEmail = {
    messageId: message.id,
    threadId: message.threadId,
    subject: getHeader('Subject'),
    from: getHeader('From'),
    to: [getHeader('To')],
    cc: [getHeader('Cc')].filter(Boolean),
    date: new Date(getHeader('Date')).toISOString(),
    body: {
      text: '',
      html: ''
    },
    attachments: []
  };

  // Parse body and attachments
  const parsePayloadParts = (part: any) => {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      parsedEmail.body.text = Buffer.from(part.body.data, 'base64').toString();
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      parsedEmail.body.html = Buffer.from(part.body.data, 'base64').toString();
    } else if (part.parts) {
      part.parts.forEach(parsePayloadParts);
    }

    if (part.filename && part.body?.attachmentId) {
      const attachment: GmailAttachment = {
        data: '',  // Will be populated when downloaded
        size: part.body.size || 0,
        filename: part.filename,
        mimeType: part.mimeType,
        partId: part.partId || '0',
        attachmentId: part.body.attachmentId
      };
      parsedEmail.attachments.push(attachment);
    }
  };

  if (message.payload) {
    parsePayloadParts(message.payload);
  }

  return parsedEmail;
}

export async function downloadAndStoreAttachment(messageId: string, attachmentId: string, tokens: GmailTokens) {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth });

    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId
    });

    if (!response.data.data) {
      throw new Error('No attachment data found');
    }

    return {
      data: response.data.data,
      size: response.data.size
    };
  } catch (error) {
    logger.error('[GMAIL] Error downloading attachment:', { error, messageId, attachmentId });
    return null;
  }
}

export async function setupGmailWatch(tokens: GmailTokens, userId: string, orgId: string) {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth });

    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: ['INBOX'],
        topicName: process.env.GMAIL_PUBSUB_TOPIC
      }
    });

    return {
      historyId: response.data.historyId,
      expiration: response.data.expiration
    };
  } catch (error) {
    logger.error('[GMAIL] Error setting up watch:', { error, userId, orgId });
    throw error;
  }
} 