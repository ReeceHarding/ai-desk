import { Button } from '@/components/ui/button';
import { useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function AgentInbox() {
  const router = useRouter();
  const user = useUser();

  useEffect(() => {
    if (!user) {
      router.push('/auth/signin');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Agent Inbox</h1>
        <Button
          onClick={() => router.push('/tickets/new')}
          className="bg-blue-500 hover:bg-blue-600 text-white"
        >
          Create New Ticket
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="space-y-4">
          {/* Placeholder for ticket list */}
          <p className="text-gray-500 text-center py-8">
            No tickets in your inbox yet
          </p>
        </div>
      </div>
    </div>
  );
} 
