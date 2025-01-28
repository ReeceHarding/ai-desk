import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

const testEmails = [
  {
    subject: 'Security alert',
    body: `<p>Hi,</p>
           <p>We noticed a new sign-in to your account from a new device or location.</p>
           <p>Location: San Francisco, CA<br>
           Device: Chrome on Mac OS X<br>
           Time: January 28, 2024, 10:30 AM PST</p>
           <p>If this was you, you can ignore this message. If not, please secure your account.</p>
           <p>Best regards,<br>Security Team</p>`,
    from: 'collegeforreece@gmail.com'
  },
  {
    subject: 'Frederick Johnson sent you $860.00 USD',
    body: `<p>Hi Reece Harding,</p>
           <p>Frederick Johnson has sent you $860.00 USD.</p>
           <p>Transaction Details:<br>
           Amount: $860.00 USD<br>
           From: Frederick Johnson<br>
           Note: Payment for freelance work</p>
           <p>The money has been added to your balance.</p>
           <p>Thank you for using our service!</p>`,
    from: 'frederick.johnson@example.com',
    from_name: 'Frederick Johnson'
  },
  {
    subject: 'Annabel Catherine Wilson sent you $300.00 USD',
    body: `<p>Hi Reece Harding,</p>
           <p>Annabel Catherine Wilson has sent you $300.00 USD.</p>
           <p>Transaction Details:<br>
           Amount: $300.00 USD<br>
           From: Annabel Catherine Wilson<br>
           Note: Monthly subscription payment</p>
           <p>The money has been added to your balance.</p>
           <p>Thank you for using our service!</p>`,
    from: 'annabel.wilson@example.com',
    from_name: 'Annabel Catherine Wilson'
  }
];

async function createTestEmailsAndTickets() {
  try {
    console.log('Starting test email creation...');
    
    // Step 1: Create or get organization
    console.log('Step 1: Getting or creating organization...');
    let orgId: string;
    
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(1);

    if (orgsError) {
      console.error('Error fetching organizations:', orgsError);
      throw new Error(`Error fetching organizations: ${orgsError.message}`);
    }

    if (!orgs?.length) {
      console.log('No organization found, creating one...');
      const { data: newOrg, error: createOrgError } = await supabase
        .from('organizations')
        .upsert([{
          name: 'Test Organization',
          sla_tier: 'basic',
          config: {},
          gmail_access_token: null,
          gmail_refresh_token: null,
          gmail_watch_expiration: null,
          gmail_history_id: null
        }], { onConflict: 'name' })
        .select()
        .single();

      if (createOrgError) {
        console.error('Error creating organization:', createOrgError);
        throw new Error(`Failed to create organization: ${createOrgError.message}`);
      }
      
      if (!newOrg) {
        throw new Error('Organization creation returned no data');
      }
      
      orgId = newOrg.id;
      console.log('Created organization:', { id: newOrg.id, name: newOrg.name });
    } else {
      orgId = orgs[0].id;
      console.log('Using existing organization:', { id: orgs[0].id, name: orgs[0].name });
    }

    // Step 2: Create or get customer profile
    console.log('Step 2: Getting or creating customer profile...');
    const { data: customers, error: customersError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('role', 'customer')
      .eq('org_id', orgId)
      .limit(1);

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      throw new Error(`Error fetching customers: ${customersError.message}`);
    }

    let customerId: string;
    if (!customers?.length) {
      console.log('No customer found, creating one...');
      const userId = uuidv4();
      const { data: newCustomer, error: createCustomerError } = await supabase
        .from('profiles')
        .upsert([{
          id: userId,
          role: 'customer',
          display_name: 'Reece Harding',
          email: 'reeceharding@gmail.com',
          org_id: orgId,
          metadata: {}
        }], { onConflict: 'email' })
        .select()
        .single();

      if (createCustomerError) {
        console.error('Error creating customer:', createCustomerError);
        throw new Error(`Failed to create customer: ${createCustomerError.message}`);
      }
      
      if (!newCustomer) {
        throw new Error('Customer creation returned no data');
      }
      
      customerId = newCustomer.id;
      console.log('Created customer:', { id: newCustomer.id, email: newCustomer.email });
    } else {
      customerId = customers[0].id;
      console.log('Using existing customer:', { id: customers[0].id, email: customers[0].email });
    }

    // Step 3: Create tickets and email chats
    console.log('Step 3: Creating tickets and email chats...');
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

      if (ticketError) {
        console.error('Error creating ticket:', ticketError);
        continue;
      }

      if (!ticket) {
        console.error('Ticket creation returned no data');
        continue;
      }

      console.log('Created ticket:', { id: ticket.id, subject: ticket.subject });

      // Create email chat
      const { error: chatError } = await supabase
        .from('ticket_email_chats')
        .insert({
          ticket_id: ticket.id,
          message_id: `test-${uuidv4()}`,
          thread_id: `thread-${uuidv4()}`,
          from_name: email.from_name || null,
          from_address: email.from,
          to_address: ['reeceharding@gmail.com'],
          cc_address: [],
          bcc_address: [],
          subject: email.subject,
          body: email.body,
          attachments: {},
          gmail_date: new Date().toISOString(),
          org_id: orgId,
          ai_classification: 'unknown',
          ai_confidence: 0,
          ai_auto_responded: false
        });

      if (chatError) {
        console.error('Error creating email chat:', chatError);
      } else {
        console.log(`Successfully created email chat for ticket: ${ticket.id}`);
      }
    }

    console.log('Test email creation completed successfully');
  } catch (error) {
    console.error('Error during test email creation:', error);
    process.exit(1);
  }
}

createTestEmailsAndTickets(); 