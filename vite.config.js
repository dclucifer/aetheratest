// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  // Serve/copy everything under ./assets as static files so runtime paths like
  // assets/images/logo-*.png resolve both in dev and production builds.
  publicDir: 'assets',
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
