# Gestion Commerciale Desktop — app

Electron + React + TypeScript + Tailwind (tokens) + Apollo + Zustand. Pattern de build identique à `agent_tray` : `tsc` pour le process main (`electron/` → `dist-electron/`), Vite pour le renderer (`src/` → `dist/`), electron-builder pour les installeurs.

## Commandes
```bash
npm install
npm run dev        # vite :5174 + electron
npm run typecheck  # tsc renderer
npm run build      # main + renderer
npm run dist       # installeur plateforme courante (NSIS / DMG / AppImage+deb)
npm test           # tests unitaires (vitest)
npm run lint:ui    # garde-fou de la charte graphique
npm run test:ui    # parcours d'interface : build de production + GraphQL simulé (Playwright)
npm run test:e2e   # chaîne complète app → cloud → agent → base (dossier gc_test… uniquement)
```

### Parcours d'interface (`e2e/ui/`)
Construits sur le build **de production** (CSP comprise), servi par `vite preview`, avec un serveur GraphQL
simulé : aucun agent ni donnée réelle. Couvrent la navigation (écrans chargés à la demande), la session
expirée, l'appairage par fichier, le comptoir (Internet coupé, réponse perdue sans doublon même après
rechargement, Ctrl+Q, recherche hors ligne depuis le cache), les droits (PMP / marges masqués), la garde de
saisie, les erreurs de liste avec « Réessayer », les brouillons de pièces, le rapport de diagnostic, et un
audit d'accessibilité **axe-core** (WCAG 2 A / AA) sur le tableau de bord, les ventes, le comptoir, l'éditeur de
facture, le diagnostic et la connexion : aucune violation tolérée. Navigateur : celui de `playwright` (même version que
l'image CI `mcr.microsoft.com/playwright`) ; en local, `npx playwright install chromium` si besoin.

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
