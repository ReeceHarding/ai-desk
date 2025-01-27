-- This seed file is intentionally minimal.
-- Users and organizations will be created through the normal signup flow.

-- Create avatars storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  50000000, -- 50MB
  ARRAY['image/*']::text[]
) ON CONFLICT (id) DO NOTHING;

-- Create a demo organization
INSERT INTO public.organizations (id, name, slug)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Demo Organization',
  'demo-org'
) ON CONFLICT (id) DO NOTHING;

-- Create auth users first with encrypted passwords (password is 'password123' for all users)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmed_at
)
VALUES 
  (
    '22222222-2222-2222-2222-222222222222',
    'admin@demo.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    NOW()
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'agent@demo.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    NOW()
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'customer1@demo.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    NOW()
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'customer2@demo.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Create demo profiles (1 admin, 1 agent, 2 customers)
INSERT INTO public.profiles (id, display_name, role, org_id)
VALUES 
  ('22222222-2222-2222-2222-222222222222', 'Demo Admin', 'admin', '11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333', 'Demo Agent', 'agent', '11111111-1111-1111-1111-111111111111'),
  ('44444444-4444-4444-4444-444444444444', 'Demo Customer 1', 'customer', '11111111-1111-1111-1111-111111111111'),
  ('55555555-5555-5555-5555-555555555555', 'Demo Customer 2', 'customer', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-- Create mock tickets
INSERT INTO public.tickets (
  id,
  org_id,
  subject,
  description,
  status,
  priority,
  customer_id,
  assigned_agent_id,
  created_at,
  updated_at
)
VALUES
  -- Open tickets
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'Cannot access my account',
    'I am unable to log in to my account since yesterday. The password reset link is not working.',
    'open',
    'high',
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111',
    'Feature request: Dark mode',
    'Would love to have a dark mode option for the dashboard.',
    'open',
    'low',
    '55555555-5555-5555-5555-555555555555',
    NULL,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
  ),
  -- Pending ticket
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '11111111-1111-1111-1111-111111111111',
    'Integration with Slack',
    'Need help setting up Slack integration. Waiting for API credentials.',
    'pending',
    'medium',
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '1 day'
  ),
  -- Solved tickets
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '11111111-1111-1111-1111-111111111111',
    'Billing issue resolved',
    'Double charge on my credit card has been refunded.',
    'solved',
    'high',
    '55555555-5555-5555-5555-555555555555',
    '33333333-3333-3333-3333-333333333333',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '8 days'
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '11111111-1111-1111-1111-111111111111',
    'How to export data?',
    'Found the export button in settings. All good now!',
    'solved',
    'low',
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '14 days'
  )
ON CONFLICT (id) DO NOTHING; 