import { GmailMessage, GmailMessagePart } from '@/types/gmail';

export interface ParsedEmail {
  id: string;
  threadId: string;
  historyId: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  date: string;
  bodyText: string;
  bodyHtml: string;
  attachments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    data?: Buffer;
  }>;
}

/**
 * Parse a Gmail message into our internal format.
 * This parser extracts all necessary address fields and separates body text from HTML.
 */
export function parseGmailMessage(message: GmailMessage & { 
  payload?: { 
    mimeType?: string; 
    parts?: GmailMessagePart[];
  };
  historyId?: string;
}): ParsedEmail {
  // Helper function to extract email addresses from a header value
  const extractEmails = (headerValue: string): string[] => {
    if (!headerValue) return [];
    return headerValue.split(',')
      .map(addr => {
        const match = addr.match(/^(?:[^<]*<)?([^>]+)>?$/);
        return match ? match[1].trim() : addr.trim();
      })
      .filter(email => email.length > 0);
  };

  // Extract "From", "To", "Cc", "Bcc", "Subject", "Date" from headers
  const headers = message.payload?.headers || [];
  const getHeader = (name: string): string => {
    const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
    return header && header.value ? header.value : '';
  };

  const fromHeader = getHeader('from');
  const toHeader = getHeader('to');
  const ccHeader = getHeader('cc');
  const bccHeader = getHeader('bcc');
  const subject = getHeader('subject') || '(No Subject)';
  const date = getHeader('date') || new Date().toISOString();

  // Extract sender email address (use fromHeader)
  const fromEmails = extractEmails(fromHeader);
  // If multiple addresses, take the first one as the sender
  const from = fromEmails.length > 0 ? fromEmails[0] : fromHeader;

  // Parse recipients
  const to = extractEmails(toHeader);
  const cc = extractEmails(ccHeader);
  const bcc = extractEmails(bccHeader);

  // Extract body text and HTML
  let bodyText = '';
  let bodyHtml = '';

  // If payload has a direct body, use it based on mimeType
  if (message.payload) {
    if (message.payload.body && message.payload.body.data) {
      const decoded = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
      if (message.payload.mimeType === 'text/html') {
        bodyHtml = decoded;
      } else {
        bodyText = decoded;
      }
    }
    // Process parts if available
    if (message.payload.parts) {
      message.payload.parts.forEach((part: GmailMessagePart) => {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.mimeType === 'text/html' && part.body?.data) {
          bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      });
    }
  }

  // In case only one body is available, copy it to the other
  if (!bodyText && bodyHtml) {
    bodyText = bodyHtml;
  }
  if (!bodyHtml && bodyText) {
    bodyHtml = bodyText;
  }

  return {
    id: message.id || '',
    threadId: message.threadId || '',
    historyId: message.historyId || '',
    from,
    to,
    cc,
    bcc,
    subject,
    date,
    bodyText,
    bodyHtml,
    attachments: [] // Attachments handling can be added as needed
  };
}

/**
 * Sanitize and parse HTML email body.
 */
export function parseEmailBody(html: string | null): string {
  if (!html) return '';
  try {
    const sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return sanitized;
  } catch (error) {
    console.error('Error parsing email body:', error);
    return html || '';
  }
}

/**
 * Get a preview of the email content with a maximum length.
 */
export function getEmailPreview(html: string | null, maxLength: number = 150): string {
  const parsed = parseEmailBody(html);
  if (!parsed) return '';
  const cleaned = parsed
    .replace(/\s+/g, ' ')
    .replace(/>\s*/g, '')
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength).trim() + '...';
} 