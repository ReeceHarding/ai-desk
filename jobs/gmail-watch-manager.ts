import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { Database } from '../types/supabase';
import { checkAndRefreshWatches } from '../utils/gmail';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function runWatchManager() {
  console.log('[Gmail Watch Manager] Starting watch refresh check...');
  
  try {
    await checkAndRefreshWatches();
    console.log('[Gmail Watch Manager] Successfully completed watch refresh check');
  } catch (error) {
    console.error('[Gmail Watch Manager] Error during watch refresh:', error);
    
    // Log the error to audit_logs
    try {
      await supabase.from('audit_logs').insert({
        action: 'gmail_watch_manager_error',
        description: 'Failed to refresh Gmail watches',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        },
        created_at: new Date().toISOString(),
        status: 'error'
      });
    } catch (logError) {
      console.error('[Gmail Watch Manager] Failed to log error:', logError);
    }
  }
}

// If running directly (not imported as a module)
if (require.main === module) {
  runWatchManager()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error in Gmail Watch Manager:', error);
      process.exit(1);
    });
}

export default runWatchManager; 