import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  // Relative asset paths so the built index.html works from file:// and any sub-path.
  base: './',
  // viteSingleFile inlines all JS + CSS into one index.html (an inline module,
  // which executes from file://). The dev server keeps the proxy below unused —
  // chat is fully serverless (Trystero) and contacts no CipherWave backend.
  plugins: [svelte(), viteSingleFile()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 17612,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    outDir: '../../www',
    emptyOutDir: true,
  },
});
