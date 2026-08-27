# Gestion Commerciale Desktop — app

Electron + React + TypeScript + Tailwind (tokens) + Apollo + Zustand. Pattern de build identique à `agent_tray` : `tsc` pour le process main (`electron/` → `dist-electron/`), Vite pour le renderer (`src/` → `dist/`), electron-builder pour les installeurs.

## Commandes
```bash
npm install
npm run dev        # vite :5174 + electron
npm run typecheck  # tsc renderer
npm run build      # main + renderer
npm run dist       # installeur plateforme courante (NSIS / DMG / AppImage+deb)
```

## Configuration
- Serveur cloud : `VITE_CLOUD_URL` (défaut `https://api.druxamed.com/graphql`).
- Session persistée par electron-store (`store:get/set/delete` via preload `window.gc`). TODO : chiffrement `safeStorage`.

## Structure
- `electron/main.ts` — fenêtre, IPC store
- `src/api/` — client Apollo (authLink dynamique + header `X-Druxamed-Dossier` + errorLink abonnement), documents gql
- `src/store/session.ts` — session (token, agent, dossier, utilisateur dossier), deviceId
- `src/screens/` — Login (3 étapes), Dashboard, placeholders
- `src/components/AppShell.tsx` — sidebar + topbar + statut agent (polling `myAgents`)
- `src/styles/tokens.css` — design tokens (source : `../design/tokens.css`, ne pas hardcoder de hex ailleurs)

Design & specs : voir `../docs/` et les maquettes `../design/maquettes.html`.
