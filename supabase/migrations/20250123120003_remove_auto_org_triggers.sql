-- Drop existing triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS tr_create_personal_organization ON auth.users;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.fn_create_personal_organization() CASCADE;

-- Log the change
INSERT INTO public.logs (level, message, metadata)
VALUES (
  'info',
  'Removed auto-organization creation triggers and functions',
  jsonb_build_object(
    'migration', '20250123120003_remove_auto_org_triggers',
    'triggers_removed', array['on_auth_user_created', 'tr_create_personal_organization'],
    'functions_removed', array['handle_new_user', 'fn_create_personal_organization']
  )
); 