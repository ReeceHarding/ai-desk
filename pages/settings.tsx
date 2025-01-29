import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function SettingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/profile/settings');
  }, [router]);

  return null;
} 