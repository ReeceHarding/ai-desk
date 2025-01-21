import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { pollGmailInbox, parseGmailMessage } from '../utils/gmail';
import { handleInboundEmail } from '../utils/inbound-email';
import { Database } from '../types/supabase';

// Load environment variables
config();

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function runTests() {
  console.log('Starting Gmail polling tests...\n');

  // Test 1: Check if we can fetch Gmail tokens
  console.log('Test 1: Fetching Gmail tokens...');
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, gmail_refresh_token, gmail_access_token')
    .not('gmail_refresh_token', 'is', null)
    .limit(1);

  if (!orgs || orgs.length === 0) {
    console.log('❌ No organizations found with Gmail tokens');
    console.log('Please connect at least one Gmail account first');
    return;
  }
  console.log('✅ Found organization with Gmail tokens\n');

  // Test 2: Try polling Gmail
  console.log('Test 2: Polling Gmail inbox...');
  try {
    const org = orgs[0];
    const messages = await pollGmailInbox({
      refresh_token: org.gmail_refresh_token!,
      access_token: org.gmail_access_token!,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/gmail.modify',
      expiry_date: 0
    });
    console.log(`✅ Successfully polled Gmail. Found ${messages.length} messages\n`);

    // Test 3: Parse a message (if any found)
    if (messages.length > 0) {
      console.log('Test 3: Parsing first message...');
      const parsedEmail = parseGmailMessage(messages[0]);
      console.log('✅ Successfully parsed message:');
      console.log('  Subject:', parsedEmail.subject);
      console.log('  From:', parsedEmail.from);
      console.log('  Thread ID:', parsedEmail.threadId, '\n');

      // Test 4: Create or update ticket
      console.log('Test 4: Creating/updating ticket...');
      const result = await handleInboundEmail(parsedEmail, org.id);
      console.log('✅ Successfully processed email:');
      console.log('  Ticket ID:', result.ticketId);
      console.log('  Is New Ticket:', result.isNewTicket, '\n');
    } else {
      console.log('ℹ️ No messages found to parse and create tickets\n');
    }
  } catch (error) {
    console.error('❌ Error during tests:', error);
  }

  console.log('Tests completed!');
}

// Run the tests
runTests().catch(console.error); 