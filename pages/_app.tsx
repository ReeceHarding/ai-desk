import { MantineProvider } from '@mantine/core';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import type { AppProps } from 'next/app';
import { useState } from 'react';
import { ThreadPanelProvider } from '../contexts/ThreadPanelContext';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  const [supabaseClient] = useState(() => createPagesBrowserClient());

  return (
    <MantineProvider>
      <SessionContextProvider
        supabaseClient={supabaseClient}
        initialSession={pageProps.initialSession}
      >
        <ThreadPanelProvider>
          <Component {...pageProps} />
        </ThreadPanelProvider>
      </SessionContextProvider>
    </MantineProvider>
  );
} 