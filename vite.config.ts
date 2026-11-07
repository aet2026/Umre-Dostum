import { defineConfig } from 'vitest/config';
import process from 'node:process';

if (!process.env.NODE_OPTIONS?.includes('--no-webstorage')) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --no-webstorage`.trim();
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Umre-Dostum/' : '/',
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/doors.ts',
        'src/guide.ts',
        'src/speech.ts',
        'src/storage.ts',
        'src/trail.ts',
        'src/ui.ts',
        'src/main.ts',
      ],
      exclude: ['src/**/*.test.ts', 'src/test/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});