import { EmailLogger } from '../../utils/emailLogger';

// Mock the entire module
jest.mock('@supabase/auth-helpers-nextjs', () => {
  const mockClient = {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis()
  };

  return {
    createClientComponentClient: () => mockClient
  };
});

describe('EmailLogger', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });

  // Test 1: Verify logEmail successfully logs an email
  test('logEmail should successfully log an email', async () => {
    const mockEmailData = {
      id: '123',
      ticket_id: 'ticket123',
      message_id: 'msg123',
      thread_id: 'thread123',
      direction: 'inbound' as const,
      from_address: 'test@example.com',
      to_address: 'support@company.com',
      author_id: 'author123',
      org_id: 'org123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Get the mock client from the module
    const mockClient = require('@supabase/auth-helpers-nextjs').createClientComponentClient();
    mockClient.single.mockResolvedValue({ data: mockEmailData, error: null });

    const result = await EmailLogger.logEmail({
      ticketId: 'ticket123',
      messageId: 'msg123',
      threadId: 'thread123',
      direction: 'inbound',
      fromAddress: 'test@example.com',
      toAddress: 'support@company.com',
      authorId: 'author123',
      orgId: 'org123'
    });

    expect(result).toEqual(mockEmailData);
    expect(mockClient.from).toHaveBeenCalledWith('email_logs');
    expect(mockClient.insert).toHaveBeenCalled();
  });

  // Test 2: Verify getEmailHistory returns email history for a ticket
  test('getEmailHistory should return email history for a ticket', async () => {
    const mockEmails = [
      {
        id: '123',
        ticket_id: 'ticket123',
        message_id: 'msg1',
        thread_id: 'thread1',
        direction: 'inbound',
        created_at: new Date().toISOString()
      },
      {
        id: '124',
        ticket_id: 'ticket123',
        message_id: 'msg2',
        thread_id: 'thread1',
        direction: 'outbound',
        created_at: new Date().toISOString()
      }
    ];

    const mockClient = require('@supabase/auth-helpers-nextjs').createClientComponentClient();
    mockClient.order.mockResolvedValue({ data: mockEmails, error: null });

    const result = await EmailLogger.getEmailHistory('ticket123');

    expect(result).toEqual(mockEmails);
    expect(mockClient.from).toHaveBeenCalledWith('email_logs');
    expect(mockClient.eq).toHaveBeenCalledWith('ticket_id', 'ticket123');
  });

  // Test 3: Verify error handling in logEmail
  test('logEmail should handle errors properly', async () => {
    const mockError = new Error('Database error');
    const mockClient = require('@supabase/auth-helpers-nextjs').createClientComponentClient();
    mockClient.single.mockResolvedValue({ data: null, error: mockError });

    await expect(EmailLogger.logEmail({
      ticketId: 'ticket123',
      messageId: 'msg123',
      threadId: 'thread123',
      direction: 'inbound',
      fromAddress: 'test@example.com',
      toAddress: 'support@company.com',
      authorId: 'author123',
      orgId: 'org123'
    })).rejects.toThrow();
  });
}); 