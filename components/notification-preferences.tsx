import { useToast } from '@/components/ui/use-toast';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useEffect, useState } from 'react';

interface NotificationPreferences {
  id: string;
  user_id: string;
  org_id: string;
  email_notifications: boolean;
  in_app_notifications: boolean;
  push_notifications: boolean;
  digest_frequency: 'never' | 'daily' | 'weekly';
  notification_types: string[];
  created_at: string;
  updated_at: string;
}

export default function NotificationPreferences({ userId, orgId }: { userId: string; orgId: string }) {
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const { data, error } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', userId)
          .eq('org_id', orgId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No preferences found, create default
            const defaultPrefs = {
              user_id: userId,
              org_id: orgId,
              email_notifications: true,
              in_app_notifications: true,
              push_notifications: true,
              digest_frequency: 'daily' as const,
              notification_types: ['ticket_assigned', 'ticket_updated', 'ticket_commented']
            };

            const { data: newPrefs, error: insertError } = await supabase
              .from('notification_preferences')
              .insert(defaultPrefs)
              .select()
              .single();

            if (insertError) throw insertError;
            setPreferences(newPrefs);
          } else {
            throw error;
          }
        } else {
          setPreferences(data);
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
        toast({
          title: 'Error',
          description: 'Failed to load notification preferences',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    }

    loadPreferences();
  }, [userId, orgId, supabase, toast]);

  const updatePreference = async (key: keyof NotificationPreferences, value: any) => {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update({ [key]: value })
        .eq('user_id', userId)
        .eq('org_id', orgId);

      if (error) throw error;

      setPreferences(prev => prev ? { ...prev, [key]: value } : null);
      toast({
        title: 'Success',
        description: 'Preferences updated successfully',
      });
    } catch (error) {
      console.error('Error updating preference:', error);
      toast({
        title: 'Error',
        description: 'Failed to update preference',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return <div>Loading preferences...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Email Notifications</label>
        <input
          type="checkbox"
          checked={preferences?.email_notifications}
          onChange={e => updatePreference('email_notifications', e.target.checked)}
          className="toggle"
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">In-App Notifications</label>
        <input
          type="checkbox"
          checked={preferences?.in_app_notifications}
          onChange={e => updatePreference('in_app_notifications', e.target.checked)}
          className="toggle"
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Push Notifications</label>
        <input
          type="checkbox"
          checked={preferences?.push_notifications}
          onChange={e => updatePreference('push_notifications', e.target.checked)}
          className="toggle"
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Digest Frequency</label>
        <select
          value={preferences?.digest_frequency}
          onChange={e => updatePreference('digest_frequency', e.target.value)}
          className="select select-bordered"
        >
          <option value="never">Never</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Notification Types</label>
        <div className="space-y-2">
          {['ticket_assigned', 'ticket_updated', 'ticket_commented'].map(type => (
            <div key={type} className="flex items-center">
              <input
                type="checkbox"
                checked={preferences?.notification_types.includes(type)}
                onChange={e => {
                  const types = preferences?.notification_types || [];
                  const newTypes = e.target.checked
                    ? [...types, type]
                    : types.filter(t => t !== type);
                  updatePreference('notification_types', newTypes);
                }}
                className="checkbox"
              />
              <span className="ml-2 text-sm">{type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 