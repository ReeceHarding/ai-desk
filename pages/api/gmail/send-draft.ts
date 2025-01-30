import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { sendGmailReply } from '@/utils/server/gmail';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    await logger.warn('Invalid method', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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

    const { chatId } = req.body;

    if (!chatId) {
      await logger.warn('Missing chatId');
      return res.status(400).json({ error: 'Missing chatId' });
    }

    // Get the chat record
    const { data: chatRecord, error: chatError } = await supabase
      .from('ticket_email_chats')
      .select(`
        *,
        ticket:tickets(org_id)
      `)
      .eq('id', chatId)
      .single();

    if (chatError || !chatRecord) {
      await logger.error('Failed to get chat record', { error: chatError });
      return res.status(404).json({ error: 'Chat record not found' });
    }

    if (!chatRecord.ai_draft_response) {
      await logger.warn('No draft response found', { chatId });
      return res.status(400).json({ error: 'No draft response found' });
    }

    // Send the email
    await sendGmailReply({
      threadId: chatRecord.thread_id,
      inReplyTo: chatRecord.message_id,
      to: Array.isArray(chatRecord.from_address) 
        ? chatRecord.from_address 
        : [chatRecord.from_address],
      subject: `Re: ${chatRecord.subject || 'Support Request'}`,
      htmlBody: chatRecord.ai_draft_response,
      orgId: chatRecord.ticket.org_id,
    });

    // Update the record
    const { error: updateError } = await supabase
      .from('ticket_email_chats')
      .update({
        ai_auto_responded: true,
      })
      .eq('id', chatId);

    if (updateError) {
      await logger.error('Failed to update chat record', { error: updateError });
      return res.status(500).json({ error: 'Failed to update chat record' });
    }

    await logger.info('Draft response sent successfully', { chatId });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    await logger.error('Error sending draft response', { error });
    return res.status(500).json({ error: 'Failed to send draft response' });
  }
} 