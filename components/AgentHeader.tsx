import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function AgentHeader() {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/agent/inbox" className="text-xl font-semibold text-gray-900">
              Agent Dashboard
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-4">
            <Link
              href="/agent/inbox"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                router.pathname === '/agent/inbox'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Inbox
            </Link>
            <Link
              href="/agent/analytics"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                router.pathname === '/agent/analytics'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Analytics
            </Link>
            <button
              onClick={handleSignOut}
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              Sign Out
            </button>
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden pb-3">
            <div className="space-y-1">
              <Link
                href="/agent/inbox"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  router.pathname === '/agent/inbox'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Inbox
              </Link>
              <Link
                href="/agent/analytics"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  router.pathname === '/agent/analytics'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Analytics
              </Link>
              <button
                onClick={handleSignOut}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-500 hover:text-gray-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
} 