-- Add timestamp column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'logs' 
    AND column_name = 'timestamp'
  ) THEN
    ALTER TABLE public.logs 
    ADD COLUMN timestamp TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
END $$;

-- Log the change
INSERT INTO public.logs (level, message, metadata)
VALUES (
  'info',
  'Added timestamp column to logs table',
  jsonb_build_object(
    'migration', '20250125091200_add_timestamp_to_logs',
    'column_added', 'timestamp',
    'type', 'TIMESTAMP WITH TIME ZONE',
    'default', 'now()'
  )
); 