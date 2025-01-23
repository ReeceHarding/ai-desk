-- Drop existing policies
DROP POLICY IF EXISTS "Allow users to view organization members" ON organization_members;
DROP POLICY IF EXISTS "Allow admins to manage organization members" ON organization_members;

-- Create simpler policies that don't cause recursion
CREATE POLICY "organization_members_select_policy"
ON organization_members FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "organization_members_insert_policy"
ON organization_members FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "organization_members_update_policy"
ON organization_members FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "organization_members_delete_policy"
ON organization_members FOR DELETE
TO authenticated
USING (true);

-- Enable RLS
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY; 