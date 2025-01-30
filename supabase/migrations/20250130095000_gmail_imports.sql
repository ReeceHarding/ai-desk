--------------------------------------------------------------------------------
-- Gmail Imports Table and Related Functions
--------------------------------------------------------------------------------

-- Create gmail_imports table
CREATE TABLE IF NOT EXISTS public.gmail_imports (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  total_messages integer DEFAULT 0,
  processed_messages integer DEFAULT 0,
  failed_messages integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gmail_imports_user_id ON public.gmail_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_imports_org_id ON public.gmail_imports(org_id);
CREATE INDEX IF NOT EXISTS idx_gmail_imports_status ON public.gmail_imports(status);
CREATE INDEX IF NOT EXISTS idx_gmail_imports_created_at ON public.gmail_imports(created_at);

-- Create auto-update timestamp trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_gmail_imports_update_timestamp'
    AND tgrelid = 'public.gmail_imports'::regclass
  ) THEN
    CREATE TRIGGER tr_gmail_imports_update_timestamp
      BEFORE UPDATE ON public.gmail_imports
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

-- Create function to update import progress
CREATE OR REPLACE FUNCTION public.update_gmail_import_progress(
  p_import_id text,
  p_progress integer,
  p_status text DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS public.gmail_imports
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_import public.gmail_imports;
BEGIN
  UPDATE public.gmail_imports
  SET
    progress = COALESCE(p_progress, progress),
    status = COALESCE(p_status, status),
    error = COALESCE(p_error, error),
    metadata = CASE 
      WHEN p_metadata IS NOT NULL 
      THEN metadata || p_metadata 
      ELSE metadata 
    END,
    completed_at = CASE 
      WHEN p_status = 'completed' OR p_status = 'failed' 
      THEN now() 
      ELSE completed_at 
    END,
    updated_at = now()
  WHERE id = p_import_id
  RETURNING * INTO v_import;

  -- Log the update
  INSERT INTO public.audit_logs (
    action,
    entity_name,
    entity_id,
    changes,
    description
  ) VALUES (
    'gmail_import_progress_update',
    'gmail_imports',
    v_import.id::uuid,
    jsonb_build_object(
      'progress', p_progress,
      'status', p_status,
      'error', p_error,
      'metadata', p_metadata
    ),
    format('Updated Gmail import progress to %s%% with status %s', p_progress, COALESCE(p_status, v_import.status))
  );

  RETURN v_import;
END;
$$;

-- Create function to cleanup old imports
CREATE OR REPLACE FUNCTION public.cleanup_old_gmail_imports(p_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.gmail_imports
    WHERE created_at < now() - (p_days || ' days')::interval
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count
  FROM deleted;

  -- Log the cleanup
  INSERT INTO public.audit_logs (
    action,
    entity_name,
    changes,
    description
  ) VALUES (
    'gmail_import_cleanup',
    'gmail_imports',
    jsonb_build_object(
      'days_threshold', p_days,
      'deleted_count', v_deleted_count
    ),
    format('Cleaned up %s old Gmail imports older than %s days', v_deleted_count, p_days)
  );

  RETURN v_deleted_count;
END;
$$;

-- Grant necessary permissions
GRANT ALL ON public.gmail_imports TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_gmail_import_progress TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_gmail_imports TO authenticated;

-- Disable RLS on gmail_imports table (as per instructions)
ALTER TABLE public.gmail_imports DISABLE ROW LEVEL SECURITY; 