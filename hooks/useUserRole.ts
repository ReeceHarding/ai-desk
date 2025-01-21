import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { Database } from '@/types/supabase';

type UserRole = Database['public']['Enums']['user_role'];

export function useUserRole() {
  const [role, setRole] = useState<UserRole>('customer');
  const [loading, setLoading] = useState(true);
  const supabase = useSupabaseClient<Database>();
  const user = useUser();

  useEffect(() => {
    async function fetchUserRole() {
      if (!user) {
        console.log('useUserRole - No user found');
        setLoading(false);
        return;
      }

      console.log('useUserRole - Fetching role for user:', user.id);

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
    }

    fetchUserRole();
  }, [user, supabase]);

  return { role, loading };
} 