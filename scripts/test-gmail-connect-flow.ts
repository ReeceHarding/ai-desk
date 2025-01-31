import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { resolve } from 'path';
import { GmailMessage, GmailMessagePart } from '../types/gmail';
import { Database } from '../types/supabase';
import { classifyInboundEmail, generateRagResponse } from '../utils/ai-responder';
import { parseGmailMessage } from '../utils/email-parser';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });
dotenv.config({ path: resolve(__dirname, '../.env') });

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function simulateGmailConnect() {
  try {
    console.log('=== Starting Gmail Connect Flow Test ===\n');

    // 1. Get test organization with Gmail tokens from seed.sql
    console.log('1. Getting test organization...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', '965a217d-791a-41aa-8230-8916761955d7')
      .single();

    if (orgError || !org) {
      throw new Error('Failed to get test organization: ' + orgError?.message);
    }

    console.log('Found test organization:', org.name);

    // 2. Set up Gmail client
    console.log('\n2. Setting up Gmail client...');
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: org.gmail_access_token!,
      refresh_token: org.gmail_refresh_token!,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // 3. List recent emails
    console.log('\n3. Fetching 10 recent emails...');
    const messages = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
    });

    if (!messages.data.messages) {
      throw new Error('No messages found');
    }

    console.log(`Found ${messages.data.messages.length} messages`);

    // 4. Process each message
    console.log('\n4. Processing messages and creating tickets...');
    for (const messageInfo of messages.data.messages) {
      const messageResponse = await gmail.users.messages.get({
        userId: 'me',
        id: messageInfo.id!,
      });

      const message = messageResponse.data;
      console.log(`\nProcessing message: ${message.id}`);

      // Parse the message with type assertion
      const parsedEmail = parseGmailMessage(message as unknown as GmailMessage & {
        payload?: { mimeType?: string; parts?: GmailMessagePart[] };
        historyId?: string;
      });
      console.log('- From:', parsedEmail.from);
      console.log('- Subject:', parsedEmail.subject);

      // Find or create customer
      console.log('- Looking up customer...');
      let customerId: string | undefined;

      // First try to find existing customer
      const { data: existingCustomer } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', parsedEmail.from)
        .eq('org_id', org.id)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        console.log('✓ Found existing customer:', customerId);
      } else {
        // Create new customer
        console.log('- Creating new customer...');
        const displayName = parsedEmail.from.split('@')[0];

        // Try to find existing auth user first
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers.users.find(u => u.email === parsedEmail.from);

        let userId: string | undefined;

        if (existingUser) {
          console.log('✓ Found existing auth user:', existingUser.id);
          userId = existingUser.id;

          // Check if profile exists for this user
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();

          if (existingProfile) {
            customerId = existingProfile.id;
            console.log('✓ Found existing profile:', customerId);
          }
        }

        if (!customerId) {
          if (!existingUser) {
            // Create new auth user
            const { data: auth, error: authError } = await supabase.auth.admin.createUser({
              email: parsedEmail.from,
              email_confirm: true,
              user_metadata: {
                source: 'gmail_import',
                created_at: new Date().toISOString()
              }
            });

            if (authError || !auth.user) {
              console.error('Failed to create auth user:', authError);
              continue;
            }

            userId = auth.user.id;
            console.log('✓ Created new auth user:', userId);
          }

          if (!userId) {
            console.error('No user ID available for profile creation');
            continue;
          }

          // Create profile
          const { data: newCustomer, error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              email: parsedEmail.from,
              display_name: displayName,
              role: 'customer',
              org_id: org.id,
              metadata: {
                source: 'gmail_import',
                created_at: new Date().toISOString()
              },
              extra_json_1: {},
              avatar_url: `https://placehold.co/400x400/png?text=${displayName[0].toUpperCase()}`
            })
            .select()
            .single();

          if (profileError || !newCustomer) {
            console.error('Failed to create customer profile:', profileError);
            continue;
          }

          customerId = newCustomer.id;
          console.log('✓ Created new customer profile:', customerId);
        }
      }

      if (!customerId) {
        console.error('Failed to get or create customer');
        continue;
      }

      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          org_id: org.id,
          customer_id: customerId,
          subject: parsedEmail.subject,
          description: parsedEmail.bodyText,
          status: 'open',
          priority: 'medium',
          type: 'email',
          source: 'gmail',
        })
        .select()
        .single();

      if (ticketError || !ticket) {
        console.error('Failed to create ticket:', ticketError);
        continue;
      }

      console.log('✓ Created ticket:', ticket.id);

      // Create email chat entry
      const { data: chat, error: chatError } = await supabase
        .from('ticket_email_chats')
        .insert({
          ticket_id: ticket.id,
          message_id: parsedEmail.id,
          thread_id: parsedEmail.threadId,
          from_address: parsedEmail.from,
          to_address: parsedEmail.to,
          cc_address: parsedEmail.cc,
          bcc_address: parsedEmail.bcc,
          subject: parsedEmail.subject,
          body: parsedEmail.bodyText,
          gmail_date: new Date(parsedEmail.date.replace(/\s\(.*\)$/, '')).toISOString(),
          org_id: org.id,
          ai_classification: 'unknown',
          ai_confidence: 0,
          ai_auto_responded: false,
          ai_draft_response: null,
        })
        .select()
        .single();

      if (chatError || !chat) {
        console.error('Failed to create email chat:', chatError);
        continue;
      }

      console.log('✓ Created email chat:', chat.id);

      // Classify email and generate AI draft
      console.log('- Generating AI draft...');
      const { classification, confidence } = await classifyInboundEmail(parsedEmail.bodyText);

      if (classification === 'should_respond') {
        const { response: ragResponse, confidence: ragConfidence } = await generateRagResponse(
          parsedEmail.bodyText,
          org.id,
          5
        );

        // Update chat with AI draft
        const { error: updateError } = await supabase
          .from('ticket_email_chats')
          .update({
            ai_classification: classification,
            ai_confidence: confidence,
            ai_draft_response: ragResponse,
            metadata: {
              rag_confidence: ragConfidence,
            },
          })
          .eq('id', chat.id);

        if (updateError) {
          console.error('Failed to update chat with AI draft:', updateError);
        } else {
          console.log('✓ AI draft created');
        }
      } else {
        console.log('× Email classified as no response needed');
      }
    }

    console.log('\n✅ Gmail connect flow test completed successfully');

  } catch (error) {
    console.error('Error in Gmail connect flow test:', error);
    process.exit(1);
  }
}

// Run the test
simulateGmailConnect(); 