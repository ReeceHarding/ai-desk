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
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  const handleBasicComplete = async (selectedRole: 'customer' | 'agent' | 'admin', fullName: string) => {
    try {
      // Update profile with name and role
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: fullName,
          role: selectedRole
        })
        .eq('id', user.id);

      if (error) throw error;

      setName(fullName);
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
    router.push('/dashboard');
  };

  const handleAdminComplete = async (orgName: string) => {
    try {
      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          email: user.email,
          created_by: user.id,
          created_at: new Date().toISOString(),
          owner_id: user.id
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Associate user with organization
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: org.id,
          user_id: user.id,
          role: 'admin',
          created_at: new Date().toISOString()
        });

      if (memberError) throw memberError;

      // Update profile with org_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ org_id: org.id })
        .eq('id', user.id);

      if (profileError) throw profileError;

      router.push('/dashboard');
    } catch (err) {
      console.error('Error setting up organization:', err);
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