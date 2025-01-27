import { createClient } from '@supabase/supabase-js';
import { GmailMessage, GmailTokens, ParsedEmail } from '../types/gmail';
import { Database } from '../types/supabase';

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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

export async function getGmailProfile({
  access_token,
  refresh_token,
  user_id
}: {
  access_token: string
  refresh_token: string
  user_id: string
}) {
  const response = await fetch('/api/gmail/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      user_id,
      access_token, 
      refresh_token 
    })
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Gmail profile');
  }

  return response.json();
}

export async function pollGmailInbox(tokens: GmailTokens): Promise<GmailMessage[]> {
  try {
    const response = await fetch('/api/gmail/messages', {
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

export async function refreshGmailTokens(refreshToken: string): Promise<GmailTokens> {
  try {
    console.log('Refreshing Gmail tokens...');
    const response = await fetch('/api/gmail/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh tokens');
    }

    return response.json();
  } catch (error) {
    logger.error('Error refreshing Gmail tokens', error);
    throw error;
  }
}

export async function addGmailLabel(messageId: string, labelName: string, tokens: GmailTokens) {
  try {
    const response = await fetch('/api/gmail/label', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messageId,
        labelName,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to add label');
    }

    return response.json();
  } catch (error) {
    logger.error('Error adding Gmail label', error);
    throw error;
  }
}

export async function getMessageContent(messageId: string, tokens: GmailTokens): Promise<string | null> {
  try {
    const response = await fetch(`/api/gmail/content?messageId=${messageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get message content');
    }

    const data = await response.json();
    return data.content;
  } catch (error) {
    logger.error('Error getting message content', error);
    return null;
  }
}

export async function createTicketFromEmail(parsedEmail: ParsedEmail, userId: string) {
  try {
    const response = await fetch('/api/gmail/create-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parsedEmail,
        userId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create ticket from email');
    }

    return response.json();
  } catch (error) {
    logger.error('Error creating ticket from email', error);
    throw error;
  }
}

export async function pollAndCreateTickets(userId: string): Promise<any[]> {
  try {
    const response = await fetch('/api/gmail/poll-and-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to poll and create tickets');
    }

    return response.json();
  } catch (error) {
    logger.error('Error polling and creating tickets', error);
    throw error;
  }
}

export async function fetchLastTenEmails(tokens: GmailTokens): Promise<GmailMessage[]> {
  try {
    const response = await fetch('/api/gmail/last-ten', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch last ten emails');
    }

    const data = await response.json();
    return data.messages || [];
  } catch (error) {
    logger.error('Error fetching last ten emails', error);
    throw error;
  }
}

export async function importInitialEmails(userId: string, tokens: GmailTokens) {
  try {
    const response = await fetch('/api/gmail/import-initial', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to import initial emails');
    }

    return response.json();
  } catch (error) {
    logger.error('Error importing initial emails', error);
    throw error;
  }
}

export async function setupOrRefreshWatch(
  tokens: GmailTokens, 
  type: 'organization' | 'profile', 
  id: string
): Promise<{ resourceId: string; expiration: string }> {
  try {
    logger.info(`Setting up Gmail watch for ${type}:${id}`);
    
    const response = await fetch('/api/gmail/watch/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.access_token}`
      },
      body: JSON.stringify({
        type,
        id,
        refresh_token: tokens.refresh_token
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to set up Gmail watch: ${response.statusText}`);
    }

    const data = await response.json();
    logger.info(`Successfully set up Gmail watch for ${type}:${id}`, {
      resourceId: data.resourceId,
      expiration: data.expiration
    });

    return {
      resourceId: data.resourceId,
      expiration: data.expiration
    };
  } catch (error) {
    logger.error(`Error setting up Gmail watch for ${type}:${id}`, error);
    throw error;
  }
}

export async function stopWatch(tokens: GmailTokens, resourceId: string): Promise<void> {
  try {
    const response = await fetch('/api/gmail/watch/stop', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resourceId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to stop watch');
    }
  } catch (error) {
    logger.error('Error stopping watch', error);
    throw error;
  }
}

export async function checkAndRefreshWatches(): Promise<void> {
  try {
    const response = await fetch('/api/gmail/watch/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to check and refresh watches');
    }
  } catch (error) {
    logger.error('Error checking and refreshing watches', error);
    throw error;
  }
}

function getEmailBody(parsedEmail: ParsedEmail): string {
  return parsedEmail.body.html || parsedEmail.body.text || parsedEmail.snippet || '';
}

function getEmailPreview(parsedEmail: ParsedEmail): string {
  const body = getEmailBody(parsedEmail);
  return body.substring(0, 200) + (body.length > 200 ? '...' : '');
} 