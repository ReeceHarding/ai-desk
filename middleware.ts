import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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

  // Route conditions
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth');
  const isApiPage = req.nextUrl.pathname.startsWith('/api');
  const isRootPage = req.nextUrl.pathname === '/';
  const isCustomerPage = req.nextUrl.pathname.startsWith('/customer');

  console.log('[MIDDLEWARE] Route type:', {
    isAuthPage,
    isApiPage,
    isRootPage,
    isCustomerPage
  });

  // If at root route, allow access to landing page
  if (isRootPage) {
    return res;
  }

  // If user is signed in and tries to access auth page, redirect to appropriate dashboard
  if (session && isAuthPage) {
    console.log('[MIDDLEWARE] Authenticated user accessing auth page, checking role for redirect');
    
    // Get user's role from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role === 'customer') {
      return NextResponse.redirect(new URL('/customer', req.url));
    } else if (profile?.role === 'agent') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    } else if (profile?.role === 'admin') {
      return NextResponse.redirect(new URL('/admin', req.url));
    }

    // Default to dashboard if role is not determined
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // If user is not signed in and tries to access protected page, redirect to sign in
  if (!session && !isAuthPage && !isApiPage && !isRootPage) {
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

  // Role-based access control for authenticated users
  if (session && !isAuthPage && !isApiPage && !isRootPage) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    // Protect customer routes
    if (isCustomerPage && profile?.role !== 'customer') {
      console.log('[MIDDLEWARE] Non-customer attempting to access customer routes');
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Redirect customers to customer portal if they try to access other areas
    if (!isCustomerPage && profile?.role === 'customer') {
      console.log('[MIDDLEWARE] Customer attempting to access non-customer routes');
      return NextResponse.redirect(new URL('/customer', req.url));
    }
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