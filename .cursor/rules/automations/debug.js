const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env.local') });

// Add global fetch polyfill
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
global.fetch = fetch;

// Initialize Supabase client
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase configuration. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Add at the top with other constants
const TIMEOUT = {
  navigation: 30000,
  element: 10000,
  action: 5000
};

// Add auth user creation function
async function createAuthUser(supabase, email) {
  // Since we can't directly create auth.users, we'll use the auth API
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: 'TestPassword123!',
    options: {
      data: {
        full_name: 'Test User'
      }
    }
  });

  if (authError) {
    console.error('❌ Error creating auth user:', authError.message);
    return null;
  }

  return authData.user;
}

async function cleanupTestData(supabase, email) {
  console.log('Cleaning up any existing test data...');
  
  // Delete profile if exists
  const { error: profileError } = await supabase
    .from('profiles')
    .delete()
    .eq('email', email);
  
  if (profileError) {
    console.log('Note: No existing profile to clean up');
  }

  // Delete auth user if exists
  const { error: authError } = await supabase.auth.admin.deleteUser(email);
  if (authError) {
    console.log('Note: No existing auth user to clean up');
  }
}

async function createTestTickets(supabase) {
  console.log('Creating test tickets...');
  
  const testEmail = `test_customer_${Date.now()}@example.com`;
  
  // Create auth user - this will trigger handle_new_user which creates org and profile
  console.log('Creating auth user...');
  const authUser = await createAuthUser(supabase, testEmail);
  
  if (!authUser) {
    console.error('❌ Failed to create auth user');
    return null;
  }

  // Wait for handle_new_user trigger to complete
  console.log('Waiting for profile creation...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verify profile was created
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (profileError || !profile) {
    console.error('❌ Error verifying profile:', profileError?.message || 'Profile not found');
    return null;
  }

  console.log('✅ Profile created successfully');

  // Create test tickets
  const { data: tickets, error: ticketError } = await supabase
    .from('tickets')
    .insert([
      {
        subject: 'Test Ticket 1',
        description: 'This is a test ticket for debugging',
        status: 'open',
        priority: 'medium',
        customer_id: profile.id,
        org_id: profile.org_id
      },
      {
        subject: 'Test Ticket 2',
        description: 'Another test ticket for debugging',
        status: 'pending',
        priority: 'high',
        customer_id: profile.id,
        org_id: profile.org_id
      }
    ])
    .select();

  if (ticketError) {
    console.error('❌ Error creating test tickets:', ticketError.message);
    return null;
  }

  console.log(`✅ Created ${tickets.length} test tickets`);
  return tickets;
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('🔍 Fetching ticket IDs from Supabase...');
  let { data: tickets, error } = await supabase.from('tickets').select('id');

  if (error) {
    console.error('❌ Error fetching tickets:', error.message);
    await browser.close();
    return;
  }

  if (!tickets || !tickets.length) {
    console.log('No tickets found, creating test data...');
    const newTickets = await createTestTickets(supabase);
    if (!newTickets) {
      console.error('❌ Failed to create test data');
      await browser.close();
      return;
    }
    tickets = newTickets;
  }

  console.log(`✅ Found ${tickets.length} tickets. Checking pages...`);

  let errors = [];

  for (const ticket of tickets) {
    const url = `http://localhost:3000/tickets/${ticket.id}`;
    console.log(`🔍 Checking ${url}...`);

    let foundError = false;

    // Capture console errors with more detail
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const error = {
          type: 'browser_error',
          message: msg.text(),
          url,
          timestamp: new Date().toISOString()
        };
        errors.push(error);
        console.error(`🚨 [BROWSER ERROR] ${JSON.stringify(error, null, 2)}`);
        foundError = true;
      }
    });

    page.on('pageerror', error => {
      const errorDetail = {
        type: 'page_error',
        message: error.message,
        stack: error.stack,
        url,
        timestamp: new Date().toISOString()
      };
      errors.push(errorDetail);
      console.error(`🚨 [PAGE ERROR] ${JSON.stringify(errorDetail, null, 2)}`);
      foundError = true;
    });

    try {
      // Navigation with increased timeout
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: TIMEOUT.navigation 
      });
      
      // Let the page stabilize
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle');

      // Check ticket content with retry logic
      const ticketContent = page.locator('[data-testid="ticket-content"], .ticket-content, #ticket-content');
      try {
        await ticketContent.waitFor({ 
          state: 'visible', 
          timeout: TIMEOUT.element 
        });
      } catch (err) {
        console.log('Retrying ticket content check with additional selectors...');
        // Try alternative selectors
        const altContent = page.locator('.ticket-details, .ticket-view, article');
        await altContent.waitFor({ 
          state: 'visible', 
          timeout: TIMEOUT.element 
        });
      }

      // Test message functionality with improved error handling
      console.log(`💬 Testing message sending on ${url}...`);
      
      // Try multiple selector combinations
      const messageBox = page.locator([
        '[data-testid="message-input"]',
        'textarea.message-input',
        '#message-input',
        'textarea[placeholder*="message"]',
        'textarea[aria-label*="message"]'
      ].join(','));

      const sendButton = page.locator([
        '[data-testid="send-message"]',
        'button.send-message',
        'button:has-text("Send")',
        'button[aria-label*="send"]'
      ].join(','));

      try {
        await messageBox.waitFor({ 
          state: 'visible', 
          timeout: TIMEOUT.element 
        });
        await sendButton.waitFor({ 
          state: 'visible', 
          timeout: TIMEOUT.element 
        });

        await messageBox.fill('Test message from Playwright');
        await sendButton.click();
        
        // Wait for network idle after sending
        await page.waitForLoadState('networkidle', { 
          timeout: TIMEOUT.navigation 
        });

        // Check for message with retry
        const messageLocators = [
          '[data-testid="message-bubble"]',
          '.message-bubble',
          '.message-content',
          '[role="log"] *:has-text("Test message from Playwright")'
        ];

        let messageFound = false;
        for (const selector of messageLocators) {
          try {
            const sentMessage = page.locator(`${selector}:has-text("Test message from Playwright")`);
            await sentMessage.waitFor({ 
              state: 'visible', 
              timeout: TIMEOUT.element 
            });
            messageFound = true;
            break;
          } catch (err) {
            continue;
          }
        }

        if (!messageFound) {
          throw new Error('Message not found in thread after sending');
        }

        console.log(`✅ Message successfully sent and verified on ${url}`);
      } catch (err) {
        errors.push({
          type: 'message_test_error',
          message: err.message,
          url,
          timestamp: new Date().toISOString()
        });
        foundError = true;
      }
    } catch (err) {
      errors.push({
        type: 'navigation_error',
        message: err.message,
        stack: err.stack,
        url,
        timestamp: new Date().toISOString()
      });
      foundError = true;
    }

    if (foundError) {
      console.log(`❌ Errors found on ${url}:`);
      console.log(JSON.stringify(errors, null, 2));
      // Don't break immediately, collect all errors
      continue;
    }
  }

  // Log final summary
  console.log('\n📊 Test Summary:');
  console.log(`Total tickets tested: ${tickets.length}`);
  console.log(`Errors found: ${errors.length}`);

  await browser.close();
})();
