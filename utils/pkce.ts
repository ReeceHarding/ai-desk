/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth flows
 */

/**
 * Generates a random string of specified length for use as a PKCE verifier
 */
export function generatePKCEVerifier(length: number = 56): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/**
 * Generates a PKCE challenge from a verifier string
 */
export async function generatePKCEChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(hash));
}

/**
 * Encodes a Uint8Array to a base64URL string
 */
export function base64URLEncode(array: Uint8Array): string {
  const base64 = btoa(String.fromCharCode.apply(null, Array.from(array)));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Gets the code verifier key for Supabase
 */
export function getCodeVerifierKey(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
  }
  return `sb-${supabaseUrl.split('//')[1]}-auth-token-code-verifier`;
} 