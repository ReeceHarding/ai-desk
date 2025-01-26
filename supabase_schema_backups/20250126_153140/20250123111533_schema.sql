CREATE OR REPLACE FUNCTION public.update_org_config(
  p_user_id UUID DEFAULT NULL,
  p_org_id UUID DEFAULT NULL, 
  p_is_current BOOLEAN DEFAULT NULL
) 
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the is_current flag for the specified user and org
  UPDATE public.org_config
  SET is_current = p_is_current
  WHERE (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_org_id IS NULL OR org_id = p_org_id);
    
  RETURN;
END;
$$;

CREATE TABLE IF NOT EXISTS logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL
); 