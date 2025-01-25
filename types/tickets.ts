import { Database } from './supabase';

export type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  customer?: {
    display_name: string | null;
  };
  assigned_agent?: {
    display_name: string | null;
  };
}; 