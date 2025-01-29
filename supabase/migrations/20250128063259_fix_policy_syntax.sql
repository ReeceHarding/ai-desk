-- Create attachments bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'email-attachments', 'email-attachments', false, 10485760, ARRAY[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]::text[]
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'email-attachments'
);

-- Drop existing policies to avoid duplicates
DROP POLICY IF EXISTS "Authenticated users can view their org attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Service role can read organizations" ON public.organizations;

-- Create new policies
CREATE POLICY "Authenticated users can view their org attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'email-attachments' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'email-attachments' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
