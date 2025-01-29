import { GmailMessage } from '@/types/gmail';

export interface ParsedEmail {
  messageId: string;
  threadId: string;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  date: string;
}

/**
 * Parse a Gmail message into our internal format
 */
export function parseGmailMessage(message: GmailMessage): ParsedEmail {
  // Extract name and email from the "from" field
  const fromMatch = message.from.match(/^(?:([^<]*)<)?([^>]+)>?$/);
  const fromName = (fromMatch?.[1] || '').trim();
  const fromEmail = (fromMatch?.[2] || message.from).trim();

  // Extract email from the "to" field
  const toMatch = message.to.match(/^(?:([^<]*)<)?([^>]+)>?$/);
  const toEmail = (toMatch?.[2] || message.to).trim();

  return {
    messageId: message.id,
    threadId: message.threadId,
    fromName,
    fromEmail,
    toEmail,
    subject: message.subject,
    body: message.body.html || message.body.text || message.snippet,
    date: message.date,
  };
}

export function parseEmailBody(html: string | null): string {
  if (!html) return '';
  
  try {
    // Simple sanitization first
    const sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
      .replace(/<[^>]+>/g, ' ') // Replace tags with spaces
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();

    return sanitized;
  } catch (error) {
    console.error('Error parsing email body:', error);
    return html || '';
  }
}

export function getEmailPreview(html: string | null, maxLength: number = 150): string {
  const parsed = parseEmailBody(html);
  if (!parsed) return '';
  const cleaned = parsed
    .replace(/\s+/g, ' ')
    .replace(/>\s*/g, '') // Remove quoted text markers
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength).trim() + '...';
} 