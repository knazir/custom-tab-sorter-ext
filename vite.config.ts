import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/ui/popup/index.html'),
        options: resolve(__dirname, 'src/ui/options/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        extractor: resolve(__dirname, 'src/content/extractor.ts'),
        contextTarget: resolve(__dirname, 'src/content/context-target.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background/index.js';
          }
          if (chunkInfo.name === 'extractor') {
            return 'content/extractor.js';
          }
          if (chunkInfo.name === 'contextTarget') {
            return 'content/context-target.js';
          }
          return '[name]/[name].js';
        },
        chunkFileNames: 'shared/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return '[name][extname]';
          }
          return 'assets/[name][extname]';
        }
      }
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      format: {
        comments: false
      }
    }
  }
});