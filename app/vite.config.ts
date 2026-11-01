import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Content-Security-Policy du renderer, injectée uniquement au build (le serveur
// de dev Vite a besoin de scripts inline pour le HMR). `file:` couvre le
// chargement Electron (loadFile). connect-src : HTTPS uniquement (le serveur cloud
// est toujours en https:, cf. store/session.ts) ; polices embarquées, aucun domaine tiers.
const CSP = [
  "default-src 'self'",
  "script-src 'self' file:",
  "style-src 'self' file: 'unsafe-inline'",
  "font-src 'self' file: data:",
  "img-src 'self' file: data: blob: https:",
  "connect-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'gc-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

// Paquet d'états : consommé depuis ses sources (un seul React : dedupe)
const src = (f: string) => fileURLToPath(new URL(`../packages/report/src/${f}`, import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react(), cspPlugin()],
  resolve: {
    alias: [
      { find: /^@softly\/report\/core$/, replacement: src('core.ts') },
      { find: /^@softly\/report$/, replacement: src('index.ts') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  server: { fs: { allow: ['..'] } },
  build: { outDir: 'dist' },
});
