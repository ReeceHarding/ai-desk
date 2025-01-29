import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';

function encodeBase64(text: string): string {
  return Buffer.from(text)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Initialize Supabase admin client for storage access
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function downloadAttachment(url: string): Promise<Buffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function constructEmailWithAttachments(
  { fromAddress, toAddresses, ccAddresses, bccAddresses, subject, htmlBody, inReplyTo, references }: any,
  attachments: Array<{ name: string; url: string; }>
) {
  const boundary = '====boundary====';
  let raw = '';

  // Email headers
  raw += `From: ${fromAddress}\r\n`;
  raw += `To: ${toAddresses.join(', ')}\r\n`;
  if (ccAddresses?.length) {
    raw += `Cc: ${ccAddresses.join(', ')}\r\n`;
  }
  if (bccAddresses?.length) {
    raw += `Bcc: ${bccAddresses.join(', ')}\r\n`;
  }
  raw += `Subject: ${subject}\r\n`;
  
  // Add threading headers
  if (inReplyTo && typeof inReplyTo === 'string' && inReplyTo.length > 0) {
    // Gmail Message-IDs are always wrapped in < >
    raw += `In-Reply-To: <${inReplyTo.replace(/[<>]/g, '')}>\r\n`;
  }
  
  if (references) {
    // If references is a string, use it directly
    if (typeof references === 'string') {
      // Gmail Message-IDs are always wrapped in < >
      raw += `References: <${references.replace(/[<>]/g, '')}>\r\n`;
    } 
    // If references is an array, join with spaces
    else if (Array.isArray(references)) {
      raw += `References: ${references.map(ref => `<${ref.replace(/[<>]/g, '')}>`).join(' ')}\r\n`;
    }
  } 
  // If we have inReplyTo but no references, use inReplyTo as references
  else if (inReplyTo && typeof inReplyTo === 'string' && inReplyTo.length > 0) {
    raw += `References: <${inReplyTo.replace(/[<>]/g, '')}>\r\n`;
  }

  raw += `MIME-Version: 1.0\r\n`;
  raw += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

  // HTML Part
  raw += `--${boundary}\r\n`;
  raw += `Content-Type: text/html; charset="UTF-8"\r\n`;
  raw += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
  raw += `${htmlBody}\r\n\r\n`;

  // Attachments
  for (const attachment of attachments) {
    try {
      const fileData = await downloadAttachment(attachment.url);
      const base64Data = fileData.toString('base64');
      
      raw += `--${boundary}\r\n`;
      raw += `Content-Type: application/octet-stream\r\n`;
      raw += `Content-Transfer-Encoding: base64\r\n`;
      raw += `Content-Disposition: attachment; filename="${attachment.name}"\r\n\r\n`;
      raw += `${base64Data}\r\n\r\n`;
    } catch (error) {
      console.error(`Failed to process attachment ${attachment.name}:`, error);
    }
  }

  raw += `--${boundary}--`;

  return encodeBase64(raw);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    await logger.warn('Invalid method', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await logger.info('Starting email send process', { 
      to: req.body.toAddresses,
      subject: req.body.subject,
      hasAttachments: req.body.attachments?.length > 0 
    });

    const supabase = createPagesServerClient<Database>({ req, res });
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) {
      await logger.error('Session error', { error: sessionError });
      return res.status(401).json({ error: 'Session error' });
    }

    if (!session) {
      await logger.warn('No session found');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      fromAddress,
      toAddresses,
      ccAddresses,
      bccAddresses,
      subject,
      htmlBody,
      inReplyTo,
      references,
      threadId,
      ticketId,
      attachments,
      orgId,
    } = req.body;

    // Validate required fields with detailed logging
    const requiredFields = {
      fromAddress,
      toAddresses,
      subject,
      htmlBody,
      orgId,
      ticketId
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      await logger.error('Missing required fields', { 
        missingFields,
        providedFields: Object.keys(req.body),
        values: {
          hasFrom: !!fromAddress,
          hasTo: Array.isArray(toAddresses) && toAddresses.length > 0,
          hasSubject: !!subject,
          hasBody: !!htmlBody,
          hasOrgId: !!orgId,
          hasTicketId: !!ticketId
        }
      });
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: `Missing fields: ${missingFields.join(', ')}`
      });
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = [];
    
    if (!emailRegex.test(fromAddress)) {
      invalidEmails.push(`fromAddress: ${fromAddress}`);
    }
    
    if (!toAddresses.every((email: string) => emailRegex.test(email))) {
      invalidEmails.push(`toAddresses: ${toAddresses.join(', ')}`);
    }

    if (invalidEmails.length > 0) {
      await logger.error('Invalid email addresses', { invalidEmails });
      return res.status(400).json({ 
        error: 'Invalid email addresses',
        details: invalidEmails
      });
    }

    // Remove the RPC call and use the passed orgId directly
    await logger.info('Using organization ID from request', { 
      orgId,
      ticketId,
      threadId: threadId || 'none',
      emailDetails: {
        from: fromAddress,
        to: toAddresses,
        subject
      }
    });

    // Get current user's profile first
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('gmail_access_token, gmail_refresh_token')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      await logger.error('Failed to get profile', { error: profileError });
      return res.status(500).json({ error: 'Failed to get profile' });
    }

    // Use profile tokens if available
    let accessToken = profile?.gmail_access_token;
    let refreshToken = profile?.gmail_refresh_token;

    // If no profile tokens, try organization tokens
    if (!accessToken || !refreshToken) {
      await logger.info('No profile tokens found, checking organization tokens');
      
      // Get organization's Gmail tokens using the orgId we already have
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('gmail_access_token, gmail_refresh_token')
        .eq('id', orgId)
        .single();

      if (orgError || !orgData) {
        await logger.error('Failed to get organization tokens', { error: orgError });
        return res.status(500).json({ error: 'Failed to get organization tokens' });
      }

      accessToken = orgData.gmail_access_token;
      refreshToken = orgData.gmail_refresh_token;
    }

    if (!accessToken || !refreshToken) {
      await logger.error('No Gmail tokens found in profile or organization');
      return res.status(500).json({ error: 'Gmail tokens not configured' });
    }

    await logger.info('Setting up Gmail OAuth2 client');

    // Set up Gmail OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    await logger.info('Constructing email with attachments', { 
      attachmentCount: attachments?.length || 0 
    });

    // Construct email with attachments
    const raw = await constructEmailWithAttachments(
      {
        fromAddress,
        toAddresses,
        ccAddresses,
        bccAddresses,
        subject,
        htmlBody,
        inReplyTo,
        references,
      },
      attachments || []
    );

    await logger.info('Sending email via Gmail API');

    // Send email via Gmail API
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Prepare the message request
    const messageRequest: any = {
      userId: 'me',
      requestBody: {
        raw,
      }
    };

    // Only add threadId if it exists and is valid
    if (threadId && typeof threadId === 'string' && threadId.length > 0) {
      messageRequest.requestBody.threadId = threadId;
    }

    // Send the message
    const result = await gmail.users.messages.send(messageRequest).catch(async (error) => {
      await logger.error('Gmail API error', { 
        error: error.message,
        code: error.code,
        status: error.status,
        threadId,
        inReplyTo,
        references
      });
      throw error;
    });

    await logger.info('Email sent successfully, storing in database', {
      messageId: result.data.id,
      threadId: result.data.threadId,
      inReplyTo,
      references
    });

    // Store in ticket_email_chats
    const { data: chatData, error: chatError } = await supabase
      .from('ticket_email_chats')
      .insert({
        ticket_id: ticketId,
        message_id: result.data.id || '',
        thread_id: result.data.threadId || threadId || '',
        from_address: fromAddress,
        to_address: toAddresses,
        cc_address: ccAddresses || [],
        bcc_address: bccAddresses || [],
        subject: subject || '',
        body: htmlBody,
        attachments: attachments,
        gmail_date: new Date().toISOString(),
        org_id: orgId,
      })
      .select()
      .single();

    if (chatError) {
      await logger.error('Failed to store email in ticket_email_chats', { error: chatError });
      return res.status(500).json({ error: 'Failed to store email' });
    }

    await logger.info('Email process completed successfully', { 
      messageId: result.data.id,
      threadId: result.data.threadId
    });

    return res.status(200).json(chatData);
  } catch (error: any) {
    await logger.error('Unhandled error in email send process', { 
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    return res.status(500).json({ 
      error: 'Failed to send email',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
} 