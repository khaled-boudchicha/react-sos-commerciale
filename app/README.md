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
npm run test:electron  # application de bureau réelle (Electron) ; Linux sans écran : xvfb-run -a npm run test:electron
npm run test:e2e   # chaîne complète app → cloud → agent → base (dossier gc_test… uniquement)
```

### Parcours d'interface (`e2e/ui/`)
Construits sur le build **de production** (CSP comprise), servi par `vite preview`, avec un serveur GraphQL
simulé : aucun agent ni donnée réelle. Couvrent la navigation (écrans chargés à la demande), la session
expirée, l'appairage par fichier, le comptoir (Internet coupé, réponse perdue sans doublon même après
rechargement, Ctrl+Q, recherche hors ligne depuis le cache), les droits (PMP / marges masqués), la garde de
saisie, les erreurs de liste avec « Réessayer », les brouillons de pièces, le rapport de diagnostic, et un
audit d'accessibilité **axe-core** (WCAG 2 A / AA) sur 18 écrans (listes, éditeurs, comptoir, trésorerie,
statistiques, paramètres, connexion…) en thèmes **clair et sombre** : aucune violation tolérée. Navigateur : celui de `playwright` (même version que
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

### Application de bureau (`e2e/electron/`)
Lance le **vrai Electron** sur le build de production, dans un profil isolé (`XDG_CONFIG_HOME` temporaire) :
écran de connexion servi en `file://`, pont `window.gc` limité (pas de `require` / `process` dans l'écran),
stockage restreint aux clés autorisées, **session jamais écrite en clair** sur le disque, CSP de production
(requête `http` bloquée), lien externe ouvert dans le navigateur du système (intercepté pendant le test),
**rechargement automatique après un plantage de l'écran**, taille de fenêtre retrouvée au lancement suivant.
