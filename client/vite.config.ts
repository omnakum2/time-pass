import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      shared: path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    host: true,   // listen on 0.0.0.0 so other devices on the network can connect
    proxy: {
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        rewrite: (p) => p.replace(/^\/ws/, ''),
      },
    },
  },
});
