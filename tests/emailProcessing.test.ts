import { processEmail } from '@/utils/email-processor';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockAiResponder, mockEmailParser, mockSupabase, resetAllMocks } from '../test/helpers';

vi.mock('@/utils/ai-responder', () => mockAiResponder);
vi.mock('@/utils/email-parser', () => mockEmailParser);
vi.mock('@supabase/auth-helpers-nextjs', () => ({
  createClient: () => mockSupabase,
}));

describe('AI Draft Generation', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should store AI draft for genuine emails', async () => {
    // Arrange
    const mockMessage = {
      id: 'test-message-id',
      threadId: 'test-thread-id',
      payload: {
        headers: [
          { name: 'Subject', value: 'Test Subject' },
          { name: 'From', value: 'test@example.com' },
        ],
        body: { data: 'Test body' },
      },
    };

    mockEmailParser.parseGmailMessage.mockReturnValue({
      subject: 'Test Subject',
      body: 'Test body',
      from: 'test@example.com',
      to: 'support@example.com',
      threadId: 'test-thread-id',
    });

    mockAiResponder.classifyEmail.mockResolvedValue({
      isPromotional: false,
      needsDraft: true,
    });

    mockAiResponder.generateDraft.mockResolvedValue('AI generated response');

    mockSupabase.from.mockReturnValue({
      ...mockSupabase,
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    // Act
    await processEmail(mockMessage);

    // Assert
    expect(mockEmailParser.parseGmailMessage).toHaveBeenCalledWith(mockMessage);
    expect(mockAiResponder.classifyEmail).toHaveBeenCalled();
    expect(mockAiResponder.generateDraft).toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('processed_messages');
    expect(mockSupabase.update).toHaveBeenCalledWith({
      ai_draft: 'AI generated response',
    });
  });
});
