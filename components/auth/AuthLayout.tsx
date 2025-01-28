import Link from 'next/link';
import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
}

export default function AuthLayout({ children, title }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-slate-50 font-sans antialiased">
      {/* Header */}
      <header className="w-full backdrop-blur-lg bg-white/80 border-b border-slate-200/50 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16 items-center">
            <Link 
              href="/" 
              className="text-base sm:text-lg lg:text-xl font-semibold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent transition-all duration-200 hover:from-slate-700 hover:to-slate-900"
            >
              Zendesk Clone
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              {title}
            </h2>
          </div>
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-6 sm:p-8 space-y-6 sm:space-y-8 transition-all duration-300 hover:shadow-md">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
} 