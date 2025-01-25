import { Database } from '@/types/supabase';
import { downloadAndStoreAttachment, parseGmailMessage } from '@/utils/gmail';
import { logger } from '@/utils/logger';
import { createClient } from '@supabase/supabase-js';
import { gmail_v1 } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';

type Schema$MessagePartHeader = gmail_v1.Schema$MessagePartHeader;

interface MessageHeader {
  name: string;
  value: string;
}

interface ProcessingMetrics {
  startTime: number;
  messageProcessingTime: number;
  totalMessages: number;
  successfulMessages: number;
  failedMessages: number;
}

async function getEmailBody(message: gmail_v1.Schema$Message): Promise<string> {
  const startTime = Date.now();
  await logger.info('Starting email body extraction', { messageId: message.id });

  if (!message.payload) {
    await logger.warn('No payload found in message', { messageId: message.id });
    return '';
  }

  // Function to decode base64 content
  const decodeBase64 = (data: string) => {
    try {
      return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    } catch (error) {
      logger.error('Failed to decode base64 content', { error, messageId: message.id });
      return '';
    }
  };

  // Function to find HTML part
  const findHtmlPart = (parts: gmail_v1.Schema$MessagePart[]): gmail_v1.Schema$MessagePart | null => {
    for (const part of parts) {
      if (part.mimeType === 'text/html') {
        return part;
      }
      if (part.parts) {
        const htmlPart = findHtmlPart(part.parts);
        if (htmlPart) return htmlPart;
      }
    }
    return null;
  };

  let body = '';
  
  // If the message has parts, look for HTML content
  if (message.payload.parts) {
    await logger.info('Processing multipart message', { 
      messageId: message.id,
      partCount: message.payload.parts.length 
    });
    
    const htmlPart = findHtmlPart(message.payload.parts);
    if (htmlPart && htmlPart.body?.data) {
      body = decodeBase64(htmlPart.body.data);
      await logger.info('Found HTML part', { messageId: message.id });
    }
  }

  // If no HTML part found but there's body data, use that
  if (!body && message.payload.body?.data) {
    body = decodeBase64(message.payload.body.data);
    await logger.info('Using plain body data', { messageId: message.id });
  }

  // Fallback to snippet
  if (!body) {
    body = message.snippet || '';
    await logger.info('Using message snippet as fallback', { messageId: message.id });
  }

  const processingTime = Date.now() - startTime;
  await logger.info('Completed email body extraction', { 
    messageId: message.id,
    processingTime,
    bodyLength: body.length 
  });

  return body;
}

