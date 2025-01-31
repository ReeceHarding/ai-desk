import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
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
    const supabase = createPagesServerClient<Database>({ req, res });
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
    const importUserId = importId.slice(0, importId.lastIndexOf('-'));

    // Verify user owns this import
    if (importUserId !== userId) {
      logger.error('Unauthorized access to import progress', { importId, userId });
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get progress from memory
    const progress = global.importProgress.get(importId);
    
    if (typeof progress === 'undefined') {
      return res.status(404).json({ error: 'Import not found' });
    }

    // Get additional status from database
    const { data: importStatus } = await supabase
      .from('gmail_imports')
      .select('status, processed_count, failed_count, error_message')
      .eq('id', importId)
      .single();

    // Return progress with detailed status
    return res.status(200).json({ 
      progress,
      status: progress === -1 ? 'failed' : progress === 100 ? 'completed' : 'processing',
      details: importStatus ? {
        processed_count: importStatus.processed_count || 0,
        failed_count: importStatus.failed_count || 0,
        error_message: importStatus.error_message,
        database_status: importStatus.status
      } : null
    });
  } catch (error) {
    logger.error('Error getting import progress', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 