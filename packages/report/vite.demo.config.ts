import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Bac à sable : application minimale, SANS Tailwind, qui consomme le paquet comme le ferait un projet tiers.
export default defineConfig({ root: 'demo', plugins: [react()], server: { port: 5188 }, build: { outDir: '../demo-dist', emptyOutDir: true } });
