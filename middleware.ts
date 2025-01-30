import type { Database } from '@/types/supabase';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Keep track of redirects to prevent loops
const redirectCache = new Map<string, number>();

export async function middleware(request: NextRequest) {
  console.log('[MIDDLEWARE] Starting middleware check for:', request.nextUrl.pathname);
  
  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req: request, res });

  // Skip middleware for static and data requests
  if (
    request.nextUrl.pathname.includes('/_next/data/') ||
    request.nextUrl.pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|json)$/) ||
    request.nextUrl.pathname.startsWith('/api')
  ) {
    return res;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Allow access to public routes
  if (
    request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname.startsWith('/auth')
  ) {
    return res;
  }

  // Check for redirect loops
  const cacheKey = `${session?.user?.id}:${request.nextUrl.pathname}`;
  const now = Date.now();
  const lastRedirect = redirectCache.get(cacheKey);
  
  if (lastRedirect && now - lastRedirect < 1000) {
    console.log('[MIDDLEWARE] Detected potential redirect loop, allowing request');
    return res;
  }

  // If no session, redirect to login for protected routes
  if (!session) {
    if (
      request.nextUrl.pathname.startsWith('/admin') ||
      request.nextUrl.pathname.startsWith('/agent') ||
      request.nextUrl.pathname.startsWith('/customer')
    ) {
      console.log('[MIDDLEWARE] Unauthenticated user accessing protected page');
      redirectCache.set(cacheKey, now);
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }
    return res;
  }

  // Get user's profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  const role = profile?.role;
  const path = request.nextUrl.pathname;

  // Admin routes protection
  if (path.startsWith('/admin') && role !== 'admin' && role !== 'super_admin') {
    console.log('[MIDDLEWARE] Non-admin user accessing admin routes');
    redirectCache.set(cacheKey, now);
    return NextResponse.redirect(new URL(role === 'customer' ? '/customer' : '/agent', request.url));
  }

  // Agent routes protection
  if (path.startsWith('/agent') && role !== 'agent' && role !== 'admin' && role !== 'super_admin') {
    console.log('[MIDDLEWARE] Non-agent user accessing agent routes');
    redirectCache.set(cacheKey, now);
    return NextResponse.redirect(new URL(role === 'customer' ? '/customer' : '/', request.url));
  }

  // Customer routes protection
  if (path.startsWith('/customer') && role !== 'customer' && role !== 'agent' && role !== 'admin' && role !== 'super_admin') {
    console.log('[MIDDLEWARE] Non-customer user accessing customer routes');
    redirectCache.set(cacheKey, now);
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Redirect /settings to /profile/settings
  if (path === '/settings') {
    return NextResponse.redirect(new URL('/profile/settings', request.url));
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|auth).*)',
    '/settings',
  ],
}; 