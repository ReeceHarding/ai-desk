import { logger } from '@/utils/logger';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';
  const origin = requestUrl.origin;

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        logger.error('[CALLBACK_PAGE] Error exchanging code for session:', error);
        return NextResponse.redirect(`${origin}/auth/error?error=${encodeURIComponent(error.message)}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    } catch (error) {
      logger.error('[CALLBACK_PAGE] Unexpected error during code exchange:', error);
      return NextResponse.redirect(`${origin}/auth/error?error=${encodeURIComponent('An unexpected error occurred')}`);
    }
  }

  // Return 400 if no code provided
  return NextResponse.redirect(`${origin}/auth/error?error=${encodeURIComponent('No code provided')}`);
} 