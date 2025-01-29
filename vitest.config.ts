import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'pages/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'utils/**/*.{ts,tsx}',
      ],
      exclude: [
        'pages/_app.tsx',
        'pages/_document.tsx',
      ],
    },
  },
}); 