import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import process from 'node:process';

const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
const supportsNoWebstorage =
  nodeMajor! > 22 || (nodeMajor === 22 && nodeMinor! >= 4);

if (supportsNoWebstorage && !process.env.NODE_OPTIONS?.includes('--no-webstorage')) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --no-webstorage`.trim();
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Umre-Dostum/' : '/',
  build: {
    target: 'es2020',
    outDir: 'dist',
    minify: 'esbuild',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: false,
      minify: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: null,
        mode: 'development',
      },
    }),
  ],
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
        'src/compass.ts',
        'src/help-i18n.ts',
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