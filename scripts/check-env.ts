import { config } from 'dotenv';
import path from 'path';

// Load all environment files
config({ path: path.resolve(process.cwd(), '.env') });
config({ path: path.resolve(process.cwd(), '.env.local') });

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  // Add other required env vars here
];

const missingVars = requiredEnvVars.filter(
  (envVar) => !process.env[envVar]
);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach((envVar) => {
    console.error(`   - ${envVar}`);
  });
  process.exit(1);
} else {
  console.log('✅ All required environment variables are set');
  process.exit(0);
} 