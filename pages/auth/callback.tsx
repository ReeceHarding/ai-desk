import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { searchParams } = new URL(window.location.href);
      const code = searchParams.get('code');
      const next = searchParams.get('next') ?? '/dashboard';

      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
          router.push(next);
        } catch (error) {
          console.error('Error exchanging code for session:', error);
          router.push('/auth/signin?error=Unable to verify your email');
        }
      }
    };

    handleAuthCallback();
  }, [router, supabase.auth]);

  return null;
} 