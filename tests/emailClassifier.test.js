import { EmailClassifier } from '../services/emailClassifier';

describe('EmailClassifier', () => {
  test('flags promotional content', () => {
    const promotionalEmail = {
      subject: 'Limited Time Offer!',
      body: 'Special discount just for you'
    };
    expect(EmailClassifier.isPromotional(promotionalEmail)).toBe(true);
  });

  test('passes genuine emails', () => {
    const genuineEmail = {
      subject: 'Meeting Request',
      body: 'Can we schedule a call tomorrow?'
    };
    expect(EmailClassifier.isPromotional(genuineEmail)).toBe(false);
  });
});
