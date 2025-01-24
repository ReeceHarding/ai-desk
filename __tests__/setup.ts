import { config } from 'dotenv';
import { beforeAll } from 'vitest';

// Load environment variables
config({ path: '.env.local' });

beforeAll(() => {
  // Ensure required environment variables are present
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  requiredEnvVars.forEach((envVar) => {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  });
}); 