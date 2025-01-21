import { GmailMessage, GmailTokens, ParsedEmail, GmailProfile } from '../types/gmail';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

export async function getGmailProfile(tokens: GmailTokens): Promise<GmailProfile> {
  try {
    console.log('Fetching Gmail profile...');
    const response = await fetch('/api/gmail/profile', {
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
    console.log('Starting Gmail inbox polling...');
    const response = await fetch('/api/gmail/messages', {
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
        return pollGmailInbox(newTokens);
      }
      throw new Error(`Failed to fetch Gmail messages: ${response.statusText}`);
    }

    const messages = await response.json();
    console.log(`Successfully fetched ${messages.length} messages`);
    return messages;
  } catch (error) {
    console.error('Error polling Gmail:', error);
    throw error;
  }
}

export function parseGmailMessage(message: GmailMessage): ParsedEmail {
  try {
    console.log(`Parsing message ${message.id}...`);
    const parsed = {
      messageId: message.id,
      threadId: message.threadId,
      subject: message.subject || '(No Subject)',
      from: message.from,
      to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
      date: new Date(message.date),
      body: {
        text: message.body?.text || '',
        html: message.body?.html || ''
      },
      snippet: message.snippet || '',
      labels: message.labels || [],
      attachments: message.attachments || []
    };
    console.log(`Successfully parsed message ${message.id}`);
    return parsed;
  } catch (error) {
    console.error(`Error parsing message ${message.id}:`, error);
    throw error;
  }
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