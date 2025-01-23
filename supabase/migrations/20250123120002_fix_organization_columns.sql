-- Drop old columns
ALTER TABLE public.organizations
DROP COLUMN IF EXISTS gmail_watch_resource_id,
DROP COLUMN IF EXISTS gmail_watch_status;

-- Add new columns
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS gmail_history_id text;

-- Update organization with current history ID
UPDATE public.organizations
SET gmail_history_id = '2180684'
WHERE id = 'ee0f56a0-4130-4398-bc2d-27529f82efb1'; 