import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Database } from '@/types/supabase';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import debounce from 'lodash/debounce';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ConnectionStatusProps {
  orgId?: string;
  profileId?: string;
}

export function ConnectionStatus({ orgId, profileId }: ConnectionStatusProps) {
  const [status, setStatus] = useState<'active' | 'expired' | 'failed' | 'pending' | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useSupabaseClient<Database>();
  const { toast } = useToast();
  const subscriptionRef = useRef<any>(null);

  const fetchStatus = useCallback(async () => {
    if (!orgId && !profileId) return;

    try {
      setLoading(true);
      const table = orgId ? 'organizations' : 'profiles';
      const id = orgId || profileId;

      const { data, error } = await supabase
        .from(table)
        .select('gmail_watch_status, gmail_watch_expiration')
        .eq('id', id)
        .single();

      if (error) throw error;

      setStatus(data.gmail_watch_status);
    } catch (error) {
      console.error('Failed to fetch Gmail status:', error);
      toast({
        title: 'Error',
        description: 'Failed to check Gmail connection status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [orgId, profileId, supabase, toast]);

  // Debounced version of fetchStatus
  const debouncedFetchStatus = useCallback(
    debounce(fetchStatus, 5000, { leading: true, trailing: true }),
    [fetchStatus]
  );

  useEffect(() => {
    if (!orgId && !profileId) return;

    // Initial fetch
    debouncedFetchStatus();

    // Set up real-time subscription
    const table = orgId ? 'organizations' : 'profiles';
    subscriptionRef.current = supabase
      .channel('gmail-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table,
          filter: `id=eq.${orgId || profileId}`,
        },
        (payload) => {
          if (payload.new.gmail_watch_status !== status) {
            setStatus(payload.new.gmail_watch_status);
          }
        }
      )
      .subscribe();

    return () => {
      debouncedFetchStatus.cancel();
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [orgId, profileId, supabase, status, debouncedFetchStatus]);

  const handleReconnect = async () => {
    // Redirect to Gmail OAuth flow
    window.location.href = `/api/auth/gmail/connect?${
      orgId ? `orgId=${orgId}` : `profileId=${profileId}`
    }`;
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-gray-500">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>Checking Gmail connection...</span>
      </div>
    );
  }

  if (!status || status === 'failed') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Gmail Connection Error</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            Your Gmail connection is not working properly. This may affect email notifications and responses.
          </p>
          <Button onClick={handleReconnect} variant="outline" size="sm">
            Reconnect Gmail
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (status === 'expired') {
    return (
      <Alert variant="warning">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Gmail Connection Expired</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            Your Gmail connection has expired. Please reconnect to continue receiving email notifications.
          </p>
          <Button onClick={handleReconnect} variant="outline" size="sm">
            Reconnect Gmail
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (status === 'pending') {
    return (
      <Alert>
        <RefreshCw className="h-4 w-4 animate-spin" />
        <AlertTitle>Gmail Connection Pending</AlertTitle>
        <AlertDescription>
          Setting up Gmail connection. This may take a few moments...
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="success">
      <CheckCircle2 className="h-4 w-4" />
      <AlertTitle>Gmail Connected</AlertTitle>
      <AlertDescription>
        Your Gmail account is connected and working properly.
      </AlertDescription>
    </Alert>
  );
} 