-- Create notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_notifications boolean DEFAULT true,
  in_app_notifications boolean DEFAULT true,
  digest_frequency text CHECK (digest_frequency IN ('never', 'daily', 'weekly')),
  notification_types text[] DEFAULT ARRAY['ticket_assigned', 'ticket_updated', 'ticket_commented']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS notification_preferences_user_id_idx ON public.notification_preferences (user_id);

-- Add trigger for updated_at
CREATE TRIGGER tr_notification_preferences_update_timestamp
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE PROCEDURE public.fn_auto_update_timestamp();

-- Disable RLS for development
ALTER TABLE public.notification_preferences DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON public.notification_preferences TO postgres;
GRANT ALL ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role; 