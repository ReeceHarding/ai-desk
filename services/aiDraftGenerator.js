import OpenAI from 'openai';

export class AIDraftGenerator {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Missing OPENAI_API_KEY in environment variables');
    }
    this.openai = new OpenAI(process.env.OPENAI_API_KEY);
  }

  async generateDraft(emailContent, knowledgeBase) {
    const prompt = `Generate a professional email response based on the following query:\n\n${emailContent}\n\nOrganization Knowledge:\n${knowledgeBase}`;
    
    return this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{role: "user", content: prompt}],
      temperature: 0.7,
    });
  }
}
