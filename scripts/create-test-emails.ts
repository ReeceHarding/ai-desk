import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const testEmails = [
  {
    subject: 'Unable to access account',
    body: `<p>Hi Support Team,</p>
           <p>I'm having trouble logging into my account. When I try to sign in, it says my password is incorrect, but I'm sure I'm using the right one.</p>
           <p>Can you help me reset it?</p>
           <p>Thanks,<br>John</p>`,
    from: 'john@example.com'
  },
  {
    subject: 'Feature request: Dark mode',
    body: `<p>Hello,</p>
           <p>I love your application but working late at night, the bright interface hurts my eyes. Would it be possible to add a dark mode option?</p>
           <p>Best regards,<br>Sarah</p>`,
    from: 'sarah@example.com'
  },
  {
    subject: 'Integration question',
    body: `<p>Support team,</p>
           <p>I'm trying to integrate your API with my application. The documentation mentions an endpoint /api/v1/data but I'm getting a 404 error.</p>
           <p>Here's what I've tried so far...</p>
           <p>Thanks,<br>Mike</p>`,
    from: 'mike@example.com'
  }
];

async function createTestEmailsAndTickets() {
  try {
    console.log('Starting test email creation...');
    
    // Get the first organization
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (orgsError || !orgs?.length) {
      throw new Error('No organization found');
    }

    const orgId = orgs[0].id;

    // Get or create a test customer
    const { data: customers, error: customersError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'customer')
      .limit(1);

    if (customersError) {
      throw new Error('Error fetching customers');
    }

    let customerId: string;
    if (!customers?.length) {
      // Create a test customer
      const { data: newCustomer, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: uuidv4(),
          role: 'customer',
          display_name: 'Test Customer',
          email: 'test@example.com',
          org_id: orgId
        })
        .select()
        .single();

      if (createError || !newCustomer) {
        throw new Error('Failed to create test customer');
      }
      customerId = newCustomer.id;
    } else {
      customerId = customers[0].id;
    }

    // Create tickets and email chats for each test email
    for (const email of testEmails) {
      console.log(`Creating ticket for email: ${email.subject}`);

      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          subject: email.subject,
          description: email.body,
          status: 'open',
          priority: 'medium',
          customer_id: customerId,
          org_id: orgId,
          metadata: {
            source: 'email',
            email_from: email.from
          }
        })
        .select()
        .single();

      if (ticketError || !ticket) {
        console.error('Error creating ticket:', ticketError);
        continue;
      }

      // Create email chat
      const { error: chatError } = await supabase
        .from('ticket_email_chats')
        .insert({
          ticket_id: ticket.id,
          message_id: `test-${uuidv4()}`,
          thread_id: `thread-${uuidv4()}`,
          from_address: email.from,
          to_address: 'support@company.com',
          subject: email.subject,
          body: email.body,
          html_body: email.body,
          sent_at: new Date().toISOString(),
          metadata: {
            source: 'test_script',
            test_email: true
          }
        });

      if (chatError) {
        console.error('Error creating email chat:', chatError);
      } else {
        console.log(`Successfully created ticket and email chat for: ${email.subject}`);
      }
    }

    console.log('Test email creation completed');
  } catch (error) {
    console.error('Error during test email creation:', error);
    process.exit(1);
  }
}

createTestEmailsAndTickets(); 