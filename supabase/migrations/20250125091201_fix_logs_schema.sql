-- Drop existing logs table
DROP TABLE IF EXISTS public.logs;

-- Create logs table with correct schema
CREATE TABLE public.logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_client boolean DEFAULT false,
  url text,
  runtime text,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Debugging columns
  request_id uuid DEFAULT gen_random_uuid(),
  user_agent text,
  ip_address text,
  request_path text,
  request_method text,
  response_status integer,
  duration_ms integer
);

-- Create indexes
CREATE INDEX IF NOT EXISTS logs_level_created_at_idx ON public.logs (level, created_at);
CREATE INDEX IF NOT EXISTS logs_created_at_idx ON public.logs (created_at DESC);
CREATE INDEX IF NOT EXISTS logs_level_idx ON public.logs (level);
CREATE INDEX IF NOT EXISTS logs_timestamp_idx ON public.logs (timestamp DESC);

-- Disable RLS for development
ALTER TABLE public.logs DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON public.logs TO postgres;
GRANT ALL ON public.logs TO authenticated;
GRANT ALL ON public.logs TO service_role;

-- Log the change
INSERT INTO public.logs (level, message, metadata)
VALUES (
  'info',
  'Fixed logs table schema',
  jsonb_build_object(
    'migration', '20250125091201_fix_logs_schema',
    'changes', ARRAY[
      'Recreated logs table with correct schema',
      'Added all necessary columns',
      'Created indexes',
      'Disabled RLS for development',
      'Granted permissions'
    ]
  )
); 