import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Same-origin /api in development, exactly like the Netlify proxy in production.
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: false } },
  },
  preview: {
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: false } },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
