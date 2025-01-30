import { GmailMessage } from '@/types/gmail';
import { parseGmailMessage } from '@/utils/email-parser';

describe('parseGmailMessage', () => {
  it('parses a Gmail message with name and email in from field', () => {
    const message: GmailMessage = {
      id: 'msg123',
      threadId: 'thread123',
      labelIds: ['INBOX'],
      snippet: 'Test email',
      from: 'John Doe <john@example.com>',
      to: 'Support <support@company.com>',
      subject: 'Test Subject',
      date: '2024-01-01T00:00:00Z',
      body: {
        text: 'This is a test email',
        html: '<p>This is a test email</p>',
      },
    };

    const parsed = parseGmailMessage(message);

    expect(parsed).toEqual({
      messageId: 'msg123',
      threadId: 'thread123',
      fromName: 'John Doe',
      fromEmail: 'john@example.com',
      toEmail: 'support@company.com',
      subject: 'Test Subject',
      body: '<p>This is a test email</p>',
      date: '2024-01-01T00:00:00Z',
    });
  });

  it('parses a Gmail message with only email in from field', () => {
    const message: GmailMessage = {
      id: 'msg123',
      threadId: 'thread123',
      labelIds: ['INBOX'],
      snippet: 'Test email',
      from: 'john@example.com',
      to: 'support@company.com',
      subject: 'Test Subject',
      date: '2024-01-01T00:00:00Z',
      body: {
        text: 'This is a test email',
      },
    };

    const parsed = parseGmailMessage(message);

    expect(parsed).toEqual({
      messageId: 'msg123',
      threadId: 'thread123',
      fromName: '',
      fromEmail: 'john@example.com',
      toEmail: 'support@company.com',
      subject: 'Test Subject',
      body: 'This is a test email',
      date: '2024-01-01T00:00:00Z',
    });
  });

  it('parses a Gmail message with malformed from field', () => {
    const message: GmailMessage = {
      id: 'msg123',
      threadId: 'thread123',
      labelIds: ['INBOX'],
      snippet: 'Test email',
      from: 'Invalid Email Format',
      to: 'support@company.com',
      subject: 'Test Subject',
      date: '2024-01-01T00:00:00Z',
      body: {
        text: 'This is a test email',
      },
    };

    const parsed = parseGmailMessage(message);

    expect(parsed).toEqual({
      messageId: 'msg123',
      threadId: 'thread123',
      fromName: '',
      fromEmail: 'Invalid Email Format',
      toEmail: 'support@company.com',
      subject: 'Test Subject',
      body: 'This is a test email',
      date: '2024-01-01T00:00:00Z',
    });
  });

  it('uses snippet when no body is available', () => {
    const message: GmailMessage = {
      id: 'msg123',
      threadId: 'thread123',
      labelIds: ['INBOX'],
      snippet: 'Test email snippet',
      from: 'john@example.com',
      to: 'support@company.com',
      subject: 'Test Subject',
      date: '2024-01-01T00:00:00Z',
      body: {},
    };

    const parsed = parseGmailMessage(message);

    expect(parsed.body).toBe('Test email snippet');
  });
}); 