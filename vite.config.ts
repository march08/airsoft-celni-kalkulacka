import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  ssr: {
    noExternal: ['@tanstack/react-query'],
  },
  test: {
    environment: 'node',
  },
});
