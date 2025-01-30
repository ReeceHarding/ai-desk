import { BackButton } from './ui/back-button';

interface CustomerHeaderProps {
  title: string;
  backUrl?: string;
}

export default function CustomerHeader({ title, backUrl }: CustomerHeaderProps) {
  return (
    <header className="bg-white dark:bg-slate-800 shadow">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {backUrl && <BackButton fallbackUrl={backUrl} />}
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              {title}
            </h1>
          </div>
        </div>
      </div>
    </header>
  );
} 