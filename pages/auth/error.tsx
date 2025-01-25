import AuthLayout from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AuthError() {
  return (
    <AuthLayout title="Authentication Error">
      <div className="space-y-4">
        <p className="text-center text-gray-600">
          There was an error during authentication. Please try again.
        </p>
        <div className="flex justify-center">
          <Button asChild>
            <Link href="/auth/signup">
              Back to Sign Up
            </Link>
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
} 