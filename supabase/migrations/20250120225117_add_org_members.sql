-- WARNING: THIS IS A TESTING-ONLY CONFIGURATION
-- SECURITY NOTICE: RLS IS DISABLED FOR TESTING PURPOSES
-- DO NOT USE THIS CONFIGURATION IN PRODUCTION

-- Create organization_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('member', 'admin', 'super_admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

-- Add update timestamp trigger
CREATE TRIGGER tr_organization_members_update_timestamp
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW
  EXECUTE PROCEDURE public.fn_auto_update_timestamp();

-- Add Gmail watch tracking columns to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS gmail_watch_expiration timestamptz,
ADD COLUMN IF NOT EXISTS gmail_watch_resource_id text,
ADD COLUMN IF NOT EXISTS gmail_watch_status text CHECK (gmail_watch_status IN ('active', 'expired', 'failed', 'pending'));

-- Add Gmail watch tracking columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gmail_watch_expiration timestamptz,
ADD COLUMN IF NOT EXISTS gmail_watch_resource_id text,
ADD COLUMN IF NOT EXISTS gmail_watch_status text CHECK (gmail_watch_status IN ('active', 'expired', 'failed', 'pending'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_gmail_watch_expiration ON public.organizations(gmail_watch_expiration);
CREATE INDEX IF NOT EXISTS idx_profiles_gmail_watch_expiration ON public.profiles(gmail_watch_expiration);

-- Create ticket_email_chats table for storing email conversations
CREATE TABLE public.ticket_email_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  message_id text,
  thread_id text,
  from_address text,
  to_address text[],
  cc_address text[],
  bcc_address text[],
  subject text,
  body text,
  attachments jsonb NOT NULL DEFAULT '{}'::jsonb,
  gmail_date timestamptz,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER tr_ticket_email_chats_update_timestamp
  BEFORE UPDATE ON public.ticket_email_chats
  FOR EACH ROW
  EXECUTE PROCEDURE public.fn_auto_update_timestamp();

-- Create indexes for efficient lookups
CREATE INDEX ticket_email_chats_ticket_idx ON public.ticket_email_chats (ticket_id);
CREATE INDEX ticket_email_chats_message_idx ON public.ticket_email_chats (message_id);
CREATE INDEX ticket_email_chats_thread_idx ON public.ticket_email_chats (thread_id);
CREATE INDEX ticket_email_chats_org_idx ON public.ticket_email_chats (org_id); 