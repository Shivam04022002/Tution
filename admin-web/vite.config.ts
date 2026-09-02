import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The console is served from https://hometuitionapp.com/admin/ rather than a
  // subdomain, so every emitted asset URL must carry that prefix. React Router
  // reads the same value through `import.meta.env.BASE_URL` (see App.tsx), so
  // changing it here is enough to move the console to another path.
  base: '/admin/',
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
