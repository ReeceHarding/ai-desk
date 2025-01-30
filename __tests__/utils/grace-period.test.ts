import { closeTicket, handleTicketReopening, isWithinGracePeriod } from '@/utils/grace-period';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('Grace Period Utils', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({
            data: [{
              id: 'ticket1',
              status: 'closed',
              updated_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
            }],
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

  describe('isWithinGracePeriod', () => {
    it('should return true for tickets closed within grace period', async () => {
      const result = await isWithinGracePeriod('ticket1');
      expect(result).toBe(true);
    });

    it('should return false for tickets closed outside grace period', async () => {
      // Mock a ticket closed 35 days ago
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({
            data: [{
              id: 'ticket1',
              status: 'closed',
              updated_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
            }],
            error: null,
          })),
        })),
      }));

      const result = await isWithinGracePeriod('ticket1');
      expect(result).toBe(false);
    });

    it('should handle non-existent tickets', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({
            data: [],
            error: null,
          })),
        })),
      }));

      await expect(isWithinGracePeriod('nonexistent')).rejects.toThrow('Ticket not found');
    });
  });

  describe('handleTicketReopening', () => {
    it('should reopen ticket within grace period', async () => {
      await handleTicketReopening('ticket1');

      // Verify ticket status update
      expect(mockSupabase.from).toHaveBeenCalledWith('tickets');
      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        status: 'open',
        updated_at: expect.any(String),
      });
    });

    it('should not reopen ticket outside grace period', async () => {
      // Mock a ticket closed 35 days ago
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({
            data: [{
              id: 'ticket1',
              status: 'closed',
              updated_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
            }],
            error: null,
          })),
        })),
      }));

      await handleTicketReopening('ticket1');
      expect(mockSupabase.from().update).not.toHaveBeenCalled();
    });
  });

  describe('closeTicket', () => {
    it('should close ticket and update timestamp', async () => {
      await closeTicket('ticket1');

      // Verify ticket status update
      expect(mockSupabase.from).toHaveBeenCalledWith('tickets');
      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        status: 'closed',
        updated_at: expect.any(String),
      });
    });

    it('should handle database errors', async () => {
      mockSupabase.from = jest.fn(() => ({
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ error: new Error('Database error') })),
        })),
      }));

      await expect(closeTicket('ticket1')).rejects.toThrow('Failed to close ticket');
    });
  });
}); 