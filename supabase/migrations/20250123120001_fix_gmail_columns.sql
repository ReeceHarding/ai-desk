-- Create logs table
CREATE TABLE IF NOT EXISTS public.logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_client boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for logs table
CREATE INDEX IF NOT EXISTS logs_level_idx ON public.logs (level);
CREATE INDEX IF NOT EXISTS logs_created_at_idx ON public.logs (created_at);
CREATE INDEX IF NOT EXISTS logs_level_created_at_idx ON public.logs (level, created_at);

-- Grant access to service role
GRANT ALL ON TABLE public.logs TO service_role;

-- Enable RLS
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Service role can do all on logs" ON public.logs;

-- Create policy for service role
CREATE POLICY "Service role can do all on logs"
  ON public.logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true); 