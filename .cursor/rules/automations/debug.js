const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env.local') });

// Initialize Supabase client
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase configuration. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  const browser = await chromium.launch({ headless: false }); // Set to true if you don't need to see the browser
  const page = await browser.newPage();

  console.log('🔍 Fetching ticket IDs from Supabase...');
  const { data: tickets, error } = await supabase.from('tickets').select('id');

  if (error) {
    console.error('❌ Error fetching tickets:', error.message);
    await browser.close();
    return;
  }

  if (!tickets.length) {
    console.log('✅ No tickets found. Exiting.');
    await browser.close();
    return;
  }

  console.log(`✅ Found ${tickets.length} tickets. Checking pages...`);

  for (const ticket of tickets) {
    const url = `http://localhost:3000/tickets/${ticket.id}`;
    console.log(`🔍 Checking ${url}...`);

    let foundError = false;

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`🚨 [BROWSER ERROR] ${url}: ${msg.text()}`);
        foundError = true;
      }
    });

    page.on('pageerror', error => {
      console.error(`🚨 [PAGE ERROR] ${url} - ${error.message}`);
      foundError = true;
    });

    // Try navigating to the ticket page
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000); // Let page fully load

      // 🛠️ **1. Check if ticket content is actually visible**
      const ticketContent = await page.locator('.ticket-content'); // Adjust the selector based on your UI
      if (!(await ticketContent.isVisible())) {
        console.error(`❌ Ticket content is missing on ${url}`);
        foundError = true;
      }

      // 🛠️ **2. Test sending a message in the ticket thread**
      console.log(`💬 Testing message sending on ${url}...`);
      const messageBox = page.locator('textarea.message-input'); // Adjust selector
      const sendButton = page.locator('button.send-message'); // Adjust selector

      if (await messageBox.isVisible() && await sendButton.isVisible()) {
        await messageBox.fill('Test message from Playwright');
        await sendButton.click();
        await page.waitForTimeout(2000); // Allow message to process

        // 🛠️ **3. Check if message appears in the thread**
        const sentMessage = await page.locator('.message-bubble:has-text("Test message from Playwright")');
        if (!(await sentMessage.isVisible())) {
          console.error(`❌ Sent message did not appear on ${url}`);
          foundError = true;
        } else {
          console.log(`✅ Message successfully sent on ${url}`);
        }
      } else {
        console.error(`❌ Cannot find message input or send button on ${url}`);
        foundError = true;
      }
    } catch (err) {
      console.error(`🚨 [NAVIGATION ERROR] ${url} - ${err.message}`);
      foundError = true;
    }

    if (foundError) {
      console.log(`❌ Error found on ${url}. Stopping execution.`);
      break; // Stop checking more pages
    }
  }

  await browser.close();
})();
