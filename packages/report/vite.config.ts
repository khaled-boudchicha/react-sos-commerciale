import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Bibliothèque : ES modules, React en dépendance « peer » (jamais embarqué).
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: { index: resolve(__dirname, 'src/index.ts'), core: resolve(__dirname, 'src/core.ts') },
      formats: ['es'],
    },
    rollupOptions: { external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'] },
    sourcemap: true,
    emptyOutDir: true,
  },
  test: { include: ['test/**/*.test.ts'] },
});
