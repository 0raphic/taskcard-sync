import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 开发时直连 PocketBase；生产由 server/index.mjs 同源托管
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8090',
      '/_': 'http://127.0.0.1:8090',
      '/ds-api': 'http://127.0.0.1:8088',
    },
  },
});
