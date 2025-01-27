'server-only';

import { GmailTokens } from '@/types/gmail';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// Gmail API scopes
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata'
];

// Create OAuth2 client for server-side operations
export function createServerOAuthClient() {
  return new google.auth.OAuth2(
    process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
  );
}

// Create a Gmail client for server-side operations
export function createGmailClient(auth: any) {
  return google.gmail({ version: 'v1', auth });
}

// Exchange authorization code for tokens
export async function getTokensFromCode(code: string): Promise<GmailTokens> {
  const oauth2Client = createServerOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token!,
    expiry_date: tokens.expiry_date!
  };
}

// Gmail watch response type
interface GmailWatchResponse {
  historyId: string;
  expiration: string;
  resourceId?: string;
}

// Setup Gmail watch
export async function setupGmailWatch(tokens: GmailTokens, userId: string, orgId: string): Promise<GmailWatchResponse> {
  const oauth2Client = createServerOAuthClient();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token
  });
  
  const gmail = createGmailClient(oauth2Client);
  
  const response = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      labelIds: ['INBOX'],
      topicName: process.env.GOOGLE_PUBSUB_TOPIC_NAME!
    }
  });

  return response.data as GmailWatchResponse;
}

// Refresh tokens
export async function refreshTokens(refresh_token: string): Promise<GmailTokens> {
  const oauth2Client = createServerOAuthClient();
  oauth2Client.setCredentials({ refresh_token });
  
  const { credentials } = await oauth2Client.refreshAccessToken();
  return {
    access_token: credentials.access_token!,
    refresh_token: refresh_token,
    expiry_date: credentials.expiry_date!
  };
}

// Get Gmail profile
export async function getGmailProfile(tokens: GmailTokens) {
  const oauth2Client = createServerOAuthClient();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token
  });

  const gmail = createGmailClient(oauth2Client);

  try {
    const response = await gmail.users.getProfile({ userId: 'me' });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      const newTokens = await refreshTokens(tokens.refresh_token);
      oauth2Client.setCredentials({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token
      });
      const response = await gmail.users.getProfile({ userId: 'me' });
      return {
        ...response.data,
        tokens: newTokens
      };
    }
    throw error;
  }
}

// Stop Gmail watch
export async function stopGmailWatch(tokens: GmailTokens) {
  const oauth2Client = createServerOAuthClient();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token
  });

  const gmail = createGmailClient(oauth2Client);

  try {
    await gmail.users.stop({
      userId: 'me'
    });
  } catch (error: any) {
    if (error.response?.status === 401) {
      const newTokens = await refreshTokens(tokens.refresh_token);
      return stopGmailWatch(newTokens);
    }
    throw error;
  }
}

// Get Gmail history
export async function getHistory(tokens: GmailTokens, startHistoryId: string) {
  const oauth2Client = createServerOAuthClient();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token
  });

  const gmail = createGmailClient(oauth2Client);

  try {
    const response = await gmail.users.history.list({
      userId: 'me',
      startHistoryId
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      const newTokens = await refreshTokens(tokens.refresh_token);
      return getHistory(newTokens, startHistoryId);
    }
    throw error;
  }
}

// Get Gmail message
export async function getMessage(tokens: GmailTokens, messageId: string) {
  const oauth2Client = createServerOAuthClient();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token
  });

  const gmail = createGmailClient(oauth2Client);

  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      const newTokens = await refreshTokens(tokens.refresh_token);
      return getMessage(newTokens, messageId);
    }
    throw error;
  }
}

// Export types only from googleapis
export type { gmail_v1 } from 'googleapis';
