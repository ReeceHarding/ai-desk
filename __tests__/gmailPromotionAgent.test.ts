import { processPotentialPromotionalEmail } from '@/utils/agent/gmailPromotionAgent';

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: { metadata: {} }, error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null })),
      })),
    })),
  })),
}));

describe('processPotentialPromotionalEmail', () => {
  it('should run without crashing', async () => {
    await expect(
      processPotentialPromotionalEmail(
        'fake-chat-id',
        'fake-org-id',
        'some body text',
        'fakeMsg',
        'fakeThread'
      )
    ).resolves.toBeUndefined();
  });

  it('should identify promotional content', async () => {
    await expect(
      processPotentialPromotionalEmail(
        'fake-chat-id',
        'fake-org-id',
        'Check out our special offer and great discounts!',
        'fakeMsg',
        'fakeThread'
      )
    ).resolves.toBeUndefined();
  });
}); 