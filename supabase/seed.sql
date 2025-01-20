-- Insert initial auth.users
INSERT INTO auth.users (id, email)
VALUES 
  ('d0d8c19c-3b73-4c20-8a30-136b8888c042', 'admin@acme.com'),
  ('8a37a557-4c7c-4e5c-a4a4-8f0e8d4d4a9a', 'agent@acme.com'),
  ('f8b4c46b-9c2d-4d21-8c2d-b5c8e3f3d2a1', 'customer@acme.com');

-- Insert organizations
INSERT INTO public.organizations (id, name, sla_tier)
VALUES ('123e4567-e89b-12d3-a456-426614174000', 'Acme Corp', 'premium');

-- Insert profiles
INSERT INTO public.profiles (id, role, display_name, email, org_id)
VALUES
  ('d0d8c19c-3b73-4c20-8a30-136b8888c042', 'admin', 'Admin User', 'admin@acme.com', '123e4567-e89b-12d3-a456-426614174000'),
  ('8a37a557-4c7c-4e5c-a4a4-8f0e8d4d4a9a', 'agent', 'Agent User', 'agent@acme.com', '123e4567-e89b-12d3-a456-426614174000'),
  ('f8b4c46b-9c2d-4d21-8c2d-b5c8e3f3d2a1', 'customer', 'Customer User', 'customer@acme.com', '123e4567-e89b-12d3-a456-426614174000');

-- Insert teams
INSERT INTO public.teams (id, name, description, org_id)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Technical Support', 'Main support team', '123e4567-e89b-12d3-a456-426614174000'),
  ('22222222-2222-2222-2222-222222222222', 'Customer Success', 'Customer success team', '123e4567-e89b-12d3-a456-426614174000');

-- Insert team members
INSERT INTO public.team_members (team_id, user_id, role_in_team)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'd0d8c19c-3b73-4c20-8a30-136b8888c042', 'team_lead'),
  ('11111111-1111-1111-1111-111111111111', '8a37a557-4c7c-4e5c-a4a4-8f0e8d4d4a9a', 'member');

-- Insert sample tickets
INSERT INTO public.tickets (id, subject, description, status, priority, customer_id, assigned_agent_id, org_id)
VALUES
  ('33333333-3333-3333-3333-333333333333', 'Login Issue', 'Unable to login to the application', 'open', 'high',
   'f8b4c46b-9c2d-4d21-8c2d-b5c8e3f3d2a1', '8a37a557-4c7c-4e5c-a4a4-8f0e8d4d4a9a', '123e4567-e89b-12d3-a456-426614174000'),
  ('44444444-4444-4444-4444-444444444444', 'Feature Request', 'Need dark mode support', 'pending', 'low',
   'f8b4c46b-9c2d-4d21-8c2d-b5c8e3f3d2a1', 'd0d8c19c-3b73-4c20-8a30-136b8888c042', '123e4567-e89b-12d3-a456-426614174000');

-- Insert sample comments
INSERT INTO public.comments (ticket_id, author_id, body, is_private, org_id)
VALUES
  ('33333333-3333-3333-3333-333333333333', '8a37a557-4c7c-4e5c-a4a4-8f0e8d4d4a9a', 'Looking into this issue', false, '123e4567-e89b-12d3-a456-426614174000'),
  ('33333333-3333-3333-3333-333333333333', 'f8b4c46b-9c2d-4d21-8c2d-b5c8e3f3d2a1', 'Thank you for the quick response', false, '123e4567-e89b-12d3-a456-426614174000'); 