import { maintainGmailWatches } from '@/utils/gmail-maintenance';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('googleapis', () => ({
  google: {
    gmail: jest.fn(() => ({
      users: {
        getProfile: jest.fn(),
      },
    })),
    auth: {
      OAuth2: jest.fn(() => ({
        setCredentials: jest.fn(),
      })),
    },
  },
}));

describe('Gmail Maintenance', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          not: jest.fn(() => Promise.resolve({
            data: [
              {
                id: 'org1',
                gmail_access_token: 'token1',
                gmail_refresh_token: 'refresh1',
                gmail_watch_expiration: new Date(Date.now() - 1000).toISOString(),
                gmail_watch_status: 'expired',
              },
              {
                id: 'org2',
                gmail_access_token: 'token2',
                gmail_refresh_token: 'refresh2',
                gmail_watch_expiration: new Date(Date.now() + 1000000).toISOString(),
                gmail_watch_status: 'active',
              },
            ],
            error: null,
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should process organizations and profiles with expired watches', async () => {
    await maintainGmailWatches();

    // Verify Supabase queries
    expect(mockSupabase.from).toHaveBeenCalledWith('organizations');
    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');

    // Verify select calls
    const selectCalls = mockSupabase.from().select.mock.calls;
    expect(selectCalls[0][0]).toBe(
      'id, gmail_access_token, gmail_refresh_token, gmail_watch_expiration, gmail_watch_status'
    );
    expect(selectCalls[1][0]).toBe(
      'id, gmail_access_token, gmail_refresh_token, gmail_watch_expiration, gmail_watch_status'
    );
  });

  it('should handle errors gracefully', async () => {
    // Mock a failure
    mockSupabase.from = jest.fn(() => ({
      select: jest.fn(() => ({
        not: jest.fn(() => Promise.reject(new Error('Database error'))),
      })),
    }));

    await expect(maintainGmailWatches()).rejects.toThrow('Database error');
  });

  it('should skip active watches that are not expiring soon', async () => {
    await maintainGmailWatches();

    // Check that we didn't try to update the active watch
    const updateCalls = mockSupabase.from().update.mock.calls;
    expect(updateCalls.length).toBe(1); // Only one update for the expired watch
  });

  it('should update watch status when refresh succeeds', async () => {
    // Mock successful watch refresh
    const mockWatchResult = {
      expiration: Date.now() + 1000000,
      resourceId: 'new-resource-id',
    };

    (google.gmail().users.watch as jest.Mock).mockResolvedValueOnce({
      data: mockWatchResult,
    });

    await maintainGmailWatches();

    // Verify status update
    expect(mockSupabase.from().update).toHaveBeenCalledWith(
      expect.objectContaining({
        gmail_watch_status: 'active',
        gmail_watch_resource_id: mockWatchResult.resourceId,
      })
    );
  });
}); 