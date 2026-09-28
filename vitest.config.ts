import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { buildInfoDefine } from './scripts/build-info.mjs';

export default defineConfig({
  plugins: [react()],
  define: buildInfoDefine,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/__tests__/**',
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/types/**',
      ],
    },
  },
});