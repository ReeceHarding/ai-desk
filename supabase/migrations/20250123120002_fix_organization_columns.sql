-- Drop old columns
ALTER TABLE public.organizations
DROP COLUMN IF EXISTS gmail_watch_resource_id,
DROP COLUMN IF EXISTS gmail_watch_status;

-- Add new columns
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS gmail_history_id text,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS email text;

-- Create organization_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.organization_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member',
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- Add RLS policies for organization_members
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own organization memberships"
    ON public.organization_members
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Organization creators and admins can manage members"
    ON public.organization_members
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = organization_members.organization_id
            AND (
                o.created_by = auth.uid() -- Organization creator can always manage
                OR EXISTS (
                    SELECT 1 FROM public.organization_members m
                    WHERE m.organization_id = organization_members.organization_id
                    AND m.user_id = auth.uid()
                    AND m.role = 'admin'
                )
            )
        )
    );

-- Add RLS policies for organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organizations they are members of"
    ON public.organizations
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members
            WHERE organization_id = organizations.id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Organization creators and admins can manage their organizations"
    ON public.organizations
    FOR ALL
    TO authenticated
    USING (
        created_by = auth.uid() -- Organization creator can always manage
        OR EXISTS (
            SELECT 1 FROM public.organization_members
            WHERE organization_id = organizations.id
            AND user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Update organization with current history ID
UPDATE public.organizations
SET gmail_history_id = '2180684'
WHERE id = 'ee0f56a0-4130-4398-bc2d-27529f82efb1';

-- Drop RLS policies from organization_members
DROP POLICY IF EXISTS "Users can see their own org members" ON organization_members;
DROP POLICY IF EXISTS "Users can insert their own org members" ON organization_members;
DROP POLICY IF EXISTS "Users can update their own org members" ON organization_members;
DROP POLICY IF EXISTS "Users can delete their own org members" ON organization_members;

-- Disable RLS on organization_members
ALTER TABLE organization_members DISABLE ROW LEVEL SECURITY; 