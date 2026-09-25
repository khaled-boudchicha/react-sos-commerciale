import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Content-Security-Policy du renderer, injectée uniquement au build (le serveur
// de dev Vite a besoin de scripts inline pour le HMR). `file:` couvre le
// chargement Electron (loadFile) ; connect-src reste ouvert car l'URL du
// serveur cloud est configurable par l'utilisateur.
const CSP = [
  "default-src 'self'",
  "script-src 'self' file:",
  "style-src 'self' file: 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' file: data: https://fonts.gstatic.com",
  "img-src 'self' file: data: blob: https:",
  "connect-src 'self' https: http:",
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

export default defineConfig({
  base: './',
  plugins: [react(), cspPlugin()],
  build: { outDir: 'dist' },
});
