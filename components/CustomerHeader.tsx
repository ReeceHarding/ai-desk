import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/router';

interface CustomerHeaderProps {
  title: string;
  backUrl?: string;
}

export default function CustomerHeader({ title, backUrl }: CustomerHeaderProps) {
  const router = useRouter();

  return (
    <header className="bg-white dark:bg-slate-800 shadow">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {backUrl && (
              <button
                onClick={() => router.push(backUrl)}
                className="inline-flex items-center text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </button>
            )}
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              {title}
            </h1>
          </div>
        </div>
      </div>
    </header>
  );
} 