import { Database } from '@/types/supabase';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useEffect, useState } from 'react';

type OrganizationRole = 'member' | 'admin' | 'super_admin';

export function useOrganizationRole(organizationId: string) {
  const [role, setRole] = useState<OrganizationRole | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useSupabaseClient<Database>();
  const user = useUser();

  useEffect(() => {
    const fetchOrganizationRole = async () => {
      if (!user || !organizationId) {
        console.log('useOrganizationRole - No user or organization ID found');
        setLoading(false);
        return;
      }

      console.log('useOrganizationRole - Fetching role for user:', { userId: user.id, organizationId });

      // Subscribe to role changes
      const channel = supabase
        .channel('org-role-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'organization_members',
            filter: `organization_id=eq.${organizationId} AND user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              console.log('useOrganizationRole - User removed from organization');
              setRole(null);
            } else {
              console.log('useOrganizationRole - Role changed:', payload.new.role);
              setRole(payload.new.role);
            }
          }
        )
        .subscribe();

      // Initial fetch
      const { data, error } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .maybeSingle(); // Use maybeSingle instead of single to handle case where user is not a member

      if (error) {
        console.error('useOrganizationRole - Error fetching organization role:', error);
        setLoading(false);
        return;
      }

      console.log('useOrganizationRole - Fetched role:', data?.role);
      setRole(data?.role || null);
      setLoading(false);
    };

    fetchOrganizationRole();

    // Cleanup subscription
    return () => {
      supabase.channel('org-role-changes').unsubscribe();
    };
  }, [user, organizationId, supabase]);

  return { role, loading };
} 