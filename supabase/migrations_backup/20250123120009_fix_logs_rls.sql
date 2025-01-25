-- Drop all policies for logs table
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.logs;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.logs;
DROP POLICY IF EXISTS "Allow postgres role full access" ON public.logs;
DROP POLICY IF EXISTS "Service role can do all on logs" ON public.logs;

-- Disable RLS
ALTER TABLE public.logs DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON public.logs TO postgres;
GRANT ALL ON public.logs TO authenticated;
GRANT ALL ON public.logs TO service_role;

-- Add additional columns for better debugging
ALTER TABLE public.logs 
ADD COLUMN IF NOT EXISTS request_id uuid DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS user_agent text,
ADD COLUMN IF NOT EXISTS ip_address text,
ADD COLUMN IF NOT EXISTS request_path text,
ADD COLUMN IF NOT EXISTS request_method text,
ADD COLUMN IF NOT EXISTS response_status integer,
ADD COLUMN IF NOT EXISTS duration_ms integer;

-- Log the change
INSERT INTO public.logs (level, message, metadata)
VALUES (
    'info',
    'Updated logs table structure and permissions',
    jsonb_build_object(
        'migration', '20250123120009_fix_logs_rls.sql',
        'changes', ARRAY[
            'Disabled RLS for development',
            'Added debugging columns',
            'Granted public permissions'
        ]
    )
); 