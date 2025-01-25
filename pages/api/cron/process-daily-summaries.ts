import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { NextApiRequest, NextApiResponse } from 'next';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

type Profile = Database['public']['Tables']['profiles']['Row'];
type Ticket = Database['public']['Tables']['tickets']['Row'];
type Comment = Database['public']['Tables']['comments']['Row'];

interface UserWithProfile {
  user_id: string;
  org_id: string;
  profiles: Pick<Profile, 'email' | 'display_name'>;
}

interface TicketWithComments extends Ticket {
  comments: Array<Comment & {
    author: Pick<Profile, 'display_name'>;
  }>;
}

// Verify cron secret to ensure only authorized calls
const verifyCronSecret = (req: NextApiRequest): boolean => {
  const cronSecret = req.headers['x-cron-secret'];
  return cronSecret === process.env.CRON_SECRET;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyCronSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logger.info('Starting daily summary processing');
    const supabase = createServerSupabaseClient<Database>({ req, res });

    // Get users who have daily summaries enabled
    const { data: users, error: usersError } = await supabase
      .from('notification_preferences')
      .select(`
        user_id,
        org_id,
        profiles!inner (
          email,
          display_name
        )
      `)
      .eq('daily_summary', true)
      .returns<UserWithProfile[]>();

    if (usersError) {
      throw usersError;
    }

    if (!users?.length) {
      logger.info('No users with daily summaries enabled');
      return res.status(200).json({ message: 'No users to process' });
    }

    // Process each user
    const results = await Promise.allSettled(
      users.map(async (user) => {
        try {
          // Get yesterday's ticket activity for this user
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Get tickets where the user is assigned or watching
          const { data: tickets, error: ticketsError } = await supabase
            .from('tickets')
            .select(`
              id,
              subject,
              status,
              priority,
              comments!inner (
                id,
                body,
                created_at,
                author:profiles!inner (
                  display_name
                )
              )
            `)
            .or(`assigned_agent_id.eq.${user.user_id},ticket_watchers.user_id.eq.${user.user_id}`)
            .gte('updated_at', yesterday.toISOString())
            .lt('updated_at', today.toISOString())
            .returns<TicketWithComments[]>();

          if (ticketsError) {
            throw ticketsError;
          }

          if (!tickets?.length) {
            logger.info('No ticket activity for user', { userId: user.user_id });
            return;
          }

          // Create summary HTML
          const summaryHtml = `
            <div>
              <h2>Your Daily Ticket Summary</h2>
              <p>Here's what happened in your tickets yesterday:</p>
              ${tickets.map(ticket => `
                <div style="margin-bottom: 20px;">
                  <h3>Ticket #${ticket.id}: ${ticket.subject}</h3>
                  <p>Status: ${ticket.status} | Priority: ${ticket.priority}</p>
                  ${ticket.comments?.length ? `
                    <p>New comments:</p>
                    <ul>
                      ${ticket.comments.map(comment => `
                        <li>
                          ${comment.author.display_name}: ${comment.body}
                        </li>
                      `).join('')}
                    </ul>
                  ` : ''}
                </div>
              `).join('')}
              <p>
                <a href="${process.env.NEXT_PUBLIC_BASE_URL}/tickets">View all tickets</a>
              </p>
            </div>
          `;

          // Create notification record
          const { data: notification, error: notificationError } = await supabase
            .from('notification_history')
            .insert({
              user_id: user.user_id,
              org_id: user.org_id,
              type: 'summary',
              status: 'pending',
              subject: 'Your Daily Ticket Summary',
              body: summaryHtml,
              metadata: {
                tickets: tickets.map(t => t.id),
                summary_date: yesterday.toISOString()
              }
            })
            .select()
            .single();

          if (notificationError) {
            throw notificationError;
          }

          // Send email
          await resend.emails.send({
            from: 'Zendesk <support@resend.dev>',
            to: user.profiles.email || '',
            subject: 'Your Daily Ticket Summary',
            html: summaryHtml,
          });

          // Update notification status
          await supabase
            .from('notification_history')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', notification.id);

          logger.info('Sent daily summary', { userId: user.user_id });
          return { success: true, userId: user.user_id };
        } catch (error) {
          logger.error('Error processing daily summary', {
            userId: user.user_id,
            error: error instanceof Error ? error.message : String(error)
          });
          return { success: false, userId: user.user_id, error };
        }
      })
    );

    // Count successes and failures
    const successes = results.filter(
      (result) => result.status === 'fulfilled' && result.value?.success
    ).length;
    const failures = results.filter(
      (result) => result.status === 'rejected' || !result.value?.success
    ).length;

    logger.info('Completed daily summary processing', {
      total: users.length,
      successes,
      failures,
    });

    return res.status(200).json({
      message: 'Processed daily summaries',
      total: users.length,
      successes,
      failures,
    });
  } catch (error) {
    logger.error('Error in daily summary processing', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 
