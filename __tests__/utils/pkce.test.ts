import { generatePKCEChallenge, generatePKCEVerifier } from '@/utils/pkce';

describe('PKCE Utils', () => {
  it('generates a verifier string', () => {
    const verifier = generatePKCEVerifier();
    expect(typeof verifier).toBe('string');
    expect(verifier.length).toBeGreaterThan(0);
  });

  it('generates a challenge from verifier', async () => {
    const verifier = generatePKCEVerifier();
    const challenge = await generatePKCEChallenge(verifier);
    expect(typeof challenge).toBe('string');
    expect(challenge.length).toBeGreaterThan(0);
  });
}); 

