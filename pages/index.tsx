import { Database } from '@/types/supabase';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = createServerSupabaseClient<Database>(ctx);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  console.log('[Index] Session check:', session ? 'Found session' : 'No session');

  if (!session) {
    console.log('[Index] No session, redirecting to /auth/signin');
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    };
  }

  // Get user's profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name, role, org_id')
    .eq('id', session.user.id)
    .single();

  console.log('[Index] Profile check:', {
    found: !!profile,
    hasDisplayName: !!profile?.display_name,
    role: profile?.role,
    error: profileError?.message
  });

  // If no profile or no display_name, redirect to onboarding
  if (!profile || !profile.display_name) {
    console.log('[Index] Missing profile or display_name, redirecting to /onboarding');
    return {
      redirect: {
        destination: '/onboarding',
        permanent: false,
      },
    };
  }

  // Get user's organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('slug')
    .or(`owner_id.eq.${session.user.id},id.eq.${profile?.org_id}`)
    .single();

  console.log('[Index] Organization check:', {
    found: !!org,
    slug: org?.slug,
    error: orgError?.message,
    userId: session.user.id,
    orgId: profile?.org_id
  });

  if (!org) {
    console.log('[Index] No organization found, redirecting to /onboarding');
    return {
      redirect: {
        destination: '/onboarding',
        permanent: false,
      },
    };
  }

  // Redirect to appropriate page based on role
  if (profile.role === 'customer') {
    console.log('[Index] Customer role detected, redirecting to new-ticket page');
    return {
      redirect: {
        destination: `/${org.slug}/new-ticket`,
        permanent: false,
      },
    };
  }

  console.log('[Index] Agent role detected, redirecting to dashboard');
  return {
    redirect: {
      destination: `/${org.slug}/dashboard`,
      permanent: false,
    },
  };
}

// This page never renders, it only redirects
export default function Home() {
  return null;
} 