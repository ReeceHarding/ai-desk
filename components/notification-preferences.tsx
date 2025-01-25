import { Database } from '@/types/supabase';
import { Switch } from '@headlessui/react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

interface NotificationPreferences {
  id: string;
  email_notifications: boolean;
  push_notifications: boolean;
  daily_summary: boolean;
}

export function NotificationPreferences() {
  const supabase = useSupabaseClient<Database>();
  const user = useUser();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadPreferences() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) {
          throw error;
        }

        setPreferences(data);
      } catch (error) {
        console.error('Error loading notification preferences:', error);
        toast.error('Failed to load notification preferences');
      } finally {
        setLoading(false);
      }
    }

    loadPreferences();
  }, [user, supabase]);

  const handleToggle = async (field: keyof NotificationPreferences) => {
    if (!preferences || !user) return;

    setSaving(true);
    try {
      const updates = {
        [field]: !preferences[field],
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
          ...updates,
        });

      if (error) {
        throw error;
      }

      setPreferences((prev) => prev ? { ...prev, ...updates } : null);
      toast.success('Preferences updated successfully');
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      toast.error('Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">
          Notification Preferences
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Choose how you want to be notified about ticket updates.
        </p>
      </div>

      <div className="space-y-4">
        <Switch.Group>
          <div className="flex items-center justify-between">
            <Switch.Label className="text-sm font-medium text-gray-700">
              Email Notifications
            </Switch.Label>
            <Switch
              checked={preferences?.email_notifications ?? false}
              onChange={() => handleToggle('email_notifications')}
              disabled={saving}
              className={`${
                preferences?.email_notifications ? 'bg-blue-600' : 'bg-gray-200'
              } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
            >
              <span
                className={`${
                  preferences?.email_notifications ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </Switch>
          </div>
        </Switch.Group>

        <Switch.Group>
          <div className="flex items-center justify-between">
            <Switch.Label className="text-sm font-medium text-gray-700">
              Push Notifications
            </Switch.Label>
            <Switch
              checked={preferences?.push_notifications ?? false}
              onChange={() => handleToggle('push_notifications')}
              disabled={saving}
              className={`${
                preferences?.push_notifications ? 'bg-blue-600' : 'bg-gray-200'
              } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
            >
              <span
                className={`${
                  preferences?.push_notifications ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </Switch>
          </div>
        </Switch.Group>

        <Switch.Group>
          <div className="flex items-center justify-between">
            <Switch.Label className="text-sm font-medium text-gray-700">
              Daily Summary
            </Switch.Label>
            <Switch
              checked={preferences?.daily_summary ?? false}
              onChange={() => handleToggle('daily_summary')}
              disabled={saving}
              className={`${
                preferences?.daily_summary ? 'bg-blue-600' : 'bg-gray-200'
              } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
            >
              <span
                className={`${
                  preferences?.daily_summary ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </Switch>
          </div>
        </Switch.Group>
      </div>

      <div className="text-sm text-gray-500">
        <p>Note: Push notifications and daily summaries will be available soon.</p>
      </div>
    </div>
  );
} 