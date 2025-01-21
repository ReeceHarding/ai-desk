import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  console.log('[MIDDLEWARE] Starting middleware check for:', req.nextUrl.pathname);
  
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  console.log('[MIDDLEWARE] Session check:', {
    hasSession: !!session,
    userId: session?.user?.id,
    path: req.nextUrl.pathname
  });

  // Auth condition
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth');
  const isApiPage = req.nextUrl.pathname.startsWith('/api');
  const isRootPage = req.nextUrl.pathname === '/';

  console.log('[MIDDLEWARE] Route type:', {
    isAuthPage,
    isApiPage,
    isRootPage
  });

  // If at root route, redirect based on auth status
  if (isRootPage) {
    const destination = session ? '/dashboard' : '/auth/signin';
    console.log('[MIDDLEWARE] Root redirect to:', destination);
    return NextResponse.redirect(new URL(destination, req.url));
  }

  // If user is signed in and tries to access auth page, redirect to dashboard
  if (session && isAuthPage) {
    console.log('[MIDDLEWARE] Authenticated user accessing auth page, redirecting to dashboard');
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // If user is not signed in and tries to access protected page, redirect to sign in
  if (!session && !isAuthPage && !isApiPage) {
    let from = req.nextUrl.pathname;
    if (req.nextUrl.search) {
      from += req.nextUrl.search;
    }
    
    console.log('[MIDDLEWARE] Unauthenticated user accessing protected page:', {
      from,
      redirectTo: `/auth/signin?from=${encodeURIComponent(from)}`
    });
    
    return NextResponse.redirect(
      new URL(`/auth/signin?from=${encodeURIComponent(from)}`, req.url)
    );
  }

  console.log('[MIDDLEWARE] Allowing request to proceed');
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/v1/callback (Supabase auth callback)
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/v1/callback).*)',
  ],
}; 