-- Add Gmail token columns to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS gmail_refresh_token text,
ADD COLUMN IF NOT EXISTS gmail_access_token text;

-- Disable RLS for testing
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow users to view organizations they are members of" ON organizations;
DROP POLICY IF EXISTS "Allow admins to update their organization" ON organizations;
DROP POLICY IF EXISTS "Allow admins to insert Gmail tokens" ON organizations;

-- Create policies for organizations table
CREATE POLICY "Allow users to view organizations they are members of"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow admins to update their organization"
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Allow admins to insert Gmail tokens"
  ON organizations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin', 'super_admin')
    )
  );

-- Policies for organization_members table
create policy "Allow users to view organization members"
  on organization_members for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
      and om.user_id = auth.uid()
    )
  );

create policy "Allow admins to manage organization members"
  on organization_members for all
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
      and om.user_id = auth.uid()
      and om.role in ('admin', 'super_admin')
    )
  );

-- Add gmail_watch_expiration column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gmail_refresh_token text,
ADD COLUMN IF NOT EXISTS gmail_access_token text,
ADD COLUMN IF NOT EXISTS gmail_watch_expiration timestamptz; 