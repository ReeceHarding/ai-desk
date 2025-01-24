-- First, modify the profiles table to allow null org_id temporarily
ALTER TABLE public.profiles ALTER COLUMN org_id DROP NOT NULL;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email text;
  v_display_name text;
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

  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Creating profile for new user',
    jsonb_build_object(
      'user_id', NEW.id,
      'email', v_email,
      'display_name', v_display_name,
      'trigger', 'handle_new_user'
    )
  );

  -- Create profile
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    v_email,
    v_display_name,
    'customer'
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
  'Added profile creation trigger',
  jsonb_build_object(
    'migration', '20250123120004_add_profile_trigger',
    'trigger_added', 'on_auth_user_created',
    'function_added', 'handle_new_user'
  )
); 