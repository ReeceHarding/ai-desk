import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

async function resetDatabase() {
  try {
    // Load environment variables
    dotenv.config();

    // Only try to save Gmail tokens if they exist
    if (process.env.SEED_GMAIL_ACCESS_TOKEN && process.env.SEED_GMAIL_REFRESH_TOKEN) {
      console.log('Saving Gmail tokens...');
      execSync('npm run gmail:save-tokens', { stdio: 'inherit' });
    } else {
      console.log('No Gmail tokens found, skipping token preservation...');
    }

    console.log('Resetting database...');
    console.log('Resetting local database...');

    // Reset database first
    execSync('npx supabase db reset', { stdio: 'inherit' });

    // Only restore tokens if they exist
    if (process.env.SEED_GMAIL_ACCESS_TOKEN && process.env.SEED_GMAIL_REFRESH_TOKEN) {
      // Create SQL file for setting tokens
      const sqlContent = `
DO $$
BEGIN
  PERFORM set_config('app.settings.seed_gmail_access_token', '${process.env.SEED_GMAIL_ACCESS_TOKEN?.replace(/'/g, "''")}', false);
  PERFORM set_config('app.settings.seed_gmail_refresh_token', '${process.env.SEED_GMAIL_REFRESH_TOKEN?.replace(/'/g, "''")}', false);
  PERFORM set_config('app.settings.seed_gmail_history_id', '${process.env.SEED_GMAIL_HISTORY_ID?.replace(/'/g, "''")}', false);
END $$;
`;
      const workspacePath = '/Users/reeceharding/Gauntlet/Zenesk Storage/Zendesk';
      const sqlPath = path.join(workspacePath, 'scripts', 'set-tokens.sql');
      fs.writeFileSync(sqlPath, sqlContent);

      // Execute SQL file
      execSync(`psql postgresql://postgres:postgres@localhost:54322/postgres -f "${sqlPath}"`, { stdio: 'inherit' });

      // Remove SQL file
      fs.unlinkSync(sqlPath);
      console.log('Database reset complete with Gmail tokens preserved');
    } else {
      console.log('Database reset complete (no Gmail tokens to preserve)');
    }
  } catch (error) {
    console.error('Failed to reset database:', error);
    process.exit(1);
  }
}

resetDatabase(); 