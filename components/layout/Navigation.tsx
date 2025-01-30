import { BellIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';

export function Navigation() {
  const router = useRouter();

  const navigationItems = [
    {
      name: 'Notifications',
      href: '/notifications',
      icon: BellIcon,
      current: router.pathname === '/notifications',
    },
  ];

  return (
    // ... rest of the component ...
  );
} 