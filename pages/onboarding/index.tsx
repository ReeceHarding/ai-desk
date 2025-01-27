import { Button } from '@/components/ui/button';
import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Onboarding() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push('/auth/login');
      }
    };
    checkSession();
  }, [router, supabase.auth]);

  const handleRoleSelect = async (role: 'admin' | 'agent' | 'customer') => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        logger.error('[ONBOARDING] Auth error:', { error: userError });
        setError('Could not verify your identity');
        return;
      }

      // Update user's role
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          role,
          metadata: {
            onboarding_started_at: new Date().toISOString()
          }
        })
        .eq('id', user.id);

      if (updateError) {
        logger.error('[ONBOARDING] Profile update error:', { error: updateError });
        setError('Failed to update your role');
        return;
      }

      // Redirect based on role
      if (role === 'admin') {
        router.push('/onboarding/admin/create-org');
      } else if (role === 'agent') {
        router.push('/onboarding/agent/select-org');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      logger.error('[ONBOARDING] Unexpected error:', { error: err });
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Welcome! Let's get started
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Choose your role to continue
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Button
              onClick={() => handleRoleSelect('admin')}
              disabled={isLoading}
              className="w-full"
            >
              I'm an Admin
            </Button>

            <Button
              onClick={() => handleRoleSelect('agent')}
              disabled={isLoading}
              className="w-full"
            >
              I'm a Support Agent
            </Button>

            <Button
              onClick={() => handleRoleSelect('customer')}
              disabled={isLoading}
              className="w-full"
            >
              I Need Support
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 
