import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const error = await supabase.auth.getSession();
      if (error) {
        console.log('Error getting session:', error);
        router.push('/auth/signin');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found');
        router.push('/auth/signin');
        return;
      }

      console.log('User found:', user);
      router.push('/dashboard');
    };

    handleAuthCallback();
  }, [router, supabase]);

  return null;
} 