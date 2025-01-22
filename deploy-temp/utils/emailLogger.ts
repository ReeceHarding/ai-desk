import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { EmailLogParams, EmailLog, EmailSearchParams } from '@/types/gmail';

const supabase = createClientComponentClient();

class EmailLogger {
  /**
   * Log an email message to the database
   */
  public static async logEmail(params: EmailLogParams): Promise<EmailLog> {
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .insert({
          ticket_id: params.ticketId,
          message_id: params.messageId,
          thread_id: params.threadId,
          direction: params.direction,
          snippet: params.snippet,
          subject: params.subject,
          from_address: params.fromAddress,
          to_address: params.toAddress,
          author_id: params.authorId,
          org_id: params.orgId,
          raw_content: params.rawContent,
          labels: params.labels || []
        })
        .select()
        .single();

      if (error) {
        console.error('Error logging email:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in logEmail:', error);
      throw error;
    }
  }

  /**
   * Get email history for a specific ticket
   */
  public static async getEmailHistory(ticketId: string): Promise<EmailLog[]> {
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching email history:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getEmailHistory:', error);
      throw error;
    }
  }

  /**
   * Search emails based on various parameters
   */
  public static async searchEmails(params: EmailSearchParams): Promise<EmailLog[]> {
    try {
      let query = supabase
        .from('email_logs')
        .select('*');

      if (params.ticketId) {
        query = query.eq('ticket_id', params.ticketId);
      }
      if (params.threadId) {
        query = query.eq('thread_id', params.threadId);
      }
      if (params.messageId) {
        query = query.eq('message_id', params.messageId);
      }
      if (params.orgId) {
        query = query.eq('org_id', params.orgId);
      }
      if (params.direction) {
        query = query.eq('direction', params.direction);
      }
      if (params.fromDate) {
        query = query.gte('timestamp', params.fromDate.toISOString());
      }
      if (params.toDate) {
        query = query.lte('timestamp', params.toDate.toISOString());
      }

      const { data, error } = await query.order('timestamp', { ascending: false });

      if (error) {
        console.error('Error searching emails:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in searchEmails:', error);
      throw error;
    }
  }

  /**
   * Get the latest email in a thread
   */
  public static async getLatestThreadEmail(threadId: string): Promise<EmailLog | null> {
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('thread_id', threadId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error fetching latest thread email:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getLatestThreadEmail:', error);
      throw error;
    }
  }
}

export { EmailLogger }; 