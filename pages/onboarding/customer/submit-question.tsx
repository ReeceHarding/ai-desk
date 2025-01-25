import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function SubmitQuestion() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !description.trim()) {
      setError('Please fill in both subject and description');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.info('[SUBMIT_QUESTION] Creating first ticket');

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        logger.error('[SUBMIT_QUESTION] Auth error:', { error: userError });
        setError('Could not verify your identity');
        return;
      }

      // Get user's profile to get org_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.org_id) {
        logger.error('[SUBMIT_QUESTION] Profile error:', { error: profileError });
        setError('Could not find your organization');
        return;
      }

      // Create the ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert([{
          subject: subject.trim(),
          description: description.trim(),
          customer_id: user.id,
          org_id: profile.org_id,
          status: 'open',
          priority: 'medium',
          metadata: {
            is_first_ticket: true,
            created_during_onboarding: true
          }
        }])
        .select()
        .single();

      if (ticketError) {
        logger.error('[SUBMIT_QUESTION] Ticket creation error:', { error: ticketError });
        setError('Failed to create your ticket');
        return;
      }

      logger.info('[SUBMIT_QUESTION] Ticket created successfully:', { 
        ticketId: ticket.id 
      });

      // Update profile to mark onboarding as complete
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          metadata: {
            onboarding_completed: true,
            onboarding_completed_at: new Date().toISOString()
          }
        })
        .eq('id', user.id);

      if (updateError) {
        logger.error('[SUBMIT_QUESTION] Profile update error:', { error: updateError });
        // Don't return, as the ticket was created successfully
      }

      // Redirect to tickets page
      router.push('/tickets');
    } catch (err) {
      logger.error('[SUBMIT_QUESTION] Unexpected error:', { error: err });
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          What's Your Question?
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          We'll get back to you as soon as possible
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
                Subject
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of your question"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <div className="mt-1">
                <textarea
                  id="description"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please provide more details about your question..."
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading || !subject.trim() || !description.trim()}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? 'Submitting...' : 'Submit Question'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 