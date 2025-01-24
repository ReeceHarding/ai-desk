import { Database } from '@/types/supabase';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useEffect, useState } from 'react';

type UserRole = Database['public']['Enums']['user_role'];

export function useUserRole() {
  const [role, setRole] = useState<UserRole>('customer');
  const [loading, setLoading] = useState(true);
  const supabase = useSupabaseClient<Database>();
  const user = useUser();

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        console.log('useUserRole - No user found');
        setLoading(false);
        return;
      }

      console.log('useUserRole - Fetching role for user:', user.id);

      // Subscribe to role changes
      const channel = supabase
        .channel('role-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            console.log('useUserRole - Role changed:', payload.new.role);
            setRole(payload.new.role);
          }
        )
        .subscribe();

      // Initial fetch
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('useUserRole - Error fetching user role:', error);
        setLoading(false);
        return;
      }

      console.log('useUserRole - Fetched role:', data?.role);
      setRole(data?.role || 'customer');
      setLoading(false);
    };

    fetchUserRole();

    // Cleanup subscription
    return () => {
      supabase.channel('role-changes').unsubscribe();
    };
  }, [user, supabase]);

  return { role, loading };
} 