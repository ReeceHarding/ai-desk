import { gmail_v1 } from 'googleapis';

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
  type: 'inbound' | 'outbound';
  status: 'success' | 'error';
  error?: unknown;
}

export interface GmailTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers: Array<{
    name: string;
    value: string;
  }>;
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
}

export interface GmailMessage extends Omit<gmail_v1.Schema$Message, 'payload'> {
  id: string;
  threadId: string;
  historyId: string;
  labelIds: string[];
  snippet: string;
  internalDate: string;
  payload: GmailMessagePart;
  sizeEstimate: number;
}

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

export interface EmailLogParams {
  messageId: string;
  threadId: string;
  orgId: string;
  type: 'inbound' | 'outbound';
  status: 'success' | 'error';
  error?: string;
  metadata?: Record<string, any>;
}

export interface EmailSearchParams {
  orgId?: string;
  threadId?: string;
  messageId?: string;
  type?: 'inbound' | 'outbound';
  status?: 'success' | 'error';
  fromDate?: Date;
  toDate?: Date;
  ticketId?: string;
  direction?: 'inbound' | 'outbound';
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

export interface SendGmailReplyParams {
  orgId: string;
  threadId: string;
  inReplyTo: string;
  to: string[];
  subject: string;
  htmlBody: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
} 