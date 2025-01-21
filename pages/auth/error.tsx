import React from 'react';
import { useRouter } from 'next/router';
import AuthLayout from '../../components/auth/AuthLayout';
import Link from 'next/link';

export default function AuthError() {
  const router = useRouter();
  const { error } = router.query;

  return (
    <AuthLayout title="Authentication Error">
      <div className="text-center">
        <div className="mt-2">
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  {error || 'An error occurred during authentication'}
                </h3>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/auth/signin"
            className="text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
} 