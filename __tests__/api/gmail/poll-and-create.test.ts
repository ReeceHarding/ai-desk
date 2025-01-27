import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/gmail/poll-and-create';
import { pollGmailInbox } from '../../../utils/gmail';

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('../../../utils/gmail');

describe('Gmail Poll and Create API', () => {
  let mockReq: Partial<NextApiRequest>;
  let mockRes: Partial<NextApiResponse>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockSupabase: any;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockReq = {
      method: 'POST',
      body: { userId: 'test-user-id' }
    };
    mockRes = {
      status: mockStatus
    };

    // Setup mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                email: 'test@example.com',
                org_id: 'test-org',
                gmail_access_token: 'test-access-token',
                gmail_refresh_token: 'test-refresh-token'
              },
              error: null
            })
          })
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-ticket-id',
                subject: 'Test Subject',
                status: 'open'
              },
              error: null
            })
          })
        })
      })
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    (pollGmailInbox as jest.Mock).mockResolvedValue([{
      messageId: 'test-message-id',
      threadId: 'test-thread-id',
      from: { email: 'test@example.com', name: 'Test User' },
      to: [{ email: 'recipient@example.com', name: 'Recipient' }],
      subject: 'Test Subject',
      body: { text: 'Test body', html: '<p>Test body</p>' },
      date: new Date().toISOString(),
      headers: {
        'message-id': '<test-message-id>',
        'in-reply-to': null,
        references: null
      }
    }]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns 405 for non-POST requests', async () => {
    mockReq.method = 'GET';
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(405);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  test('returns 400 if userId is missing', async () => {
    mockReq.body = {};
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'User ID is required' });
  });

  test('handles profile fetch error', async () => {
    mockSupabase.from().select().eq().single.mockResolvedValueOnce({
      data: null,
      error: new Error('Profile not found')
    });

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Failed to fetch user profile'
    }));
  });

  test('handles missing Gmail tokens', async () => {
    mockSupabase.from().select().eq().single.mockResolvedValueOnce({
      data: {
        email: 'test@example.com',
        org_id: 'test-org'
      },
      error: null
    });

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Gmail not connected'
    }));
  });

  test('successfully polls and creates tickets', async () => {
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Successfully polled Gmail and created tickets',
      ticketsCreated: 1
    }));
  });
}); 
