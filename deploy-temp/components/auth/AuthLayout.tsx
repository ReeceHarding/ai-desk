import React, { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
}

export default function AuthLayout({ children, title }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-full max-w-md px-8 py-12">
        <div className="mb-8">
          {/* Logo */}
          <h1 className="text-4xl font-bold text-center mb-2">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
} 