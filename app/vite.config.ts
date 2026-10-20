/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Railway mounts a cache volume at node_modules/.vite; keep Vite's cache elsewhere.
  cacheDir: '.vite-cache',
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
