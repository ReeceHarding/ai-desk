import { logger } from '@/utils/logger';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { NextApiRequest, NextApiResponse } from 'next';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const BATCH_SIZE = 50; // Process 50 notifications at a time

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerSupabaseClient({ req, res });

    // Get pending notifications
    const { data: notifications, error: fetchError } = await supabase
      .from('notification_history')
      .select(`
        *,
        profiles:user_id (
          email,
          display_name
        ),
        tickets (
          id,
          subject,
          status
        )
      `)
      .eq('status', 'pending')
      .limit(BATCH_SIZE);

    if (fetchError) {
      logger.error('Error fetching notifications', { error: fetchError });
      return res.status(500).json({ error: 'Failed to fetch notifications' });
    }

    if (!notifications?.length) {
      return res.status(200).json({ message: 'No pending notifications' });
    }

    // Process each notification
    const results = await Promise.allSettled(
      notifications.map(async (notification) => {
        try {
          switch (notification.type) {
            case 'email':
              // Send email via Resend
              await resend.emails.send({
                from: 'Zendesk <support@resend.dev>',
                to: notification.profiles.email,
                subject: notification.subject,
                html: `
                  <div>
                    <h2>${notification.subject}</h2>
                    <p>${notification.body}</p>
                    <p>View ticket: <a href="${process.env.NEXT_PUBLIC_BASE_URL}/tickets/${notification.ticket_id}">${process.env.NEXT_PUBLIC_BASE_URL}/tickets/${notification.ticket_id}</a></p>
                  </div>
                `,
              });
              break;

            case 'push':
              // TODO: Implement push notifications
              logger.warn('Push notifications not implemented yet');
              break;

            case 'summary':
              // TODO: Implement daily summary
              logger.warn('Daily summary not implemented yet');
              break;

            default:
              throw new Error(`Unknown notification type: ${notification.type}`);
          }

          // Update notification status to sent
          const { error: updateError } = await supabase
            .from('notification_history')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
            })
            .eq('id', notification.id);

          if (updateError) {
            throw updateError;
          }

          return { success: true, id: notification.id };
        } catch (error) {
          // Update notification status to failed
          await supabase
            .from('notification_history')
            .update({
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
            })
            .eq('id', notification.id);

          logger.error('Failed to process notification', {
            notificationId: notification.id,
            error: error instanceof Error ? error.message : String(error),
          });

          return { success: false, id: notification.id, error };
        }
      })
    );

    // Count successes and failures
    const successes = results.filter(
      (result) => result.status === 'fulfilled' && result.value.success
    ).length;
    const failures = results.filter(
      (result) => result.status === 'rejected' || !result.value?.success
    ).length;

    logger.info('Processed notifications', {
      total: notifications.length,
      successes,
      failures,
    });

    return res.status(200).json({
      message: 'Processed notifications',
      total: notifications.length,
      successes,
      failures,
    });
  } catch (error) {
    logger.error('Error in notification processing', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 