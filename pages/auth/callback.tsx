import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('[AUTH-CALLBACK] Starting auth callback handler');
        console.log('[AUTH-CALLBACK] Query params:', router.query);
        
        // Check if we have a session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        console.log('[AUTH-CALLBACK] Session check result:', {
          hasSession: !!session,
          error: sessionError?.message,
          userId: session?.user?.id
        });

        if (sessionError) {
          throw sessionError;
        }

        if (session) {
          console.log('[AUTH-CALLBACK] Session found, checking profile...');
          
          // Check if profile exists
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          console.log('[AUTH-CALLBACK] Profile check result:', {
            hasProfile: !!profile,
            error: profileError?.message
          });

          // Successful sign in - redirect to dashboard
          console.log('[AUTH-CALLBACK] Redirecting to dashboard');
          router.replace('/dashboard');
        } else {
          console.log('[AUTH-CALLBACK] No session found, redirecting to signin');
          router.replace('/auth/signin?error=No session found');
        }
      } catch (error) {
        console.error('[AUTH-CALLBACK] Error in auth callback:', error);
        router.replace('/auth/signin?error=Authentication failed');
      }
    };

    handleAuthCallback();
  }, [router, supabase.auth]);

  return null;
} 