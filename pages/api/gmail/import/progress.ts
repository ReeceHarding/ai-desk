import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { NextApiRequest, NextApiResponse } from 'next';

// Access the shared progress map
declare global {
  var importProgress: Map<string, number>;
}

if (!global.importProgress) {
  global.importProgress = new Map();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user from session
    const supabase = createServerSupabaseClient<Database>({ req, res });
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }

    const userId = session.user.id;
    const { importId } = req.query;

    if (!importId || typeof importId !== 'string') {
      throw new Error('Import ID is required');
    }

    // Extract user ID from import ID format: {userId}-{timestamp}
    const [importUserId] = importId.split('-');

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('Failed to get user profile');
    }

    // Check if user belongs to same organization as import
    const { data: importProfile, error: importProfileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', importUserId)
      .single();

    if (importProfileError || !importProfile) {
      throw new Error('Failed to get import profile');
    }

    // Allow access if user is in same organization
    if (profile.org_id !== importProfile.org_id) {
      logger.error('Unauthorized access to import progress', { importId, userId });
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get import progress
    const { data: progress, error: progressError } = await supabase
      .from('gmail_imports')
      .select('*')
      .eq('id', importId)
      .single();

    if (progressError) {
      throw progressError;
    }

    return res.status(200).json(progress);
  } catch (error) {
    logger.error('Error getting import progress', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 