-- Drop existing constraints if they exist
ALTER TABLE public.organizations 
DROP CONSTRAINT IF EXISTS organizations_slug_key;

-- Add missing columns to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS slug text,
ADD COLUMN IF NOT EXISTS public_mode boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS owner_id uuid,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS email text;

-- Generate slugs for existing organizations
UPDATE public.organizations
SET slug = CASE 
  WHEN name IS NOT NULL THEN 
    lower(regexp_replace(regexp_replace(name, '''', '', 'g'), '[^a-zA-Z0-9]+', '-', 'g'))
  ELSE 
    'org-' || replace(gen_random_uuid()::text, '-', '')
END
WHERE slug IS NULL;

-- Make slug required and unique after populating
ALTER TABLE public.organizations 
ALTER COLUMN slug SET NOT NULL,
ADD CONSTRAINT organizations_slug_key UNIQUE (slug);

-- Update existing organization slugs to be cleaner
UPDATE public.organizations
SET slug = CASE 
  WHEN slug LIKE 'auto-admin-%' THEN 
    substring(slug from 12) -- Remove 'auto-admin-' prefix
  ELSE slug
END
WHERE slug LIKE 'auto-admin-%';

-- Update all organizations to accept public tickets
UPDATE public.organizations SET public_mode = true; 