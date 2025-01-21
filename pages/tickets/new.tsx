import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { Database } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';

type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

const priorityColors: Record<string, string> = {
  low: 'text-blue-500',
  medium: 'text-yellow-500',
  high: 'text-orange-500',
  urgent: 'text-red-500',
};

export default function NewTicket() {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('low');
  const [submitting, setSubmitting] = useState(false);

  const supabase = useSupabaseClient<Database>();
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    try {
      // First get the user's org_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!profile?.org_id) {
        throw new Error('Organization not found');
      }

      const { error } = await supabase.from('tickets').insert({
        subject,
        description,
        priority,
        status: 'open',
        customer_id: user.id,
        org_id: profile.org_id,
      });

      if (error) throw error;
      router.push('/tickets');
    } catch (error) {
      console.error('Error creating ticket:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      <div className="max-w-3xl mx-auto p-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/tickets')}
          className="mb-8 text-slate-400 hover:text-white group"
        >
          <ChevronLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-0.5" />
          Back to tickets
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6"
        >
          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-1">Create New Ticket</h1>
            <p className="text-slate-400">Submit a new support request. We'll get back to you as soon as possible.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-sm font-medium text-slate-300">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your request"
                required
                className="bg-slate-900/50 border-slate-700 focus:border-slate-600 focus:ring-slate-600 placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-slate-300">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description of your request"
                required
                className="min-h-[200px] bg-slate-900/50 border-slate-700 focus:border-slate-600 focus:ring-slate-600 placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority" className="text-sm font-medium text-slate-300">Priority</Label>
              <Select
                value={priority}
                onValueChange={(value: TicketPriority) => setPriority(value)}
              >
                <SelectTrigger 
                  id="priority" 
                  className="bg-slate-900/50 border-slate-700 focus:border-slate-600 focus:ring-slate-600"
                >
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {Object.keys(priorityColors).map((p) => (
                    <SelectItem 
                      key={p} 
                      value={p}
                      className={`${priorityColors[p]} hover:bg-slate-700/50 focus:bg-slate-700/50 cursor-pointer`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                disabled={submitting || !subject || !description}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white disabled:bg-slate-700 disabled:text-slate-400 transition-colors"
              >
                {submitting ? 'Creating...' : 'Create Ticket'}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
} 