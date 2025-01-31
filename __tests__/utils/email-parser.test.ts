import { GmailMessage } from '@/types/gmail';
import { parseGmailMessage } from '@/utils/email-parser';

describe('parseGmailMessage', () => {
  const createTestMessage = (overrides: Partial<GmailMessage> = {}): GmailMessage => ({
    id: 'msg123',
    threadId: 'thread123',
    historyId: 'history123',
    labelIds: ['INBOX'],
    snippet: 'Test email snippet',
    internalDate: '1234567890',
    sizeEstimate: 1024,
    payload: {
      mimeType: 'text/plain',
      headers: [
        { name: 'From', value: 'John Doe <john@example.com>' },
        { name: 'To', value: 'Support <support@company.com>' },
        { name: 'Subject', value: 'Test Subject' },
        { name: 'Date', value: new Date().toISOString() }
      ],
      body: {
        data: Buffer.from('Test email body').toString('base64'),
        size: 100
      }
    },
    ...overrides
  });

  it('should parse a Gmail message with name and email', () => {
    const message = {
      id: '123',
      threadId: '456',
      labelIds: ['INBOX'],
      snippet: 'Test snippet',
      historyId: '789',
      internalDate: '1234567890',
      payload: {
        headers: [
          { name: 'Subject', value: 'Test Subject' },
          { name: 'From', value: 'John Doe <john@example.com>' },
          { name: 'To', value: 'support@company.com' },
          { name: 'Date', value: 'Mon, 1 Jan 2024 12:00:00 +0000' }
        ],
        mimeType: 'text/plain',
        body: { data: 'Test body' }
      },
      sizeEstimate: 1000,
      from: 'John Doe <john@example.com>',
      subject: 'Test Subject',
      body: 'Test body'
    };

    const result = parseGmailMessage(message);
    expect(result.fromName).toBe('John Doe');
    expect(result.fromEmail).toBe('john@example.com');
    expect(result.subject).toBe('Test Subject');
    expect(result.body).toBe('Test body');
  });

  it('parses a Gmail message with simple email address', () => {
    const message = {
      id: '123',
      threadId: '456',
      labelIds: ['INBOX'],
      snippet: 'Test snippet',
      historyId: '789',
      internalDate: '1234567890',
      payload: {
        headers: [
          { name: 'Subject', value: 'Test Subject' },
          { name: 'From', value: 'john@example.com' },
          { name: 'To', value: 'support@company.com' },
          { name: 'Date', value: 'Mon, 1 Jan 2024 12:00:00 +0000' }
        ],
        mimeType: 'text/plain',
        body: { data: 'Test body' }
      },
      sizeEstimate: 1000,
      from: 'john@example.com',
      subject: 'Test Subject',
      body: 'Test body'
    };

    const result = parseGmailMessage(message);
    expect(result.fromName).toBe('');
    expect(result.fromEmail).toBe('john@example.com');
    expect(result.subject).toBe('Test Subject');
    expect(result.body).toBe('Test body');
  });

  it('parses a Gmail message with malformed headers', () => {
    const message = {
      id: '123',
      threadId: '456',
      labelIds: ['INBOX'],
      snippet: 'Test snippet',
      historyId: '789',
      internalDate: '1234567890',
      payload: {
        headers: [
          { name: 'Subject', value: 'Test Subject' },
          { name: 'From', value: '<>' },
          { name: 'To', value: 'support@company.com' },
          { name: 'Date', value: 'Mon, 1 Jan 2024 12:00:00 +0000' }
        ],
        mimeType: 'text/plain',
        body: { data: 'Test body' }
      },
      sizeEstimate: 1000,
      from: '<>',
      subject: 'Test Subject',
      body: 'Test body'
    };

    const result = parseGmailMessage(message);
    expect(result.fromName).toBe('');
    expect(result.fromEmail).toBe('');
    expect(result.subject).toBe('Test Subject');
    expect(result.body).toBe('Test body');
  });

  it('uses snippet when no body is available', () => {
    const message = {
      id: '123',
      threadId: '456',
      labelIds: ['INBOX'],
      snippet: 'Test snippet',
      historyId: '789',
      internalDate: '1234567890',
      payload: {
        headers: [
          { name: 'Subject', value: 'Test Subject' },
          { name: 'From', value: 'John Doe <john@example.com>' },
          { name: 'To', value: 'support@company.com' },
          { name: 'Date', value: 'Mon, 1 Jan 2024 12:00:00 +0000' }
        ],
        mimeType: 'text/plain',
        body: { data: '' }
      },
      sizeEstimate: 1000,
      from: 'John Doe <john@example.com>',
      subject: 'Test Subject',
      body: ''
    };

    const result = parseGmailMessage(message);
    expect(result.body).toBe('Test snippet');
  });
}); 