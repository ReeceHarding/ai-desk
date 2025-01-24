import { config } from 'dotenv';
import { beforeAll } from 'vitest';

// Load environment variables
config();

// Add any global test setup here
beforeAll(() => {
  // Verify required environment variables are present
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
}); 