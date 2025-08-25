// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:   resolve(__dirname, 'index.html'),
        manual: resolve(__dirname, 'manual.html'), // ← tambah ini
      },
    },
    sourcemap: false
  },
  server: {
    port: 5175,
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true, secure: false }
    }
  }
});
