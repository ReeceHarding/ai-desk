
export type EmailDirection = 'inbound' | 'outbound';

export interface EmailLog {
  id: string;
  ticket_id: string;
  message_id: string;
  thread_id: string;
  direction: EmailDirection;
  timestamp: string;
  snippet?: string;
  subject?: string;
  from_address: string;
  to_address: string;
  author_id: string;
  org_id: string;
  raw_content?: string;
  labels?: string[];
  created_at: string;
  updated_at: string;
}

export interface GmailTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  scope: string;
  expiry_date: number;
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet?: string;
  subject?: string;
  from: string;
  to: string | string[];
  date: string | number;
  body?: {
    text?: string;
    html?: string;
  };
  labels?: string[];
  attachments?: Array<{
    filename: string;
    mimeType: string;
    data: string;
  }>;
}

export interface ParsedEmail {
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  body: {
    text?: string;
    html?: string;
  };
  snippet: string;
  labels: string[];
  attachments: Array<{
    filename: string;
    mimeType: string;
    data: string;
  }>;
}

export interface EmailLogParams {
  ticketId: string;
  messageId: string;
  threadId: string;
  direction: EmailDirection;
  snippet?: string;
  subject?: string;
  fromAddress: string;
  toAddress: string;
  authorId: string;
  orgId: string;
  rawContent?: string;
  labels?: string[];
}

export interface EmailSearchParams {
  ticketId?: string;
  threadId?: string;
  messageId?: string;
  orgId?: string;
  direction?: EmailDirection;
  fromDate?: Date;
  toDate?: Date;
}

export interface GmailMessageMetadata {
  id: string;
  threadId: string;
  labelIds: string[];
}

export interface GmailThread {
  id: string;
  historyId: string;
  messages: GmailMessage[];
}

export type GmailScope = 
  | 'https://www.googleapis.com/auth/gmail.readonly'
  | 'https://www.googleapis.com/auth/gmail.modify'
  | 'https://www.googleapis.com/auth/gmail.compose'
  | 'https://www.googleapis.com/auth/gmail.send';

export const GMAIL_SCOPES: GmailScope[] = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send'
]; 