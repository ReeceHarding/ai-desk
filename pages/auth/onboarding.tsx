import { AdminOnboarding } from '@/components/auth/AdminOnboarding';
import { AgentOnboarding } from '@/components/auth/AgentOnboarding';
import AuthLayout from '@/components/auth/AuthLayout';
import { BasicOnboarding } from '@/components/auth/BasicOnboarding';
import { CustomerOnboarding } from '@/components/auth/CustomerOnboarding';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

type OnboardingStep = 'basic' | 'customer' | 'agent' | 'admin';

export default function Onboarding() {
  const [step, setStep] = useState<OnboardingStep>('basic');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'customer' | 'agent' | 'admin'>('customer');
  const router = useRouter();
  const user = useUser();
  const supabase = useSupabaseClient();

  useEffect(() => {
    if (!user) {
      router.replace('/auth/signin');
      return;
    }

    // Fetch user's name from profile
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      if (!error && data?.display_name) {
        setName(data.display_name);
      }
    };

    fetchProfile();
  }, [user, router, supabase]);

  if (!user) {
    return null;
  }

  const handleBasicComplete = async (selectedRole: 'customer' | 'agent' | 'admin') => {
    try {
      // Update profile with role only since name is already set
      const { error } = await supabase
        .from('profiles')
        .update({
          role: selectedRole
        })
        .eq('id', user.id);

      if (error) throw error;

      setRole(selectedRole);
      setStep(selectedRole);
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  };

  const handleCustomerComplete = async (question: string) => {
    try {
      // Create ticket for customer's question
      const { error } = await supabase
        .from('tickets')
        .insert({
          subject: question.slice(0, 100), // First 100 chars as subject
          content: question,
          status: 'new',
          priority: 'medium',
          created_by: user.id,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      router.push('/dashboard');
    } catch (err) {
      console.error('Error creating ticket:', err);
    }
  };

  const handleAgentComplete = async () => {
    // Redirect to Gmail connection
    router.push('/onboarding/agent/connect-gmail');
  };

  const handleAdminComplete = async (orgName: string) => {
    try {
      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          created_by: user.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Update profile with organization
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          organization_id: org.id,
          role: 'admin'
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Redirect to Gmail connection
      router.push('/onboarding/admin/connect-gmail');
    } catch (err) {
      console.error('Error creating organization:', err);
    }
  };

  return (
    <AuthLayout title="Complete Your Profile">
      <div className="w-full max-w-md mx-auto">
        {step === 'basic' && (
          <BasicOnboarding
            userId={user.id}
            email={user.email || ''}
            onComplete={handleBasicComplete}
          />
        )}

        {step === 'customer' && (
          <CustomerOnboarding
            userId={user.id}
            email={user.email || ''}
            name={name}
            onComplete={handleCustomerComplete}
          />
        )}

        {step === 'agent' && (
          <AgentOnboarding
            userId={user.id}
            email={user.email || ''}
            onComplete={handleAgentComplete}
          />
        )}

        {step === 'admin' && (
          <AdminOnboarding
            userId={user.id}
            email={user.email || ''}
            name={name}
            onComplete={handleAdminComplete}
          />
        )}
      </div>
    </AuthLayout>
  );
} 