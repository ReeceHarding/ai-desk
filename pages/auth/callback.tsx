import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting session:', sessionError);
          router.push('/auth/signin');
          return;
        }

        if (!session) {
          // Check if this is an email confirmation
          const { error: confirmError } = await supabase.auth.verifyOtp({
            token_hash: router.query.token_hash as string,
            type: 'email',
          });

          if (confirmError) {
            console.error('Error confirming email:', confirmError);
            router.push('/auth/signin');
            return;
          }

          // After email confirmation, get the user
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          
          if (userError || !user) {
            console.error('Error getting user after confirmation:', userError);
            router.push('/auth/signin');
            return;
          }

          console.log('Email confirmed and user found:', user);
          router.push('/dashboard');
          return;
        }

        // We have a session, redirect to dashboard
        router.push('/dashboard');
      } catch (error) {
        console.error('Unexpected error in auth callback:', error);
        router.push('/auth/signin');
      }
    };

    handleAuthCallback();
  }, [router, supabase]);

  return null;
} 