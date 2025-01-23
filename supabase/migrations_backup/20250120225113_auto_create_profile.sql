-- Create a function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_org_id uuid;
  existing_profile_id uuid;
BEGIN
  -- Log function entry with detailed user info
  RAISE LOG '[PROFILE_CREATION] START - handle_new_user() called for:';
  RAISE LOG '[PROFILE_CREATION] User ID: %', NEW.id;
  RAISE LOG '[PROFILE_CREATION] Email: %', NEW.email;
  RAISE LOG '[PROFILE_CREATION] Role: %', NEW.role;
  
  -- Check if profile already exists
  SELECT id INTO existing_profile_id FROM public.profiles WHERE id = NEW.id;
  
  -- Log profile check result
  IF existing_profile_id IS NULL THEN
    RAISE LOG '[PROFILE_CREATION] No existing profile found for user_id: %', NEW.id;
  ELSE
    RAISE LOG '[PROFILE_CREATION] Found existing profile with id: %', existing_profile_id;
    RETURN NEW;
  END IF;
  
  -- Only proceed if profile doesn't exist
  IF existing_profile_id IS NULL THEN
    -- Start a transaction block
    BEGIN
      -- Get or create default organization
      INSERT INTO public.organizations (name, sla_tier)
      VALUES ('Default Organization', 'basic')
      ON CONFLICT (name) DO UPDATE 
      SET name = EXCLUDED.name
      RETURNING id INTO default_org_id;
      
      RAISE LOG '[PROFILE_CREATION] Using organization with ID: %', default_org_id;
      
      IF default_org_id IS NULL THEN
        RAISE EXCEPTION 'Failed to create or get default organization';
      END IF;
      
      -- Create profile for the new user
      RAISE LOG '[PROFILE_CREATION] Attempting to create profile with:';
      RAISE LOG '[PROFILE_CREATION] - ID: %', NEW.id;
      RAISE LOG '[PROFILE_CREATION] - Email: %', NEW.email;
      RAISE LOG '[PROFILE_CREATION] - Org ID: %', default_org_id;
      RAISE LOG '[PROFILE_CREATION] - Display Name: %', split_part(NEW.email, '@', 1);
      
      INSERT INTO public.profiles (
        id,
        email,
        org_id,
        role,
        display_name,
        avatar_url
      )
      VALUES (
        NEW.id,
        NEW.email,
        default_org_id,
        'customer'::public.user_role,
        split_part(NEW.email, '@', 1),
        'https://ucbtpddvvbsrqroqhvev.supabase.co/storage/v1/object/public/avatars/profile-circle-icon-256x256-cm91gqm2.png'
      );
      
      -- If we get here, both operations succeeded
      RAISE LOG '[PROFILE_CREATION] Successfully created profile for user_id: % with org_id: %', NEW.id, default_org_id;
      
      -- Create organization member entry
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (default_org_id, NEW.id, 'admin');
      
      RAISE LOG '[PROFILE_CREATION] Successfully created organization member entry';
      
      RETURN NEW;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[PROFILE_CREATION] Error in transaction:';
      RAISE LOG '[PROFILE_CREATION] Error State: %', SQLSTATE;
      RAISE LOG '[PROFILE_CREATION] Error Message: %', SQLERRM;
      RAISE;  -- Re-raise the error to rollback the transaction
    END;
  END IF;
  
  RAISE LOG '[PROFILE_CREATION] END - handle_new_user() completed successfully';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 