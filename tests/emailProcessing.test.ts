describe('AI Draft Generation', () => {
  it('should store AI draft for genuine emails', async () => {
    // Test setup
    mockSupabase
      .from('processed_messages')
      .update({ ai_draft: 'test draft' })
      .reply(200);

    await processPotentialPromotionalEmail(
      'test-chat-id',
      'test-org',
      'genuine email content',
      'msg123'
    );

    // Verify supabase update was called
    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        ai_draft: expect.any(String)
      })
    );
  });
});
