import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import formidable from 'formidable';
import { readFile, unlink } from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';
import { promisify } from 'util';

const unlinkAsync = promisify(unlink);
const readFileAsync = promisify(readFile);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[UPLOAD] Starting file upload process');
  
  if (req.method !== 'POST') {
    console.warn('[UPLOAD] Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let filePath: string | undefined;

  try {
    console.log('[UPLOAD] Initializing Supabase client');
    const supabase = createServerSupabaseClient({ req, res });

    console.log('[UPLOAD] Getting user session');
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.warn('[UPLOAD] Unauthorized attempt - no session found');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.log('[UPLOAD] User authenticated:', session.user.id);

    // Parse form data
    console.log('[UPLOAD] Parsing form data');
    const form = formidable({
      maxFileSize: 5 * 1024 * 1024, // 5MB
    });
    
    const [fields, files] = await form.parse(req);
    const file = files.file?.[0];

    if (!file) {
      console.warn('[UPLOAD] No file found in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    console.log('[UPLOAD] File received:', {
      name: file.originalFilename,
      type: file.mimetype,
      size: `${(file.size / 1024 / 1024).toFixed(2)}MB`
    });

    filePath = file.filepath;
    console.log('[UPLOAD] Temporary file path:', filePath);

    // Validate file type
    if (!file.mimetype?.startsWith('image/')) {
      console.warn('[UPLOAD] Invalid file type:', file.mimetype);
      return res.status(400).json({ error: 'File must be an image' });
    }
    console.log('[UPLOAD] File type validation passed');

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      console.warn('[UPLOAD] File too large:', `${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return res.status(400).json({ error: 'File must be less than 5MB' });
    }
    console.log('[UPLOAD] File size validation passed');

    // Generate unique filename
    const fileExt = file.originalFilename?.split('.').pop();
    const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
    console.log('[UPLOAD] Generated filename:', fileName);

    // Read file into buffer instead of stream
    console.log('[UPLOAD] Reading file into buffer');
    const fileBuffer = await readFileAsync(file.filepath);
    
    console.log('[UPLOAD] Starting Supabase upload');
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, fileBuffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false,
        duplex: 'half'
      });

    console.log('[UPLOAD] Cleaning up temporary file');
    await unlinkAsync(file.filepath);
    filePath = undefined;
    console.log('[UPLOAD] Temporary file cleaned up successfully');

    if (error) {
      console.error('[UPLOAD] Supabase storage error:', {
        message: error.message,
        name: error.name,
        details: error
      });
      return res.status(500).json({ error: 'Failed to upload file to storage' });
    }
    console.log('[UPLOAD] File uploaded to Supabase successfully');

    // Get public URL
    console.log('[UPLOAD] Generating public URL');
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    console.log('[UPLOAD] Public URL generated:', publicUrl);

    console.log('[UPLOAD] Upload process completed successfully');
    return res.status(200).json({ url: publicUrl });
  } catch (error) {
    console.error('[UPLOAD] Unexpected error during upload:', {
      error: error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: error.stack
      } : error
    });
    
    // Ensure temporary file is cleaned up even if there's an error
    if (filePath) {
      try {
        console.log('[UPLOAD] Attempting to clean up temporary file after error');
        await unlinkAsync(filePath);
        console.log('[UPLOAD] Successfully cleaned up temporary file after error');
      } catch (cleanupError) {
        console.error('[UPLOAD] Failed to clean up temporary file:', {
          error: cleanupError instanceof Error ? cleanupError.message : cleanupError,
          path: filePath
        });
      }
    }

    if (error instanceof Error) {
      console.error('[UPLOAD] Sending error response with message:', error.message);
      return res.status(500).json({ error: error.message });
    }
    console.error('[UPLOAD] Sending generic error response');
    return res.status(500).json({ error: 'Internal server error' });
  }
} 