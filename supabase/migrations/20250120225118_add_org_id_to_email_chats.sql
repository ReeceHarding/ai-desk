-- Drop existing table
DROP TABLE IF EXISTS public.ticket_email_chats;

-- Recreate table with org_id
CREATE TABLE public.ticket_email_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL
    REFERENCES public.tickets (id) ON DELETE CASCADE,
  message_id text NOT NULL,
  thread_id text NOT NULL,
  from_address text NOT NULL,
  to_address text[] NOT NULL,
  cc_address text[] NOT NULL DEFAULT '{}',
  bcc_address text[] NOT NULL DEFAULT '{}',
  subject text,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '{}'::jsonb,
  gmail_date timestamptz NOT NULL,
  org_id uuid NOT NULL
    REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX ticket_email_chats_ticket_idx ON public.ticket_email_chats (ticket_id);
CREATE INDEX ticket_email_chats_message_idx ON public.ticket_email_chats (message_id);
CREATE INDEX ticket_email_chats_thread_idx ON public.ticket_email_chats (thread_id);
CREATE INDEX ticket_email_chats_org_idx ON public.ticket_email_chats (org_id);

-- Create update trigger
CREATE TRIGGER tr_ticket_email_chats_update_timestamp
BEFORE UPDATE ON public.ticket_email_chats
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp(); 