import { logger } from '@/utils/logger';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  try {
    const supabase = createMiddlewareClient({ req, res });
    
    // Refresh session if expired - required for Server Components
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      logger.error('Middleware Session Error:', { error });
    }

    // Log the request for debugging
    logger.info(`${req.method} ${req.nextUrl.pathname}`, {
      url: req.url,
      headers: Object.fromEntries(req.headers),
      geo: req.geo,
      ip: req.ip
    });

    // Get the requested path
    const path = req.nextUrl.pathname;

    // Skip middleware for auth routes and static files
    if (
      path.startsWith('/auth/') ||
      path.startsWith('/_next/') ||
      path.startsWith('/api/') ||
      path === '/favicon.ico'
    ) {
      return res;
    }

    // For all other routes, require authentication
    if (!session) {
      // Don't redirect if already on signin page
      if (path === '/auth/signin') {
        return res;
      }
      const redirectUrl = new URL('/auth/signin', req.url);
      redirectUrl.searchParams.set('redirect', req.url);
      return NextResponse.redirect(redirectUrl);
    }

    // For organization-specific routes
    const orgSlugMatch = path.match(/^\/([^\/]+)/);
    if (orgSlugMatch) {
      const orgSlug = orgSlugMatch[1];

      // Skip middleware for public routes
      if (path === `/${orgSlug}/new-ticket`) {
        const { data: org } = await supabase
          .from('organizations')
          .select('public_mode')
          .eq('slug', orgSlug)
          .single();

        if (org?.public_mode) {
          return res;
        }
      }

      // For ticket-specific routes, check if user has access
      const ticketMatch = path.match(/^\/[^\/]+\/tickets\/([^\/]+)/);
      if (ticketMatch) {
        const ticketId = ticketMatch[1];
        
        // Skip check for tickets list page
        if (ticketId === 'index') {
          return res;
        }

        // Check if user owns the ticket or is an agent/admin
        const { data: ticket } = await supabase
          .from('tickets')
          .select('customer_id, org_id')
          .eq('id', ticketId)
          .single();

        if (!ticket) {
          logger.warn(`Ticket not found: ${ticketId}`, { path });
          return NextResponse.redirect(new URL('/404', req.url));
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        const isAgent = profile?.role === 'agent' || profile?.role === 'admin';
        const isCustomer = ticket.customer_id === session.user.id;

        if (!isAgent && !isCustomer) {
          logger.warn(`Access denied to ticket: ${ticketId}`, { 
            userId: session.user.id,
            isAgent,
            isCustomer 
          });
          return NextResponse.redirect(new URL('/403', req.url));
        }
      }
    }

    return res;
  } catch (error) {
    logger.error('Middleware Error:', { error });
    return res;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}; 