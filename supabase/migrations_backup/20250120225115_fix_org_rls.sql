-- Create the is_super_admin function if it doesn't exist
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql;

-- Drop existing insert policy if it exists
DROP POLICY IF EXISTS insert_organizations ON public.organizations;

-- Create new insert policy that allows:
-- 1. Super admins to create orgs
-- 2. New users who don't have a profile yet to create their first org
CREATE POLICY insert_organizations ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin()
  OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
  )
); 