import { logger } from '@/utils/logger';
import { MantineProvider } from '@mantine/core';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { ThreadPanelProvider } from '../contexts/ThreadPanelContext';
import '../styles/globals.css';

export default function App({ Component, pageProps, router }: AppProps) {
  const [supabaseClient] = useState(() => createPagesBrowserClient());

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      logger.info(`Page changed to: ${url}`, {
        previousPath: router.asPath,
        query: router.query
      });
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <MantineProvider>
        <SessionContextProvider
          supabaseClient={supabaseClient}
          initialSession={pageProps.initialSession}
        >
          <ThreadPanelProvider>
            <div className="min-h-screen bg-white text-gray-900 antialiased">
              <Component {...pageProps} />
            </div>
          </ThreadPanelProvider>
        </SessionContextProvider>
      </MantineProvider>
    </>
  );
} 