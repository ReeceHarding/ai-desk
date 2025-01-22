import React from 'react';
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { MantineProvider } from '@mantine/core';
import { useState } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  const [supabaseClient] = useState(() => createPagesBrowserClient());

  return (
    <MantineProvider>
      <SessionContextProvider supabaseClient={supabaseClient}>
        <Component {...pageProps} />
      </SessionContextProvider>
    </MantineProvider>
  );
} 