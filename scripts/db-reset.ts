import { execSync } from 'child_process';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

async function resetDatabase() {
  console.log('Saving Gmail tokens...');
  
  try {
    // Save Gmail tokens before reset
    execSync('npm run gmail:save-tokens', { stdio: 'inherit' });

    console.log('Resetting database...');
    console.log('Resetting local database...');

    // Reset the database
    execSync('npx supabase db reset', {
      env: {
        ...process.env,
        GOOGLE_OAUTH_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_ID,
        GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_AUTH_CLIENT_SECRET,
        GOOGLE_OAUTH_REDIRECT_URI: process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL
      },
      stdio: 'inherit'
    });

    // Create SQL file for setting tokens
    const sqlContent = `
DO $$
BEGIN
  PERFORM set_config('app.settings.seed_gmail_access_token', '${process.env.SEED_GMAIL_ACCESS_TOKEN?.replace(/'/g, "''")}', false);
  PERFORM set_config('app.settings.seed_gmail_refresh_token', '${process.env.SEED_GMAIL_REFRESH_TOKEN?.replace(/'/g, "''")}', false);
  PERFORM set_config('app.settings.seed_gmail_history_id', '${process.env.SEED_GMAIL_HISTORY_ID?.replace(/'/g, "''")}', false);
END $$;
`;
    const sqlPath = path.join(process.cwd(), 'scripts', 'set-tokens.sql');
    fs.writeFileSync(sqlPath, sqlContent);

    // Execute SQL file
    execSync(`psql postgresql://postgres:postgres@localhost:54322/postgres -f ${sqlPath}`, { stdio: 'inherit' });

    // Remove SQL file
    fs.unlinkSync(sqlPath);

    console.log('Database reset complete with Gmail tokens preserved');
  } catch (error) {
    console.error('Failed to reset database:', error);
    process.exit(1);
  }
}

resetDatabase(); 