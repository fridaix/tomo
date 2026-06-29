import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.indexOf('/node_modules/react/') >= 0 ||
            id.indexOf('/node_modules/react-dom/') >= 0 ||
            id.indexOf('/node_modules/scheduler/') >= 0
          ) {
            return 'react';
          }

          if (
            id.indexOf('/node_modules/@tiptap/') >= 0 ||
            id.indexOf('/node_modules/prosemirror-') >= 0 ||
            id.indexOf('/node_modules/@floating-ui/') >= 0 ||
            id.indexOf('/node_modules/marked/') >= 0
          ) {
            return 'editor';
          }

          if (id.indexOf('/node_modules/') >= 0) {
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
