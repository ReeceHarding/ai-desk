import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function InviteAgentPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'agent' | 'admin'>('agent');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const supabase = createClientComponentClient<Database>();

  // Check user session and admin status on mount
  useEffect(() => {
    checkUserAccess();
  }, []);

  async function checkUserAccess() {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        logger.error('Failed to get session:', { error: sessionError });
        throw new Error('Authentication error');
      }

      if (!session?.user) {
        router.push('/auth/login');
        return;
      }

      // Check if user is admin
      const { data: orgMember, error: orgError } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (orgError) {
        logger.error('Failed to get organization role:', { error: orgError });
        throw new Error('Failed to verify admin status');
      }

      if (!orgMember || orgMember.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setInviteLink(null);

    try {
      // Get current user's session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      // Get user's organization
      const { data: orgMember, error: orgError } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', session.user.id)
        .single();

      if (orgError) {
        logger.error('Failed to get organization:', { error: orgError });
        throw new Error('Failed to get organization');
      }

      if (!orgMember || orgMember.role !== 'admin') {
        throw new Error('You must be an admin to invite users');
      }

      // Create invitation
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          organizationId: orgMember.organization_id,
          role
        })
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error('Failed to create invitation:', { error: data.error });
        throw new Error(data.error || 'Failed to create invitation');
      }

      logger.info('Invitation created successfully', {
        email,
        role,
        organizationId: orgMember.organization_id
      });

      setInviteLink(data.invitationLink);
    } catch (err: any) {
      logger.error('Error in invite submission:', { error: err });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      logger.info('Invitation link copied to clipboard');
    } catch (err) {
      logger.error('Failed to copy invitation link:', { error: err });
      setError('Failed to copy link to clipboard');
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">Invite New Team Member</h1>
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            Back
          </button>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="colleague@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700"
              >
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'agent' | 'admin')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Error
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      {error}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? 'Generating Invite...' : 'Generate Invitation Link'}
            </button>
          </form>

          {inviteLink && (
            <div className="mt-8 p-4 bg-gray-50 rounded-md">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Invitation Link Generated
              </h3>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 p-2 border rounded bg-white"
                />
                <button
                  onClick={() => copyToClipboard(inviteLink)}
                  className="px-4 py-2 bg-white border rounded hover:bg-gray-50"
                >
                  Copy
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Share this link with the invitee. The link will expire in 7 days.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 