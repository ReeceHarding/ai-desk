import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Auth condition
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth');
  const isApiPage = req.nextUrl.pathname.startsWith('/api');
  const isRootPage = req.nextUrl.pathname === '/';

  // If at root route, redirect based on auth status
  if (isRootPage) {
    return NextResponse.redirect(new URL(session ? '/dashboard' : '/auth/signin', req.url));
  }

  // If user is signed in and tries to access auth page, redirect to dashboard
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // If user is not signed in and tries to access protected page, redirect to sign in
  if (!session && !isAuthPage && !isApiPage) {
    let from = req.nextUrl.pathname;
    if (req.nextUrl.search) {
      from += req.nextUrl.search;
    }
    
    return NextResponse.redirect(
      new URL(`/auth/signin?from=${encodeURIComponent(from)}`, req.url)
    );
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}; 