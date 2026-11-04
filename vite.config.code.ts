import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/code/main.ts'),
      name: 'code',
      formats: ['iife'],
      fileName: () => 'code.js',
    },
  },
});
