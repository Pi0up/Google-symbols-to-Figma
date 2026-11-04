import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig({
  plugins: [viteSingleFile()],
  root: path.resolve(__dirname, 'src/ui'),
  build: {
    target: 'es2020',
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/ui/index.html'),
    },
  },
});
