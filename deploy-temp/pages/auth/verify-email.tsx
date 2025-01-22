import React from 'react';
import AuthLayout from '../../components/auth/AuthLayout';
import Link from 'next/link';

export default function VerifyEmail() {
  return (
    <AuthLayout title="Check your email">
      <div className="text-center">
        <div className="mt-2">
          <p className="text-sm text-gray-600">
            We sent you an email with a link to verify your account.
            Please check your inbox and follow the instructions.
          </p>
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