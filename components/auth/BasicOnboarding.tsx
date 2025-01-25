import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useState } from 'react';

interface BasicOnboardingProps {
  userId: string;
  email: string;
  onComplete: (role: 'customer' | 'agent' | 'admin', name: string) => void;
}

export function BasicOnboarding({ userId, email, onComplete }: BasicOnboardingProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'customer' | 'agent' | 'admin'>('customer');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    onComplete(role, name);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Welcome to Gauntlet</h2>
        <p className="mt-1 text-sm text-gray-500">
          Let's get you set up. First, tell us a bit about yourself.
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Full Name
          </label>
          <Input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1"
            placeholder="Enter your full name"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">I am a...</Label>
          <RadioGroup
            value={role}
            onValueChange={(value: 'customer' | 'agent' | 'admin') => setRole(value)}
            className="grid grid-cols-1 gap-4 mt-2"
          >
            <div className="flex items-center space-x-2 rounded-lg border p-4">
              <RadioGroupItem value="customer" id="customer" />
              <Label htmlFor="customer" className="flex-1">
                <div className="font-medium">Customer</div>
                <div className="text-sm text-gray-500">I need help with something</div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 rounded-lg border p-4">
              <RadioGroupItem value="agent" id="agent" />
              <Label htmlFor="agent" className="flex-1">
                <div className="font-medium">Support Agent</div>
                <div className="text-sm text-gray-500">I help customers with their questions</div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 rounded-lg border p-4">
              <RadioGroupItem value="admin" id="admin" />
              <Label htmlFor="admin" className="flex-1">
                <div className="font-medium">Admin</div>
                <div className="text-sm text-gray-500">I manage an organization's support team</div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <Button onClick={handleSubmit} className="w-full">
          Continue
        </Button>
      </div>
    </div>
  );
} 