// Initialize Supabase client with service role
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function processAttachments(
  auth: any,
  message: gmail_v1.Schema$Message,
  orgId: string
) {
  if (!message.id) {
    await logger.error('Message missing ID');
    return [];
  }

  // Transform Gmail message to our internal format
  const transformedMessage = {
    id: message.id,
    threadId: message.threadId || '',
    snippet: message.snippet || undefined,
    labelIds: message.labelIds || undefined,
    payload: message.payload ? {
      headers: message.payload.headers?.map(header => ({
        name: header.name || '',
        value: header.value || ''
      })),
      mimeType: message.payload.mimeType || undefined,
      body: message.payload.body ? {
        data: message.payload.body.data || undefined
      } : undefined,
      parts: message.payload.parts?.map(part => ({
        mimeType: part.mimeType || undefined,
        body: part.body ? {
          data: part.body.data || undefined
        } : undefined,
        parts: part.parts
      }))
    } : undefined
  };

  const parsedEmail = parseGmailMessage(transformedMessage);

  const attachmentPromises = parsedEmail.attachments.map(async (attachment) => {
    return downloadAndStoreAttachment(auth, message.id!, attachment, orgId);
  });

  const attachmentResults = await Promise.all(attachmentPromises);
  const validAttachments = attachmentResults.filter((result): result is { filePath: string; metadata: any } => result !== null);

  // Insert attachments into the database
  if (validAttachments.length > 0) {
    const { data: comment } = await supabase
      .from('comments')
      .select('id')
      .eq('ticket_id', message.threadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (comment) {
      const attachmentInserts = validAttachments.map((att) => ({
        comment_id: comment.id,
        file_path: att.filePath,
        metadata: att.metadata
      }));

      const { error: insertError } = await supabase
        .from('attachments')
        .insert(attachmentInserts);

      if (insertError) {
        await logger.error('Failed to insert attachments', { error: insertError });
      }
    }
  }

  return validAttachments;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const metrics: ProcessingMetrics = {
    startTime: Date.now(),
    messageProcessingTime: 0,
    totalMessages: 0,
    successfulMessages: 0,
    failedMessages: 0,
  };

  if (req.method !== 'POST') {
    await logger.warn('Invalid method', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, auth, orgId } = req.body;

    // Process message body
    const emailBody = await getEmailBody(message);
    
    // Process attachments
    const attachments = await processAttachments(auth, message, orgId);

    // Update the response to include attachment information
    res.status(200).json({ 
      success: true,
      body: emailBody,
      attachments: attachments.map(att => ({
        filePath: att.filePath,
        metadata: att.metadata
      }))
    });
  } catch (error) {
    await logger.error('Webhook handler error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function processMessage(message: gmail_v1.Schema$Message, orgId: string) {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      await logger.info('Processing message attempt', {
        messageId: message.id,
        orgId,
        attempt: retryCount + 1
      });

      if (!message || !message.payload) {
        throw new Error('Invalid message data');
      }

      // Extract email details
      const headers = message.payload.headers || [];
      const subject = headers.find((h: Schema$MessagePartHeader) => h.name === 'Subject')?.value || '';
      const from = headers.find((h: Schema$MessagePartHeader) => h.name === 'From')?.value || '';
      const to = headers.find((h: Schema$MessagePartHeader) => h.name === 'To')?.value || '';
      const threadId = message.threadId;

      await logger.info('Processing message', {
        messageId: message.id,
        subject,
        threadId,
        from,
        to
      });

      if (!threadId) {
        throw new Error('Message missing thread ID');
      }

      // Extract sender's email and name
      const fromMatch = from.match(/(?:"?([^"]*)"?\s*)?(?:<?(.+@[^>]+)>?)/);
      const senderName = fromMatch?.[1] || '';
      const senderEmail = fromMatch?.[2] || '';

      if (!senderEmail) {
        throw new Error('Could not extract sender email');
      }

      await logger.info('Extracted sender details', {
        senderName,
        senderEmail
      });

      // Find or create customer
      let customerId: string;
      const { data: existingCustomer, error: customerLookupError } = await supabase
        .from('customers')
        .select('id')
        .eq('email', senderEmail)
        .eq('org_id', orgId)
        .single();

      if (customerLookupError && customerLookupError.code !== 'PGRST116') {
        throw new Error(`Failed to lookup customer: ${customerLookupError.message}`);
      }

      if (existingCustomer) {
        customerId = existingCustomer.id;
        await logger.info('Found existing customer', {
          customerId,
          email: senderEmail
        });
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: senderName || senderEmail,
            email: senderEmail,
            org_id: orgId,
          })
          .select()
          .single();

        if (customerError) {
          throw new Error(`Failed to create customer: ${customerError.message}`);
        }

        if (!newCustomer) {
          throw new Error('Customer creation returned no data');
        }

        customerId = newCustomer.id;
        await logger.info('Created new customer', {
          customerId,
          email: senderEmail
        });
      }

      // Get HTML body
      const htmlBody = await getEmailBody(message);

      // Find matching ticket by thread_id
      const { data: existingTicket, error: ticketLookupError } = await supabase
        .from('tickets')
        .select('id')
        .eq('metadata->thread_id', threadId)
        .single();

      if (ticketLookupError && ticketLookupError.code !== 'PGRST116') {
        throw new Error(`Failed to lookup ticket: ${ticketLookupError.message}`);
      }

      let ticketId: string;

      if (existingTicket) {
        ticketId = existingTicket.id;
        await logger.info('Found existing ticket', {
          ticketId,
          threadId,
          messageId: message.id
        });
      } else {
        // Create new ticket if thread not found
        const { data: newTicket, error: ticketError } = await supabase
          .from('tickets')
          .insert({
            subject,
            description: message.snippet || '',
            status: 'open',
            priority: 'medium',
            customer_id: customerId,
            metadata: {
              thread_id: threadId,
              message_id: message.id || null,
            },
            org_id: orgId,
          })
          .select()
          .single();

        if (ticketError) {
          throw new Error(`Failed to create ticket: ${ticketError.message}`);
        }

        if (!newTicket) {
          throw new Error('Ticket creation returned no data');
        }

        ticketId = newTicket.id;
        await logger.info('Created new ticket', {
          ticketId,
          threadId,
          messageId: message.id
        });
      }

      // Store email in ticket_email_chats
      const { error: emailError } = await supabase
        .from('ticket_email_chats')
        .insert({
          ticket_id: ticketId,
          content: htmlBody,
          metadata: {
            message_id: message.id,
            thread_id: threadId,
            from,
            to,
            subject
          },
          type: 'email'
        });

      if (emailError) {
        throw new Error(`Failed to store email: ${emailError.message}`);
      }

      await logger.info('Stored email successfully', {
        ticketId,
        messageId: message.id
      });

      // If successful, break the retry loop
      break;
    } catch (error) {
      retryCount++;
      
      await logger.error('Failed to process message', {
        error,
        messageId: message.id,
        orgId,
        attempt: retryCount,
        maxRetries
      });

      if (retryCount === maxRetries) {
        throw error;
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
    }
  }
} 