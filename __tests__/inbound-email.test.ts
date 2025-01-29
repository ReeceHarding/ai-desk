import { processInboundEmailWithAI } from '../utils/ai-email-processor';
import { EmailLogger } from '../utils/emailLogger';
import { handleInboundEmail } from '../utils/inbound-email';

// Mock dependencies
jest.mock('../utils/ai-email-processor');
jest.mock('../utils/emailLogger');

// Mock Supabase client
const mockSupabaseResponse = {
  data: {
    id: 'ticket123',
    subject: 'Test Subject',
    metadata: {
      thread_id: 'thread123'
    }
  },
  error: null
};

const mockEmailChatResponse = {
  data: {
    id: 'chat123',
    ticket_id: 'ticket123',
    message_id: 'msg123',
    thread_id: 'thread123'
  },
  error: null
};

const mockSupabaseClient = {
  from: jest.fn().mockReturnValue({
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(mockEmailChatResponse)
      })
    }),
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        filter: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      })
    })
  })
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

describe('Inbound Email Handler', () => {
  const mockEmail: any = {
    messageId: 'msg123',
    threadId: 'thread123',
    from: 'user@example.com',
    fromName: 'Test User',
    to: ['support@company.com'],
    subject: 'Test Subject',
    body: {
      text: 'Test email body',
      html: '<p>Test email body</p>'
    },
    date: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create new ticket and process with AI for new thread', async () => {
    // Mock no existing ticket found
    mockSupabaseClient.from().select().eq().filter().limit
      .mockResolvedValueOnce({ data: [], error: null });

    // Mock customer profile creation
    mockSupabaseClient.from().select().eq
      .mockResolvedValueOnce({ data: [{ id: 'user123' }], error: null });

    // Mock ticket creation
    mockSupabaseClient.from().insert().select().single
      .mockResolvedValueOnce(mockSupabaseResponse);

    // Mock email chat creation
    mockSupabaseClient.from().insert().select().single
      .mockResolvedValueOnce(mockEmailChatResponse);

    const result = await handleInboundEmail(mockEmail, 'org123');

    expect(result.isNewTicket).toBe(true);
    expect(result.ticketId).toBe('ticket123');
    expect(processInboundEmailWithAI).toHaveBeenCalledWith(
      'chat123',
      'Test email body',
      'org123'
    );
    expect(EmailLogger.logEmail).toHaveBeenCalled();
  });

  it('should add comment to existing ticket and process with AI', async () => {
    // Mock existing ticket found
    mockSupabaseClient.from().select().eq().filter().limit
      .mockResolvedValueOnce({ 
        data: [{ id: 'ticket123', subject: 'Test Subject' }], 
        error: null 
      });

    // Mock customer profile lookup
    mockSupabaseClient.from().select().eq
      .mockResolvedValueOnce({ data: [{ id: 'user123' }], error: null });

    // Mock comment creation
    mockSupabaseClient.from().insert()
      .mockResolvedValueOnce({ data: null, error: null });

    // Mock email chat creation
    mockSupabaseClient.from().insert().select().single
      .mockResolvedValueOnce(mockEmailChatResponse);

    const result = await handleInboundEmail(mockEmail, 'org123');

    expect(result.isNewTicket).toBe(false);
    expect(result.ticketId).toBe('ticket123');
    expect(processInboundEmailWithAI).toHaveBeenCalledWith(
      'chat123',
      'Test email body',
      'org123'
    );
    expect(EmailLogger.logEmail).toHaveBeenCalled();
  });

  it('should continue processing even if AI processing fails', async () => {
    // Mock existing ticket found
    mockSupabaseClient.from().select().eq().filter().limit
      .mockResolvedValueOnce({ 
        data: [{ id: 'ticket123', subject: 'Test Subject' }], 
        error: null 
      });

    // Mock customer profile lookup
    mockSupabaseClient.from().select().eq
      .mockResolvedValueOnce({ data: [{ id: 'user123' }], error: null });

    // Mock AI processing error
    (processInboundEmailWithAI as jest.Mock).mockRejectedValueOnce(
      new Error('AI processing failed')
    );

    const result = await handleInboundEmail(mockEmail, 'org123');

    expect(result.isNewTicket).toBe(false);
    expect(result.ticketId).toBe('ticket123');
    expect(processInboundEmailWithAI).toHaveBeenCalled();
    expect(EmailLogger.logEmail).toHaveBeenCalled();
  });
}); 