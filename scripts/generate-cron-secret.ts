import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Generate a secure random string
const generateSecret = () => {
  return randomBytes(32).toString('base64');
};

// Update .env file
const updateEnvFile = (secret: string) => {
  const envPath = resolve(process.cwd(), '.env');
  let envContent: string;
  
  try {
    envContent = readFileSync(envPath, 'utf-8');
  } catch (error) {
    envContent = '';
  }

  // Check if CRON_SECRET already exists
  if (envContent.includes('CRON_SECRET=')) {
    console.log('CRON_SECRET already exists in .env file');
    return;
  }

  // Add new secret
  const newContent = envContent.trim() + '\n\n# Gmail polling cron secret\nCRON_SECRET=' + secret + '\n';
  writeFileSync(envPath, newContent, 'utf-8');
};

// Generate and save the secret
const secret = generateSecret();
updateEnvFile(secret);

console.log('Generated CRON_SECRET and added to .env file');
console.log('Please make sure to securely store this secret and add it to your production environment variables'); 