-- Drop existing bucket and policies if they exist
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatar image" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatar image" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete avatar image" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'avatars';

-- Create avatars bucket with more generous size limits
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  50000000, -- 50MB limit
  ARRAY['image/*']::text[]
);

-- Simple policies that just require authentication
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatar image"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update avatar image"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete avatar image"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
); 