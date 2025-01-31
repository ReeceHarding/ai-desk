const PROMOTIONAL_KEYWORDS = ['unsubscribe', 'promotion', 'special offer', 'discount', 'limited time'];

export class EmailClassifier {
  static isPromotional(email) {
    const content = `${email.subject} ${email.body}`.toLowerCase();
    return PROMOTIONAL_KEYWORDS.some(keyword => content.includes(keyword));
  }
}
