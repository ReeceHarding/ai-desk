import { EmailLogParams, EmailSearchParams } from '@/types/gmail';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

export async function logEmail(params: EmailLogParams) {
  const { error } = await supabase
    .from('email_logs')
    .insert({
      message_id: params.messageId,
      thread_id: params.threadId,
      org_id: params.orgId,
      type: params.type,
      status: params.status,
      error: params.error,
      metadata: params.metadata
    });

  if (error) {
    console.error('Error logging email:', error);
    throw error;
  }
}

export async function searchEmailLogs(params: EmailSearchParams) {
  let query = supabase.from('email_logs').select('*');

  if (params.orgId) {
    query = query.eq('org_id', params.orgId);
  }

  if (params.threadId) {
    query = query.eq('thread_id', params.threadId);
  }

  if (params.messageId) {
    query = query.eq('message_id', params.messageId);
  }

  if (params.type) {
    query = query.eq('type', params.type);
  }

  if (params.status) {
    query = query.eq('status', params.status);
  }

  if (params.fromDate) {
    query = query.gte('created_at', params.fromDate.toISOString());
  }

  if (params.toDate) {
    query = query.lte('created_at', params.toDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error searching email logs:', error);
    throw error;
  }

  return data;
}

export async function getLatestThreadEmail(threadId: string) {
  const { data, error } = await supabase
    .from('email_logs')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error getting latest thread email:', error);
    throw error;
  }

  return data;
}
