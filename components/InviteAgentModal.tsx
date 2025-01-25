import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';

interface InviteAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InviteAgentModal({ isOpen, onClose }: InviteAgentModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'agent' | 'admin'>('agent');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const supabase = createClientComponentClient<Database>();

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setInviteLink(null);

    try {
      // Get current user's session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        logger.error('Session error:', { error: sessionError });
        throw new Error('Authentication error');
      }

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

      if (!orgMember?.organization_id || orgMember.role !== 'admin') {
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

      logger.info('Invitation link generated:', { 
        email,
        invitationId: data.invitationId,
        link: data.invitationLink
      });

      setInviteLink(data.invitationLink);
    } catch (err: any) {
      logger.error('Error generating invitation link:', { error: err });
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-[400px]">
        <h2 className="text-xl font-semibold mb-4">Generate Invitation Link</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              required
              className="mt-1 w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'agent' | 'admin')}
              className="mt-1 w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded">
              {error}
            </div>
          )}

          {inviteLink && (
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Invitation Link Generated:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 p-2 text-sm bg-white border rounded"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(inviteLink)}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoading ? 'Generating...' : 'Generate Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 
