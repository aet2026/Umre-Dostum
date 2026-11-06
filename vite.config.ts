import { defineConfig } from 'vite';

// GitHub Pages repo adınla değiştir
export default defineConfig({
  base: '/kapi-rehberi/',
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});