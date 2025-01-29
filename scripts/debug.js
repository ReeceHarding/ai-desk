const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Logging utility
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
}

// Check environment variables
function checkEnvironmentVariables() {
  log('Checking environment variables...');
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'PINECONE_API_KEY',
    'PINECONE_ENVIRONMENT'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  log('Environment variables check passed');
}

// Check database schema
function checkDatabaseSchema() {
  log('Checking database schema...');
  try {
    const schemaFile = path.join(__dirname, '../supabase/migrations/20250123111534_schema.sql');
    if (!fs.existsSync(schemaFile)) {
      throw new Error('Schema file not found');
    }
    log('Database schema file exists');
  } catch (error) {
    throw new Error(`Database schema check failed: ${error.message}`);
  }
}

// Check dependencies
function checkDependencies() {
  log('Checking dependencies...');
  try {
    execSync('npm list', { stdio: 'ignore' });
    log('Dependencies check passed');
  } catch (error) {
    throw new Error('Dependencies check failed. Run npm install to fix.');
  }
}

// Check TypeScript compilation
function checkTypeScript() {
  log('Checking TypeScript compilation...');
  try {
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    log('TypeScript compilation check passed');
  } catch (error) {
    throw new Error('TypeScript compilation failed');
  }
}

// Check ESLint
function checkESLint() {
  log('Checking ESLint...');
  try {
    execSync('npx eslint . --ext .ts,.tsx', { stdio: 'inherit' });
    log('ESLint check passed');
  } catch (error) {
    throw new Error('ESLint check failed');
  }
}

// Main debug function
async function debug() {
  try {
    log('Starting debug process...');
    
    checkEnvironmentVariables();
    checkDatabaseSchema();
    checkDependencies();
    checkTypeScript();
    checkESLint();
    
    log('All debug checks passed successfully!', 'success');
    process.exit(0);
  } catch (error) {
    log(error.message, 'error');
    process.exit(1);
  }
}

// Run debug
debug(); 