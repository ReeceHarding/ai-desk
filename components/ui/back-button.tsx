import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface BackButtonProps {
  fallbackUrl?: string;
  className?: string;
}

export function BackButton({ fallbackUrl = '/', className = '' }: BackButtonProps) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // More robust history check
    const checkHistory = () => {
      if (typeof window === 'undefined') return false;
      
      // Check if we have a previous entry in the history
      const hasHistory = window.history.state?.idx > 0;
      
      // Update state
      setCanGoBack(hasHistory);
    };

    // Check initially
    checkHistory();

    // Listen for route changes
    router.events.on('routeChangeComplete', checkHistory);
    
    return () => {
      router.events.off('routeChangeComplete', checkHistory);
    };
  }, [router]);

  const handleBack = () => {
    if (canGoBack) {
      router.back();
    } else {
      // If we can't go back, check if we're on a detail page
      const isDetailPage = router.pathname.includes('[id]');
      const listPath = router.pathname.split('/[')[0];
      
      // If we're on a detail page, go to the list view
      if (isDetailPage && listPath) {
        router.push(listPath);
      } else {
        router.push(fallbackUrl);
      }
    }
  };

  return (
    <button
      onClick={handleBack}
      className={`
        inline-flex items-center gap-2 px-2 py-1
        text-sm font-medium text-slate-600 hover:text-slate-900
        bg-white/50 hover:bg-white/80
        rounded-lg border border-slate-200/50
        transition-all duration-200
        active:scale-95
        ${className}
      `}
      aria-label="Go back"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>Back</span>
    </button>
  );
} 