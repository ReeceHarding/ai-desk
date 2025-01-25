-- First, modify the profiles table to allow null org_id temporarily
ALTER TABLE public.profiles ALTER COLUMN org_id DROP NOT NULL;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email text;
  v_display_name text;
  v_avatar_url text;
  v_org_id uuid;
  v_org_name text;
  v_request_id text;
BEGIN
  -- Generate unique request ID for tracing
  v_request_id := gen_random_uuid()::text;

  -- Log function entry
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Starting handle_new_user function',
    jsonb_build_object(
      'request_id', v_request_id,
      'user_id', NEW.id,
      'raw_email', NEW.email,
      'raw_metadata', NEW.raw_user_meta_data,
      'email_confirmed', NEW.email_confirmed_at IS NOT NULL,
      'timestamp', now()
    )
  );

  -- Get email from either direct field or metadata
  v_email := COALESCE(
    NEW.email,
    NEW.raw_user_meta_data->>'email',
    NEW.raw_user_meta_data->>'preferred_email'
  );

  -- Log email resolution
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Resolved user email',
    jsonb_build_object(
      'request_id', v_request_id,
      'user_id', NEW.id,
      'resolved_email', v_email,
      'email_source', CASE 
        WHEN NEW.email IS NOT NULL THEN 'direct_email'
        WHEN NEW.raw_user_meta_data->>'email' IS NOT NULL THEN 'metadata_email'
        WHEN NEW.raw_user_meta_data->>'preferred_email' IS NOT NULL THEN 'metadata_preferred_email'
        ELSE 'none'
      END
    )
  );

  -- If no email found, use a temporary one based on the user ID
  IF v_email IS NULL THEN
    v_email := NEW.id || '@temp.example.com';
    -- Log temporary email creation
    INSERT INTO public.logs (level, message, metadata)
    VALUES (
      'warn',
      'Using temporary email for user',
      jsonb_build_object(
        'request_id', v_request_id,
        'user_id', NEW.id,
        'temp_email', v_email
      )
    );
  END IF;

  -- Get display name from metadata or fallback to email prefix
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(v_email, '@', 1)
  );

  -- Log display name resolution
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Resolved user display name',
    jsonb_build_object(
      'request_id', v_request_id,
      'user_id', NEW.id,
      'display_name', v_display_name,
      'name_source', CASE 
        WHEN NEW.raw_user_meta_data->>'full_name' IS NOT NULL THEN 'metadata_full_name'
        WHEN NEW.raw_user_meta_data->>'name' IS NOT NULL THEN 'metadata_name'
        ELSE 'email_prefix'
      END
    )
  );

  -- Get avatar URL from metadata if available
  v_avatar_url := NEW.raw_user_meta_data->>'avatar_url';

  -- Log avatar URL status
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Checked avatar URL availability',
    jsonb_build_object(
      'request_id', v_request_id,
      'user_id', NEW.id,
      'has_avatar', v_avatar_url IS NOT NULL
    )
  );

  -- Create personal organization first
  v_org_name := v_display_name || '''s Organization';
  
  -- Log organization creation attempt
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Attempting to create personal organization',
    jsonb_build_object(
      'request_id', v_request_id,
      'user_id', NEW.id,
      'org_name', v_org_name,
      'email', v_email
    )
  );
  
  INSERT INTO public.organizations (
    name,
    owner_id,
    email,
    public_mode,
    sla_tier,
    created_by
  )
  VALUES (
    v_org_name,
    NEW.id,
    v_email,
    false, -- Personal orgs are private by default
    'basic',
    NEW.id
  )
  RETURNING id INTO v_org_id;

  -- Log successful organization creation
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Successfully created personal organization',
    jsonb_build_object(
      'request_id', v_request_id,
      'user_id', NEW.id,
      'org_id', v_org_id,
      'org_name', v_org_name,
      'timestamp', now()
    )
  );

  -- Log profile creation attempt
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Attempting to create user profile',
    jsonb_build_object(
      'request_id', v_request_id,
      'user_id', NEW.id,
      'email', v_email,
      'display_name', v_display_name,
      'org_id', v_org_id
    )
  );

  -- Create profile with complete data
  INSERT INTO public.profiles (
    id, 
    email, 
    display_name, 
    role,
    org_id,
    avatar_url,
    metadata
  )
  VALUES (
    NEW.id,
    v_email,
    v_display_name,
    'customer',
    v_org_id,
    v_avatar_url,
    jsonb_build_object(
      'signup_completed', false,
      'gmail_setup_pending', true,
      'created_at', extract(epoch from now()),
      'is_sso_user', NEW.raw_user_meta_data->>'iss' IS NOT NULL,
      'email_confirmed', NEW.email_confirmed_at IS NOT NULL,
      'request_id', v_request_id
    )
  );

  -- Log successful profile creation
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Successfully created user profile',
    jsonb_build_object(
      'request_id', v_request_id,
      'user_id', NEW.id,
      'email', v_email,
      'display_name', v_display_name,
      'org_id', v_org_id,
      'timestamp', now()
    )
  );

  -- Log organization membership creation attempt
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Attempting to create organization membership',
    jsonb_build_object(
      'request_id', v_request_id,
      'user_id', NEW.id,
      'org_id', v_org_id,
      'role', 'admin'
    )
  );

  -- Add user as admin of their personal organization
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role
  )
  VALUES (
    v_org_id,
    NEW.id,
    'admin'
  );

  -- Log successful organization membership creation
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Successfully created organization membership',
    jsonb_build_object(
      'request_id', v_request_id,
      'user_id', NEW.id,
      'org_id', v_org_id,
      'role', 'admin',
      'timestamp', now()
    )
  );

  -- Log successful completion
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Successfully completed handle_new_user function',
    jsonb_build_object(
      'request_id', v_request_id,
      'user_id', NEW.id,
      'email', v_email,
      'org_id', v_org_id,
      'timestamp', now(),
      'duration_ms', extract(epoch from now()) * 1000 - extract(epoch from NEW.created_at) * 1000
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log detailed error information
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'error',
    'Error in handle_new_user',
    jsonb_build_object(
      'request_id', v_request_id,
      'user_id', NEW.id,
      'error', SQLERRM,
      'error_detail', SQLSTATE,
      'error_hint', SQLERRM,
      'error_context', pg_exception_context(),
      'email', v_email,
      'display_name', v_display_name,
      'org_id', v_org_id,
      'timestamp', now(),
      'stack_trace', (SELECT string_agg(row::text, E'\n') FROM pg_get_functiondef(pg_proc.oid) AS row WHERE pg_proc.proname = 'handle_new_user')
    )
  );
  RAISE WARNING 'Error in handle_new_user (Request ID: %): % (SQLSTATE: %)', v_request_id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Set function owner to postgres
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Log the change
INSERT INTO public.logs (level, message, metadata)
VALUES (
  'info',
  'Updated profile creation trigger with enhanced logging',
  jsonb_build_object(
    'migration', '20250123120004_add_profile_trigger',
    'trigger_added', 'on_auth_user_created',
    'function_added', 'handle_new_user',
    'changes', ARRAY[
      'Added request ID tracking',
      'Added step-by-step logging',
      'Added detailed error context',
      'Added timing information',
      'Added data resolution tracking',
      'Added stack traces for errors'
    ]
  )
); 