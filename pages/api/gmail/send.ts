import { logger } from '@/utils/logger';
import { getGmailClient } from '@/utils/server/gmail';
import { createClient } from '@supabase/supabase-js';
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

  // Email headers with proper content type
  raw += `MIME-Version: 1.0\r\n`;
  raw += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`;
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
    raw += `In-Reply-To: <${inReplyTo.replace(/[<>]/g, '')}>\r\n`;
  }
  
  if (references) {
    if (typeof references === 'string') {
      raw += `References: <${references.replace(/[<>]/g, '')}>\r\n`;
    } else if (Array.isArray(references)) {
      raw += `References: ${references.map(ref => `<${ref.replace(/[<>]/g, '')}>`).join(' ')}\r\n`;
    }
  } else if (inReplyTo && typeof inReplyTo === 'string' && inReplyTo.length > 0) {
    raw += `References: <${inReplyTo.replace(/[<>]/g, '')}>\r\n`;
  }

  raw += '\r\n';  // End of headers

  // HTML Part with proper content type and encoding
  raw += `--${boundary}\r\n`;
  raw += `Content-Type: text/html; charset="UTF-8"\r\n`;
  raw += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
  
  // Wrap the HTML body in proper tags and add default styling
  const styledHtmlBody = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    margin: 0;
    padding: 20px;
  }
  p {
    margin: 0 0 1em 0;
  }
  br {
    display: block;
    margin: 0.5em 0;
    content: " ";
  }
  ul, ol {
    margin: 0 0 1em 0;
    padding-left: 20px;
  }
  li {
    margin-bottom: 0.5em;
  }
</style>
</head>
<body>
${htmlBody}
</body>
</html>
`.trim();

  raw += styledHtmlBody + '\r\n\r\n';

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
    const {
      threadId,
      fromAddress,
      toAddresses,
      subject,
      htmlBody,
      inReplyTo,
      references,
      ticketId,
      orgId
    } = req.body;

    // Validate required fields
    const requiredFields = {
      threadId,
      fromAddress,
      toAddresses,
      subject,
      htmlBody,
      ticketId,
      orgId
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: `Missing: ${missingFields.join(', ')}`
      });
    }

    // Get the Gmail client
    const gmail = await getGmailClient(orgId);

    // Construct email with attachments
    const raw = await constructEmailWithAttachments(
      {
        fromAddress,
        toAddresses,
        subject,
        htmlBody,
        inReplyTo,
        references
      },
      req.body.attachments || []
    );

    // Send the email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        threadId,
      },
    });

    if (!response.data.id) {
      throw new Error('Failed to send email: No message ID returned');
    }

    // Log success
    await logger.info('Sent Gmail reply', {
      messageId: response.data.id,
      threadId,
      ticketId,
      orgId
    });

    // Store the sent email in ticket_email_chats
    const { error: dbError } = await supabaseAdmin
      .from('ticket_email_chats')
      .insert({
        ticket_id: ticketId,
        message_id: response.data.id,
        thread_id: threadId,
        from_address: fromAddress,
        to_address: toAddresses,
        subject,
        body: htmlBody,
        org_id: orgId,
        gmail_date: new Date().toISOString()
      });

    if (dbError) {
      await logger.error('Failed to store sent email', { error: dbError });
    }

    return res.status(200).json({
      success: true,
      messageId: response.data.id,
      threadId: response.data.threadId
    });
  } catch (error: any) {
    await logger.error('Failed to send Gmail reply', { error: error.message });
    return res.status(500).json({
      error: 'Failed to send email',
      details: error.message,
    });
  }
} 