import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Never add `define` entries or VITE_-prefixed variables for secrets: both are inlined into the
// public bundle. The Gemini key is read only by the api/ functions on the server.
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
