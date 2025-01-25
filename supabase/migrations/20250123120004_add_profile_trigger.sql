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
BEGIN
  -- Get email from either direct field or metadata
  v_email := COALESCE(
    NEW.email,
    NEW.raw_user_meta_data->>'email',
    NEW.raw_user_meta_data->>'preferred_email'
  );

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'No email found for user';
  END IF;

  -- Get display name from metadata or fallback to email prefix
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(v_email, '@', 1)
  );

  -- Get avatar URL from metadata if available
  v_avatar_url := NEW.raw_user_meta_data->>'avatar_url';

  -- Log start of profile creation
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Starting profile creation for new user',
    jsonb_build_object(
      'user_id', NEW.id,
      'email', v_email,
      'display_name', v_display_name,
      'avatar_url', v_avatar_url,
      'trigger', 'handle_new_user'
    )
  );

  -- Create profile with complete data
  INSERT INTO public.profiles (
    id, 
    email, 
    display_name, 
    role, 
    avatar_url,
    metadata
  )
  VALUES (
    NEW.id,
    v_email,
    v_display_name,
    'customer',
    v_avatar_url,
    jsonb_build_object(
      'signup_completed', false,
      'gmail_setup_pending', true,
      'created_at', extract(epoch from now())
    )
  );

  -- Log successful profile creation
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Profile created successfully',
    jsonb_build_object(
      'user_id', NEW.id,
      'email', v_email,
      'trigger', 'handle_new_user',
      'status', 'success'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log any errors
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'error',
    'Error in handle_new_user',
    jsonb_build_object(
      'error', SQLERRM,
      'user_id', NEW.id,
      'email', v_email,
      'avatar_url', v_avatar_url,
      'trigger', 'handle_new_user'
    )
  );
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Log the change
INSERT INTO public.logs (level, message, metadata)
VALUES (
  'info',
  'Updated profile creation trigger',
  jsonb_build_object(
    'migration', '20250123120004_add_profile_trigger',
    'trigger_added', 'on_auth_user_created',
    'function_added', 'handle_new_user',
    'changes', 'Added metadata for signup tracking'
  )
); 