import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { Database } from '@/types/supabase';
import { 
  Button, 
  TextInput, 
  Textarea, 
  Select,
  Paper,
  Text,
  Group,
  Stepper,
  Box,
  FileInput,
  Loader,
  Alert,
} from '@mantine/core';
import { 
  IconAlertCircle,
  IconTicket,
  IconInfoCircle,
  IconPaperclip,
  IconSend,
} from '@tabler/icons-react';
import AppLayout from '@/components/layout/AppLayout';

type TicketPriority = Database['public']['Tables']['tickets']['Row']['priority'];

const CATEGORIES = [
  { value: 'technical', label: 'Technical Issue' },
  { value: 'billing', label: 'Billing Question' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'general', label: 'General Inquiry' },
];

export default function NewTicket() {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('low');
  const [category, setCategory] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  
  const supabase = useSupabaseClient<Database>();
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    const fetchOrgId = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching org_id:', error);
        setError('Failed to fetch organization details');
        return;
      }

      setOrgId(data.org_id);
    };

    fetchOrgId();
  }, [user, supabase]);

  const nextStep = () => {
    if (activeStep === 0 && (!subject.trim() || !category)) {
      setError('Please fill in all required fields');
      return;
    }
    if (activeStep === 1 && !description.trim()) {
      setError('Please provide a description');
      return;
    }
    setError(null);
    setActiveStep((current) => current + 1);
  };

  const prevStep = () => {
    setError(null);
    setActiveStep((current) => current - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !orgId) {
      setError('Please log in to create a ticket');
      return;
    }

    if (!subject.trim() || !description.trim() || !category) {
      setError('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('tickets')
        .insert([
          {
            subject,
            description,
            priority,
            category,
            customer_id: user.id,
            org_id: orgId,
            status: 'open',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Handle file uploads if any
      if (files.length > 0) {
        // TODO: Implement file upload logic
      }

      // Redirect to the ticket detail page
      router.push(`/tickets/${data.id}`);
    } catch (error) {
      console.error('Error creating ticket:', error);
      setError(error instanceof Error ? error.message : 'Failed to create ticket');
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <AppLayout>
        <Box className="min-h-screen bg-[#1C1C1C] flex items-center justify-center">
          <Text size="lg" className="text-gray-400">Please log in to create a ticket</Text>
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Box className="min-h-screen bg-[#1C1C1C] text-white p-8">
        <Paper className="max-w-3xl mx-auto bg-[#2C2C2C] p-8 border border-gray-800">
          <Text size="xl" fw="bold" className="mb-6">Create New Ticket</Text>

          {error && (
            <Alert 
              icon={<IconAlertCircle size={16} />} 
              title="Error" 
              color="red"
              variant="filled"
              className="mb-6"
            >
              {error}
            </Alert>
          )}

          <Stepper
            active={activeStep}
            onStepClick={setActiveStep}
            className="mb-8"
            styles={{
              root: {
                background: '#1C1C1C',
                padding: '1rem',
                borderRadius: '0.5rem',
              },
              separator: {
                backgroundColor: '#404040',
              },
              stepBody: {
                color: 'white',
              },
              stepLabel: {
                color: 'white',
              },
              stepDescription: {
                color: '#A0A0A0',
              },
            }}
          >
            <Stepper.Step
              label="Basic Info"
              description="Subject and category"
              icon={<IconTicket size={18} />}
            >
              <Box className="space-y-4 mt-6">
                <TextInput
                  required
                  label="Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                  styles={{
                    input: {
                      background: '#1C1C1C',
                      borderColor: '#404040',
                      color: 'white',
                    },
                    label: {
                      color: 'white',
                    },
                  }}
                />

                <Select
                  required
                  label="Category"
                  value={category}
                  onChange={(value) => value && setCategory(value)}
                  data={CATEGORIES}
                  placeholder="Select a category"
                  styles={{
                    input: {
                      background: '#1C1C1C',
                      borderColor: '#404040',
                      color: 'white',
                    },
                    label: {
                      color: 'white',
                    },
                    dropdown: {
                      background: '#1C1C1C',
                      borderColor: '#404040',
                    },
                    option: {
                      '&[data-selected]': {
                        background: '#404040',
                      },
                      '&:hover': {
                        background: '#404040',
                      },
                      color: 'white',
                    },
                  }}
                />
              </Box>
            </Stepper.Step>

            <Stepper.Step
              label="Details"
              description="Description and priority"
              icon={<IconInfoCircle size={18} />}
            >
              <Box className="space-y-4 mt-6">
                <Textarea
                  required
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed explanation of your issue"
                  minRows={6}
                  styles={{
                    input: {
                      background: '#1C1C1C',
                      borderColor: '#404040',
                      color: 'white',
                    },
                    label: {
                      color: 'white',
                    },
                  }}
                />

                <Select
                  label="Priority"
                  value={priority}
                  onChange={(value) => {
                    if (value) {
                      setPriority(value as TicketPriority);
                    }
                  }}
                  data={[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                    { value: 'urgent', label: 'Urgent' },
                  ]}
                  styles={{
                    input: {
                      background: '#1C1C1C',
                      borderColor: '#404040',
                      color: 'white',
                    },
                    label: {
                      color: 'white',
                    },
                    dropdown: {
                      background: '#1C1C1C',
                      borderColor: '#404040',
                    },
                    option: {
                      '&[data-selected]': {
                        background: '#404040',
                      },
                      '&:hover': {
                        background: '#404040',
                      },
                      color: 'white',
                    },
                  }}
                />
              </Box>
            </Stepper.Step>

            <Stepper.Step
              label="Attachments"
              description="Add files (optional)"
              icon={<IconPaperclip size={18} />}
            >
              <Box className="space-y-4 mt-6">
                <FileInput
                  label="Attachments"
                  placeholder="Upload files"
                  multiple
                  value={files}
                  onChange={setFiles}
                  accept="image/*, .pdf, .doc, .docx"
                  styles={{
                    input: {
                      background: '#1C1C1C',
                      borderColor: '#404040',
                      color: 'white',
                    },
                    label: {
                      color: 'white',
                    },
                  }}
                />
                <Text size="xs" className="text-gray-400">
                  Accepted file types: Images, PDF, DOC, DOCX. Max size: 10MB per file.
                </Text>
              </Box>
            </Stepper.Step>
          </Stepper>

          <Group justify="space-between" mt="xl">
            {activeStep > 0 && (
              <Button
                variant="default"
                onClick={prevStep}
                disabled={submitting}
                styles={{
                  root: {
                    background: '#1C1C1C',
                    borderColor: '#404040',
                    '&:hover': {
                      background: '#404040',
                    },
                  },
                }}
              >
                Back
              </Button>
            )}
            {activeStep === 2 ? (
              <Button
                onClick={handleSubmit}
                loading={submitting}
                leftSection={<IconSend size={16} />}
                className="bg-blue-600 hover:bg-blue-700 ml-auto"
              >
                Submit Ticket
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                className="bg-blue-600 hover:bg-blue-700 ml-auto"
              >
                Next Step
              </Button>
            )}
          </Group>
        </Paper>
      </Box>
    </AppLayout>
  );
} 