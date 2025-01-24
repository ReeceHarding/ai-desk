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