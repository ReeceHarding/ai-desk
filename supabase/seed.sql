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

-- Insert test organization with Gmail tokens
INSERT INTO public.organizations (
  id,
  name,
  sla_tier,
  gmail_access_token,
  gmail_refresh_token,
  gmail_watch_status,
  gmail_token_expiry
) VALUES (
  '965a217d-791a-41aa-8230-8916761955d7',
  'Test Organization',
  'basic',
  'ya29.a0AXeO80SPMnVXc1CG7oTwWeOOgjp60NYuJIHE3WleuVPpD1M-iaoCenXlGboBbGCe7Yzthhm6FiD5r5cQxx4I7of5rcupulPFo6OMMe7XdI82xedZAkhEyc-4Uawmww35A2ibyD820abE2KRYA5nM-dC17FSdsh5VaxmzD-U1aCgYKARkSARESFQHGX2MiOOIsVHH7AcO1rLHnVGqSJw0175',
  '1//06_w6YUps5mhNCgYIARAAGAYSNwF-L9IrFbRDUdGMTQMA7x42KDJVT7CF1qbfWpSnoKS9vMZ0HlqfRPkGjHOMGUUsoFH1FYk42ek',
  'active',
  NOW() + INTERVAL '1 hour'
) ON CONFLICT (id) DO UPDATE SET
  gmail_access_token = EXCLUDED.gmail_access_token,
  gmail_refresh_token = EXCLUDED.gmail_refresh_token,
  gmail_watch_status = EXCLUDED.gmail_watch_status,
  gmail_token_expiry = EXCLUDED.gmail_token_expiry; 