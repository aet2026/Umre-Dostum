import { defineConfig } from 'vite';

// GitHub Pages repo adınla değiştir
export default defineConfig({
  base: '/Umre-Dostum/',
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
