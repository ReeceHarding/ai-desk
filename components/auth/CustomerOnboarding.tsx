import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

interface CustomerOnboardingProps {
  userId: string;
  email: string;
  name: string;
  onComplete: (question: string) => void;
}

export function CustomerOnboarding({ userId, email, name, onComplete }: CustomerOnboardingProps) {
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!question.trim()) {
      setError('Please enter your question');
      return;
    }
    onComplete(question);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Hi {name}, how can we help?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Tell us what you need assistance with and we'll connect you with the right support team.
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="question" className="block text-sm font-medium text-gray-700">
            Your Question
          </label>
          <Textarea
            id="question"
            required
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="mt-1 h-32"
            placeholder="Describe what you need help with..."
          />
        </div>

        <Button onClick={handleSubmit} className="w-full">
          Submit Question
        </Button>
      </div>
    </div>
  );
} 