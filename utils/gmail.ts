import { GmailMessage, GmailTokens, ParsedEmail, GmailProfile } from '../types/gmail';

export async function getGmailProfile(tokens: GmailTokens): Promise<GmailProfile> {
  try {
    const response = await fetch('/api/gmail/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tokens }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch Gmail profile');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching Gmail profile:', error);
    throw error;
  }
}

export async function pollGmailInbox(tokens: GmailTokens) {
  try {
    const response = await fetch('/api/gmail/inbox', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tokens }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Gmail inbox');
    }

    const messages = await response.json();
    return messages as GmailMessage[];
  } catch (error) {
    console.error('Error polling Gmail:', error);
    throw error;
  }
}

export function parseGmailMessage(message: GmailMessage): ParsedEmail {
  const headers = message.payload.headers;
  const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

  const subject = getHeader('subject') || '(No Subject)';
  const from = getHeader('from') || '';
  const to = (getHeader('to') || '').split(',').map(e => e.trim());
  const cc = (getHeader('cc') || '').split(',').map(e => e.trim()).filter(Boolean);
  const date = new Date(parseInt(message.internalDate));
  const inReplyTo = getHeader('in-reply-to');
  const references = getHeader('references')?.split(' ') || [];

  // Parse message body
  let textBody = '';
  let htmlBody = '';

  function extractBody(part: any) {
    if (part.mimeType === 'text/plain') {
      textBody = Buffer.from(part.body?.data || '', 'base64').toString();
    } else if (part.mimeType === 'text/html') {
      htmlBody = Buffer.from(part.body?.data || '', 'base64').toString();
    }
    
    if (part.parts) {
      part.parts.forEach(extractBody);
    }
  }

  extractBody(message.payload);

  return {
    messageId: message.id,
    threadId: message.threadId,
    subject,
    from,
    to,
    cc: cc.length > 0 ? cc : undefined,
    date,
    body: {
      text: textBody || undefined,
      html: htmlBody || undefined
    },
    inReplyTo,
    references: references.length > 0 ? references : undefined
  };
}

export async function refreshGmailTokens(refreshToken: string): Promise<GmailTokens> {
  // Implementation of refreshGmailTokens function
  throw new Error('Method not implemented');
}

export async function addGmailLabel(messageId: string, labelName: string, tokens: GmailTokens) {
  try {
    const response = await fetch('/api/gmail/label', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tokens, messageId, labelName }),
    });

    if (!response.ok) {
      throw new Error('Failed to add Gmail label');
    }
  } catch (error) {
    console.error('Error adding Gmail label:', error);
    throw error;
  }
} 