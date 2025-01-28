import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      console.log('[AUTH_CALLBACK] Starting auth callback handling');
      
      try {
        console.log('[AUTH_CALLBACK] Getting session');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[AUTH_CALLBACK] Error getting session:', sessionError);
          router.push('/auth/signin');
          return;
        }

        console.log('[AUTH_CALLBACK] Session check result:', {
          hasSession: !!session,
          hasTokenHash: !!router.query.token_hash
        });

        if (!session) {
          // Check if this is an email confirmation
          if (router.query.token_hash) {
            console.log('[AUTH_CALLBACK] Attempting email confirmation with token hash');
            const { error: confirmError } = await supabase.auth.verifyOtp({
              token_hash: router.query.token_hash as string,
              type: 'email',
            });

            if (confirmError) {
              console.error('[AUTH_CALLBACK] Error confirming email:', confirmError);
              router.push('/auth/signin');
              return;
            }

            console.log('[AUTH_CALLBACK] Email confirmed, getting user');
            // After email confirmation, get the user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            
            if (userError || !user) {
              console.error('[AUTH_CALLBACK] Error getting user after confirmation:', userError);
              router.push('/auth/signin');
              return;
            }

            console.log('[AUTH_CALLBACK] Email confirmed and user found:', {
              userId: user.id,
              email: user.email
            });
            router.push('/dashboard');
            return;
          } else {
            console.log('[AUTH_CALLBACK] No session and no token hash, redirecting to signin');
            router.push('/auth/signin');
            return;
          }
        }

        console.log('[AUTH_CALLBACK] Valid session found, redirecting to dashboard');
        // We have a session, redirect to dashboard
        router.push('/dashboard');
      } catch (error) {
        console.error('[AUTH_CALLBACK] Unexpected error in auth callback:', error);
        router.push('/auth/signin');
      }
    };

    handleAuthCallback();
  }, [router, supabase]);

  return null;
} 