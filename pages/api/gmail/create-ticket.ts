import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';
import { Database } from '../../../types/supabase';

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { parsedEmail, userId } = req.body;

    if (!parsedEmail || !userId) {
      return res.status(400).json({ error: 'Parsed email and user ID are required' });
    }

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Failed to fetch user profile:', profileError);
      throw profileError;
    }

    if (!profile?.org_id) {
      throw new Error('User organization not found');
    }

    // Validate required fields
    if (!parsedEmail.subject && !parsedEmail.snippet) {
      console.warn('Email missing subject and snippet, using default subject');
      parsedEmail.subject = '(No Subject)';
    }

    // Check if sender already exists as a user
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', parsedEmail.from)
      .single();

    let customerId: string;

    if (existingUser) {
      customerId = existingUser.id;
    } else {
      // Create a new user profile for the sender
      const { data: auth, error: authError } = await supabase.auth.admin.createUser({
        email: parsedEmail.from,
        email_confirm: true,
        user_metadata: {
          email: parsedEmail.from,
          email_verified: true,
          signup_completed: true
        }
      });

      if (authError) {
        console.error('Failed to create auth user for sender:', authError);
        throw authError;
      }

      // Create profile for the new user
      const { data: newProfile, error: profileCreateError } = await supabase
        .from('profiles')
        .insert({
          id: auth.user.id,
          email: parsedEmail.from,
          role: 'customer'
        })
        .select()
        .single();

      if (profileCreateError) {
        console.error('Failed to create profile for sender:', profileCreateError);
        throw profileCreateError;
      }

      customerId = auth.user.id;
    }

    // Create ticket with metadata as JSON string
    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({
        subject: parsedEmail.subject || '(No Subject)',
        description: parsedEmail.body.text || parsedEmail.snippet || 'No content',
        status: 'open',
        priority: 'medium',
        customer_id: customerId,
        org_id: profile.org_id,
        metadata: JSON.stringify({
          email_message_id: parsedEmail.messageId,
          email_thread_id: parsedEmail.threadId,
          email_from: parsedEmail.from,
          email_to: parsedEmail.to,
          email_date: parsedEmail.date
        })
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create ticket:', error);
      throw error;
    }

    // Create ticket_email_chats record
    const { error: chatError } = await supabase
      .from('ticket_email_chats')
      .insert({
        ticket_id: ticket.id,
        message_id: parsedEmail.messageId,
        thread_id: parsedEmail.threadId,
        from_address: parsedEmail.from,
        to_address: Array.isArray(parsedEmail.to) ? parsedEmail.to : [parsedEmail.to],
        cc_address: parsedEmail.cc || [],
        bcc_address: parsedEmail.bcc || [],
        subject: parsedEmail.subject,
        body: parsedEmail.body.text || parsedEmail.body.html || parsedEmail.snippet || '',
        gmail_date: parsedEmail.date,
        org_id: profile.org_id
      });

    if (chatError) {
      console.error('Failed to create ticket_email_chats record:', chatError);
      // Don't throw here, as we still want to return the ticket
    }

    return res.status(200).json(ticket);
  } catch (error: any) {
    console.error('Error creating ticket from email:', error);
    return res.status(error.code || 500).json({ error: error.message });
  }
} 