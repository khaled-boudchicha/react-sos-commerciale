# Déploiement — lot « cycle des pièces, droits, caisse, stock, timbre » (septembre 2026)

Procédure pas à pas pour mettre en production les évolutions des dépôts :

| Dépôt | Rôle | Livraison |
|---|---|---|
| `sos-cloud-server` | proxy GraphQL ↔ gRPC | VPS (`update.sh`, Docker) |
| `sos-agent` | agent sur le PC de la pharmacie | embarqué dans l'installeur **agent_tray** |
| `agent_tray` | application tray (installe et lance l'agent) | installeur Windows / macOS |
| `gestion-commerciale-desktop` | application desktop | CI GitLab sur tag `vX.Y.Z` |
| `app_mobile_client` | application mobile | EAS (hors de ce guide) |

**Aucune migration de schéma** : ni la base d'administration du cloud ni les bases des dossiers
(MariaDB des pharmacies) ne changent de structure. Les nouvelles fonctions utilisent des colonnes
déjà présentes (Delphi). Un retour arrière ne demande donc aucune opération sur les données.

## 0. Ordre et compatibilité

Déployer **dans cet ordre** ; chaque étape reste compatible avec les versions encore en place :

1. **Cloud** — compatible avec les anciens agents et les anciennes applications : les nouveaux
   champs ne servent qu'à la nouvelle app, le jeton `X-Druxamed-User` est simplement relayé (un
   ancien agent l'ignore). Il corrige aussi `refreshToken` pour tous les clients.
2. **Agents** (nouvel installeur du tray) — compatibles avec l'ancienne app desktop et l'app mobile
   actuelle : sans jeton utilisateur, les commandes historiques restent acceptées (mode non strict).
3. **App desktop** — exige cloud **et** agent à jour (nouvelles commandes, jeton utilisateur).
4. **App mobile** avec envoi du jeton utilisateur.
5. **Plus tard** : mode strict sur chaque agent (`exiger_jeton_utilisateur: true`), une fois tous
   les postes desktop et mobiles mis à jour (voir § 5).

## 1. Préparation (la veille)

- [ ] Commits poussés : `git push` sur `main` dans les 4 dépôts (le mobile : après intégration du
      travail en cours, voir § 4).
- [ ] Variables CI du projet desktop (GitLab → Settings → CI/CD → Variables) :
  - `GC_UPDATE_URL` : URL **publique** du dossier des mises à jour (voir encadré ci-dessous).
  - Signature (facultatif mais recommandé) : `CSC_LINK`, `CSC_KEY_PASSWORD` ; macOS :
    `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` (+ `build.mac.notarize` dans
    `app/package.json`).
- [ ] Sauvegarde des bases des dossiers sur chaque PC pharmacie (le tray / l'outil habituel) — par
      précaution, même sans migration.

> **Mises à jour automatiques — hébergement sur le VPS.** Caddy sert le dossier
> `sos-cloud-server/mises-a-jour/` à l'adresse `https://<domaine>/mises-a-jour/` (sans
> authentification, `latest*.yml` non mis en cache). Mise en place, une fois :
>
> 1. Sur le VPS : `mkdir -p ~/sos-cloud-server/mises-a-jour/gestion-commerciale`, puis créer une
>    clé SSH dédiée (`ssh-keygen -t ed25519 -f deploy_gc -N ''`) et ajouter `deploy_gc.pub` à
>    `~/.ssh/authorized_keys` de l'utilisateur de déploiement (idéalement restreint à rsync).
> 2. Variables CI du projet desktop :
>    - `GC_UPDATE_URL` = `https://api.druxamed.com/mises-a-jour/gestion-commerciale`
>    - `GC_DEPLOY_HOST`, `GC_DEPLOY_USER`, `GC_DEPLOY_PATH` (= chemin absolu du dossier ci-dessus)
>    - `GC_DEPLOY_SSH_KEY` (type **File**, contenu de `deploy_gc`)
>    - `GC_DEPLOY_KNOWN_HOSTS` (sortie de `ssh-keyscan <vps>`)
> 3. Le job `publish` dépose les installeurs puis, en dernier, les manifestes `latest*.yml`.
>
> Sans `GC_UPDATE_URL`, les builds fonctionnent mais la mise à jour automatique reste désactivée
> (Paramètres → Application l'indique).

## 2. Cloud (VPS)

```bash
ssh <vps>
cd sos-cloud-server
./update.sh          # sauvegarde sos_admin → git pull → rebuild → contrôle de santé
mkdir -p mises-a-jour/gestion-commerciale   # dossier servi par Caddy (monté en lecture seule)
```

Vérifications :

- [ ] `curl -s https://api.druxamed.com/health` répond.
- [ ] En-tête CORS : `curl -si -X OPTIONS https://api.druxamed.com/graphql -H 'Origin: app://x'
      -H 'Access-Control-Request-Headers: x-druxamed-user' | grep -i allow-headers` contient
      `X-Druxamed-User`.
- [ ] Une app mobile **actuelle** fonctionne toujours (connexion, liste des ventes).
- [ ] `curl -sI https://api.druxamed.com/mises-a-jour/gestion-commerciale/latest.yml` répond 200
      avec `Cache-Control: no-cache` (après la première publication).

Retour arrière : `git checkout <commit précédent> && docker compose -f docker-compose.prod.yml up -d --build`.

## 3. Agents (installeur du tray)

Sur un poste de build (Windows pour l'installeur Windows) :

```bash
cd agent_tray
npm run dist        # bundle:agent (copie sos-agent compilé) + build + electron-builder
```

Puis, sur chaque PC pharmacie : installer le nouveau tray (il remplace l'agent), vérifier dans le
tray « Cloud connecté » et le badge gRPC.

Vérifications (par PC) :

- [ ] Le tray affiche « Copier le code d'appairage (app desktop) ».
- [ ] Le desktop Delphi fonctionne comme avant (l'agent ne modifie pas le schéma).
- [ ] L'app mobile actuelle crée toujours une vente (mode non strict).

Retour arrière : réinstaller l'installeur précédent du tray.

> Réglage optionnel dans `agent.config.json` : `"exiger_jeton_utilisateur": false` (défaut). Ne
> pas l'activer à ce stade.

## 4. Applications

### Desktop

```bash
cd gestion-commerciale-desktop
git tag v0.2.0 && git push origin v0.2.0
```

La CI construit Windows (NSIS) et Linux (AppImage, deb) ; macOS via le job manuel `build:macos`
(runner macOS). Distribuer les installeurs ; les postes déjà équipés d'une version avec
auto-update se mettront à jour seuls (téléchargement en fond, installation à la fermeture).

Premier démarrage après mise à jour : les sessions ouvertes avant cette version **reprennent au
choix du dossier** (pour obtenir le jeton utilisateur) — pas besoin de ressaisir le compte cloud.

### Mobile

Les modifications (mémorisation et envoi du jeton `X-Druxamed-User`) sont dans l'arbre de travail
de `app_mobile_client` (`lib/storage.ts`, `lib/store.ts`, `lib/apollo.ts`,
`app/(startup)/session.tsx`, `app/(app)/select-dossier-user.tsx`), à commiter avec le travail en
cours puis publier via EAS. Les utilisateurs mémorisés avant cette version ressaisissent **une
fois** leur mot de passe (pour obtenir leur jeton).

## 5. Recette après déploiement (sur un poste desktop)

Sur un **dossier de test** de préférence (copie de base) :

- [ ] Connexion (compte cloud ou code d'appairage) → dossier → utilisateur.
- [ ] Utilisateur restreint : menus masqués, écran interdit → « Accès refusé ».
- [ ] BC → BL → modification → encaissement partiel → « Facturer des BL » → avoir ; stock et
      soldes cohérents ; suppression en cascade.
- [ ] Bon de comptoir en espèces > 300 DA : ligne « Droit de timbre » (ex. 595 DA → 6 DA).
- [ ] Trésorerie : détail d'un mouvement, annulation, arrêté de caisse + impression.
- [ ] Mouvements de stock : bon d'entrée, transfert, suppression.
- [ ] Recouvrement, État 104 (impression paysage à contrôler visuellement), péremption.
- [ ] Paramètres → Application : version affichée, état des mises à jour.

Automatisé (sur une copie de dossier uniquement) :

```bash
# Agent : 101 vérifications, base gc_test_* (voir en-tête du script)
cd sos-agent && npm run build && node test/integration/cycle-pieces.itest.js
# Chaîne complète cloud → agent → base (refuse un dossier qui ne commence pas par gc_test)
cd gestion-commerciale-desktop/app && GC_CLOUD_URL=… GC_API_KEY=… GC_AGENT_ID=… GC_DOSSIER=gc_test_… npm run test:e2e
```

## 6. Activer le mode strict (plus tard)

Quand **tous** les postes desktop et mobiles sont à jour, sur chaque PC pharmacie :

```json
// agent.config.json
"exiger_jeton_utilisateur": true
```

(ou variable d'environnement `SOS_EXIGER_JETON_UTILISATEUR=1`), puis redémarrer l'agent depuis le
tray. Toute écriture sans jeton utilisateur valide est alors refusée : les droits Delphi sont
appliqués côté serveur pour tous les clients.

## 7. Points connus

- Transfert inter-dépôts : trace documentaire (les lots ne portent pas de dépôt dans ce schéma).
- PMP non recalculé à la modification d'un achat (volontaire, parité de valorisation avec Delphi).
- Timbre : appliqué d'office aux nouvelles factures / comptoirs en espèces ; les pièces Delphi
  existantes sans timbre n'en reçoivent pas lorsqu'on les modifie.
