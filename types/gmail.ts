export type EmailDirection = 'inbound' | 'outbound';

export interface EmailLog {
  id: string;
  ticket_id: string;
  message_id: string;
  thread_id: string;
  from_address: string;
  to_address: string[];
  cc_address: string[];
  bcc_address: string[];
  subject: string | null;
  body: string;
  attachments: any;
  gmail_date: string;
  org_id: string;
  ai_classification: 'should_respond' | 'no_response' | 'unknown';
  ai_confidence: number;
  ai_auto_responded: boolean;
  ai_draft_response: string | null;
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
  snippet?: string;
  payload?: {
    headers?: Array<{
      name: string;
      value: string;
    }>;
    mimeType?: string;
    body?: {
      data?: string;
    };
    parts?: Array<{
      mimeType?: string;
      body?: {
        data?: string;
      };
      parts?: any[];
    }>;
  };
  labelIds?: string[];
}

export interface ParsedEmail {
  messageId: string;
  threadId: string;
  from: string;
  fromName: string;
  fromEmail: string;
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  snippet: string;
  body: {
    text: string;
    html: string;
  };
  date: Date;
  attachments?: any;
}

export interface EmailLogParams {
  ticketId: string;
  messageId: string;
  threadId: string;
  fromAddress: string;
  toAddress: string | string[];
  subject?: string;
  rawContent?: string;
  orgId: string;
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