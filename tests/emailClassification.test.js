const { classifyEmail } = require('../services/emailClassifier');
const { mockPromotional, mockGenuine } = require('./fixtures/emailMocks');

describe('Email Classification', () => {
  test('Identifies promotional emails', async () => {
    const result = await classifyEmail(mockPromotional);
    expect(result.isPromotional).toBe(true);
  });

  test('Flags genuine emails for AI drafting', async () => {
    const result = await classifyEmail(mockGenuine);
    expect(result.needsDraft).toBe(true);
  });
});
