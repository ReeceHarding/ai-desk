-- Seed Organizations
INSERT INTO organizations (id, name, sla_tier)
VALUES 
  ('d0d0c528-f2ef-4203-8347-bd66e8f20bad', 'Acme Corp', 'premium'),
  ('e7ae5c3d-b0e5-4b6d-9e1d-c2f2c2f2c2f2', 'TechStart Inc', 'basic');

-- Seed Profiles (after creating users in Supabase Auth)
INSERT INTO profiles (id, org_id, role, display_name, email)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'd0d0c528-f2ef-4203-8347-bd66e8f20bad', 'super_admin', 'Super Admin', 'super@admin.com'),
  ('11111111-1111-1111-1111-111111111111', 'd0d0c528-f2ef-4203-8347-bd66e8f20bad', 'admin', 'Admin User', 'admin@acme.com'),
  ('22222222-2222-2222-2222-222222222222', 'd0d0c528-f2ef-4203-8347-bd66e8f20bad', 'agent', 'Support Agent', 'agent@acme.com'),
  ('33333333-3333-3333-3333-333333333333', 'd0d0c528-f2ef-4203-8347-bd66e8f20bad', 'customer', 'Test Customer', 'customer@test.com');

-- Seed Teams
INSERT INTO teams (id, org_id, name, description)
VALUES
  ('44444444-4444-4444-4444-444444444444', 'd0d0c528-f2ef-4203-8347-bd66e8f20bad', 'Technical Support', 'Handle technical issues'),
  ('55555555-5555-5555-5555-555555555555', 'd0d0c528-f2ef-4203-8347-bd66e8f20bad', 'Customer Success', 'Handle general inquiries');

-- Seed Team Members
INSERT INTO team_members (team_id, user_id, role_in_team)
VALUES
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'lead'),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'member');

-- Seed Knowledge Base Articles
INSERT INTO knowledge_base_articles (id, title, content, author_id, org_id, article_category)
VALUES
  ('66666666-6666-6666-6666-666666666666', 'Getting Started Guide', 'Welcome to our platform! This guide will help you get started...', '11111111-1111-1111-1111-111111111111', 'd0d0c528-f2ef-4203-8347-bd66e8f20bad', 'guides'),
  ('77777777-7777-7777-7777-777777777777', 'FAQ', 'Frequently asked questions about our service...', '11111111-1111-1111-1111-111111111111', 'd0d0c528-f2ef-4203-8347-bd66e8f20bad', 'faq');

-- Seed Tickets
INSERT INTO tickets (id, subject, description, status, priority, customer_id, assigned_agent_id, org_id)
VALUES
  ('88888888-8888-8888-8888-888888888888', 'Cannot access dashboard', 'Getting 403 error when trying to access the dashboard', 'open', 'high', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'd0d0c528-f2ef-4203-8347-bd66e8f20bad'),
  ('99999999-9999-9999-9999-999999999999', 'Billing question', 'Need clarification about recent charges', 'pending', 'medium', '33333333-3333-3333-3333-333333333333', null, 'd0d0c528-f2ef-4203-8347-bd66e8f20bad');

-- Seed Comments
INSERT INTO comments (id, ticket_id, author_id, body, is_private, org_id)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '88888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222', 'Looking into this now. Can you please provide your user ID?', false, 'd0d0c528-f2ef-4203-8347-bd66e8f20bad'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '88888888-8888-8888-8888-888888888888', '33333333-3333-3333-3333-333333333333', 'My user ID is USER123', false, 'd0d0c528-f2ef-4203-8347-bd66e8f20bad'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '88888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222', 'Internal note: Escalating to admin', true, 'd0d0c528-f2ef-4203-8347-bd66e8f20bad');

-- Seed Tags
INSERT INTO tags (id, name, description, tag_type, org_id)
VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bug', 'Technical issue or bug report', 'ticket_type', 'd0d0c528-f2ef-4203-8347-bd66e8f20bad'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'billing', 'Billing related inquiries', 'ticket_type', 'd0d0c528-f2ef-4203-8347-bd66e8f20bad'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'urgent', 'Requires immediate attention', 'priority', 'd0d0c528-f2ef-4203-8347-bd66e8f20bad');

-- Seed Ticket Watchers
INSERT INTO ticket_watchers (ticket_id, user_id, watch_level)
VALUES
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'all'),
  ('88888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222', 'all');

-- Seed Article Watchers
INSERT INTO article_watchers (article_id, user_id, watch_level)
VALUES
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'all'),
  ('77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 'changes'); 