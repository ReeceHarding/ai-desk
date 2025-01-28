import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Keep track of redirects to prevent loops
const redirectCache = new Map<string, number>();

export async function middleware(req: NextRequest) {
  console.log('[MIDDLEWARE] Starting middleware check for:', req.nextUrl.pathname);
  
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Route conditions
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth');
  const isApiPage = req.nextUrl.pathname.startsWith('/api');
  const isRootPage = req.nextUrl.pathname === '/';
  const isCustomerPage = req.nextUrl.pathname.startsWith('/customer');
  const isDataRequest = req.nextUrl.pathname.includes('/_next/data/');
  const isStaticRequest = req.nextUrl.pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|json)$/);
  const isClientSideNavigation = req.headers.get('x-middleware-prefetch') === '1';
  const isSignUpPage = req.nextUrl.pathname.startsWith('/auth/signup');
  const isCustomerSignUp = req.nextUrl.pathname === '/auth/signup/customer';
  const isAgentSignUp = req.nextUrl.pathname === '/auth/signup/agent';

  // Skip middleware for static and data requests
  if (isDataRequest || isStaticRequest || isApiPage) {
    return res;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  console.log('[MIDDLEWARE] Session check:', {
    hasSession: !!session,
    userId: session?.user?.id,
    path: req.nextUrl.pathname,
    isClientSideNavigation
  });

  // Allow access to root and signup pages for everyone
  if (isRootPage || isSignUpPage || isCustomerSignUp || isAgentSignUp) {
    return res;
  }

  // Check for redirect loops
  const cacheKey = `${session?.user?.id}:${req.nextUrl.pathname}`;
  const now = Date.now();
  const lastRedirect = redirectCache.get(cacheKey);
  
  if (lastRedirect && now - lastRedirect < 1000) {
    console.log('[MIDDLEWARE] Detected potential redirect loop, allowing request');
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

    const redirectUrl = new URL(
      profile?.role === 'customer' ? '/customer' :
      profile?.role === 'admin' ? '/admin' :
      profile?.role === 'agent' ? '/dashboard' :
      '/dashboard',
      req.url
    );

    // Store redirect timestamp
    redirectCache.set(cacheKey, now);

    const response = NextResponse.redirect(redirectUrl);
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  }

  // If user is not signed in and tries to access protected page, redirect to landing page
  if (!session && !isAuthPage) {
    const from = req.nextUrl.pathname + req.nextUrl.search;
    
    console.log('[MIDDLEWARE] Unauthenticated user accessing protected page:', {
      from,
      redirectTo: `/?from=${encodeURIComponent(from)}`
    });

    // Store redirect timestamp
    redirectCache.set(cacheKey, now);
    
    const response = NextResponse.redirect(
      new URL(`/?from=${encodeURIComponent(from)}`, req.url)
    );
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  }

  // Role-based access control for authenticated users
  if (session && !isAuthPage) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    // Protect customer routes
    if (isCustomerPage && profile?.role !== 'customer') {
      console.log('[MIDDLEWARE] Non-customer attempting to access customer routes');
      redirectCache.set(cacheKey, now);
      const response = NextResponse.redirect(new URL('/dashboard', req.url));
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      return response;
    }

    // Redirect customers to customer portal if they try to access other areas
    if (!isCustomerPage && profile?.role === 'customer') {
      console.log('[MIDDLEWARE] Customer attempting to access non-customer routes');
      redirectCache.set(cacheKey, now);
      const response = NextResponse.redirect(new URL('/customer', req.url));
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      return response;
    }
  }

  console.log('[MIDDLEWARE] Allowing request to proceed');
  return res;
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|_next/data|api/auth|favicon.ico|.*\\..*$).*)',
  ],
}; 