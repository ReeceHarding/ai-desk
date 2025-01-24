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