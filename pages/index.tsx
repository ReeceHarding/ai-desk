import { logger } from '@/src/utils/logger';
import { Database } from '@/types/supabase';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import type { GetServerSidePropsContext, NextPage } from 'next/types';

type Organization = {
  slug: string;
};

type Profile = Database['public']['Tables']['profiles']['Row'];
type OrganizationMember = Database['public']['Tables']['organization_members']['Row'];

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  const supabase = createServerSupabaseClient<Database>(ctx);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  logger.info('[Index] Session check', { 
    hasSession: !!session 
  });

  if (!session) {
    logger.info('[Index] No session, redirecting to /auth/signin');
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
    .single<Profile>();

  logger.info('[Index] Profile check', {
    found: !!profile,
    hasDisplayName: !!profile?.display_name,
    role: profile?.role,
    error: profileError?.message,
    orgId: profile?.org_id
  });

  // If no profile or no display_name, redirect to onboarding
  if (!profile || !profile.display_name) {
    logger.info('[Index] Missing profile or display_name, redirecting to /onboarding');
    return {
      redirect: {
        destination: '/onboarding',
        permanent: false,
      },
    };
  }

  // First, check organization_members table
  const { data: memberData, error: memberError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', session.user.id)
    .single();

  logger.info('[Index] Organization member check', {
    found: !!memberData,
    error: memberError?.message,
    data: memberData,
    userId: session.user.id,
    errorCode: memberError?.code,
    details: memberError?.details
  });

  if (memberError || !memberData) {
    logger.info('[Index] No organization membership found, redirecting to /onboarding');
    return {
      redirect: {
        destination: '/onboarding',
        permanent: false,
      },
    };
  }

  // Now get the organization details
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', memberData.organization_id)
    .single();

  logger.info('[Index] Organization details check', {
    found: !!orgData,
    error: orgError?.message,
    data: orgData,
    orgId: memberData.organization_id
  });

  if (orgError || !orgData || !orgData.slug) {
    logger.info('[Index] Organization not found or missing slug, redirecting to /onboarding');
    return {
      redirect: {
        destination: '/onboarding',
        permanent: false,
      },
    };
  }

  const org: Organization = { slug: orgData.slug };

  // Redirect to appropriate page based on role
  if (profile.role === 'customer') {
    logger.info('[Index] Customer role detected, redirecting to new-ticket page');
    return {
      redirect: {
        destination: `/${org.slug}/new-ticket`,
        permanent: false,
      },
    };
  }

  logger.info('[Index] Agent role detected, redirecting to dashboard');
  return {
    redirect: {
      destination: `/${org.slug}/dashboard`,
      permanent: false,
    },
  };
};

const Home: NextPage = () => {
  return null;
};

export default Home; 