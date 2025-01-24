-- First, modify the profiles table to allow null org_id temporarily
ALTER TABLE public.profiles ALTER COLUMN org_id DROP NOT NULL;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Creating profile for new user',
    jsonb_build_object(
      'user_id', NEW.id,
      'email', NEW.email,
      'trigger', 'handle_new_user'
    )
  );

  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    split_part(NEW.email, '@', 1),
    'customer'
  );
  RETURN NEW;
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