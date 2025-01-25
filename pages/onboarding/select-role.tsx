import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function SelectRole() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'customer' | 'agent' | 'admin' | ''>('');
  const [displayName, setDisplayName] = useState('');
  const supabase = createClientComponentClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      setError('Please select a role');
      return;
    }

    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.info('Updating profile:', { role: selectedRole, displayName });

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .update({ 
          role: selectedRole,
          display_name: displayName.trim(),
          metadata: {
            signup_completed: true,
            onboarding_started_at: new Date().toISOString()
          }
        })
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .select()
        .single();

      if (profileError) {
        logger.error('Error updating profile:', { error: profileError });
        setError('Failed to update profile. Please try again.');
        return;
      }

      // Redirect based on role
      switch (selectedRole) {
        case 'customer':
          router.push('/onboarding/customer/select-org');
          break;
        case 'agent':
          router.push('/onboarding/agent/select-org');
          break;
        case 'admin':
          router.push('/onboarding/admin/create-org');
          break;
      }
    } catch (err) {
      logger.error('Error in profile update:', { error: err });
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Welcome to Zendesk Clone
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Let's get to know you better
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                Your Name
              </label>
              <input
                type="text"
                id="displayName"
                name="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
                placeholder="Enter your full name"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                How will you use our platform?
              </label>
              <select
                id="role"
                name="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as 'customer' | 'agent' | 'admin')}
                disabled={isLoading}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                required
              >
                <option value="">Choose a role</option>
                <option value="customer">I need support (Customer)</option>
                <option value="agent">I provide support (Agent)</option>
                <option value="admin">I manage support teams (Admin)</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading || !selectedRole || !displayName.trim()}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : 'Continue'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 