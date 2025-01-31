-- Add Gmail token columns to organizations table
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS gmail_refresh_token text,
  ADD COLUMN IF NOT EXISTS gmail_access_token text,
  ADD COLUMN IF NOT EXISTS gmail_watch_status text DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS gmail_watch_expiry timestamptz,
  ADD COLUMN IF NOT EXISTS gmail_watch_resource_id text,
  ADD COLUMN IF NOT EXISTS gmail_token_expiry timestamptz;

-- Add Gmail token columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gmail_refresh_token text,
  ADD COLUMN IF NOT EXISTS gmail_access_token text,
  ADD COLUMN IF NOT EXISTS gmail_watch_status text DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS gmail_watch_expiry timestamptz,
  ADD COLUMN IF NOT EXISTS gmail_watch_resource_id text,
  ADD COLUMN IF NOT EXISTS gmail_token_expiry timestamptz;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_gmail_watch ON public.organizations (gmail_watch_status, gmail_watch_expiry);
CREATE INDEX IF NOT EXISTS idx_profile_gmail_watch ON public.profiles (gmail_watch_status, gmail_watch_expiry);

-- Add audit logging for token updates
CREATE OR REPLACE FUNCTION public.log_gmail_token_update()
RETURNS trigger AS $$
BEGIN
  IF (
    NEW.gmail_access_token IS DISTINCT FROM OLD.gmail_access_token OR
    NEW.gmail_refresh_token IS DISTINCT FROM OLD.gmail_refresh_token OR
    NEW.gmail_watch_status IS DISTINCT FROM OLD.gmail_watch_status
  ) THEN
    INSERT INTO public.audit_logs (
      action,
      entity_name,
      entity_id,
      changes,
      description
    ) VALUES (
      'gmail_token_update',
      TG_TABLE_NAME,
      NEW.id,
      jsonb_build_object(
        'watch_status_changed', NEW.gmail_watch_status IS DISTINCT FROM OLD.gmail_watch_status,
        'access_token_changed', NEW.gmail_access_token IS DISTINCT FROM OLD.gmail_access_token,
        'refresh_token_changed', NEW.gmail_refresh_token IS DISTINCT FROM OLD.gmail_refresh_token
      ),
      format('Updated Gmail tokens for %s %s', TG_TABLE_NAME, NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for both tables
DROP TRIGGER IF EXISTS tr_log_org_gmail_token_update ON public.organizations;
CREATE TRIGGER tr_log_org_gmail_token_update
  AFTER UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_gmail_token_update();

DROP TRIGGER IF EXISTS tr_log_profile_gmail_token_update ON public.profiles;
CREATE TRIGGER tr_log_profile_gmail_token_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_gmail_token_update(); 