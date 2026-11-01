# Déploiement — guide (0.2.0, mis à jour pour 0.3.x en novembre 2026)

> **Version 0.3.x** : voir l'encadré « Ce qui change avec 0.3.x » ci-dessous avant de déployer. Le reste du guide
> (mise en service, ordre de déploiement, recette, mode strict) reste valable.

Première mise en production de l'app desktop. Elle regroupe : cycle des pièces, droits, caisse,
stock, timbre (25/09) ; grille de données avec tri / filtres / groupes **côté serveur**, fiche de
stock, paiement immédiat des achats, correctifs du crédit initial et du schéma (26/09).

> **À déployer rapidement même sans l'app desktop : l'agent.** Il corrige deux défauts qui
> touchent les installations actuelles : la mutation « crédit initial client » effaçait les
> paiements du crédit, et l'agent s'arrêtait lors d'une reconnexion au cloud.

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

## Ce qui change avec 0.3.x (app desktop, novembre 2026)

Aucune modification du cloud ni de l'agent n'est **requise** : 0.3.x fonctionne avec les versions déployées en 0.2.0.
Les demandes aux équipes agent / cloud sont suivies dans [12-DEMANDES-AGENT-CLOUD.md](12-DEMANDES-AGENT-CLOUD.md).

| Sujet | Conséquence pour le déploiement |
|---|---|
| **Electron 44** (au lieu de 31) | Chromium à jour des correctifs de sécurité. Windows 7 / 8 / 8.1 ne sont plus pris en charge (déjà le cas depuis Electron 23). |
| **Session chiffrée sur le poste** (DPAPI sous Windows, Trousseau sous macOS, trousseau du bureau sous Linux) | Jamais de repli en clair. Sous **Linux sans trousseau** (pas de gnome-keyring / KWallet), la session n'est pas mémorisée : l'utilisateur se reconnecte à chaque lancement. Diagnostic › « Session sur ce poste » l’indique. |
| **URL du cloud en `https://` uniquement** | Une URL `http://` est refusée en production (seul `http://localhost` est admis en développement). La politique de sécurité du contenu (CSP) bloque aussi toute requête `http:`. |
| **Une seule instance** de l'application par poste | Un second lancement ramène la fenêtre existante au premier plan. |
| **Cache hors ligne** (IndexedDB du poste) | Référentiels 7 jours, articles consultés 24 heures ; vidé à la déconnexion. Hors ligne, l'encaissement du comptoir est suspendu (pas de vente sans serveur). |
| **Brouillons** des factures et achats en cours (7 jours, par dossier et par utilisateur) | Repris après une fermeture ou une coupure ; effacés à l'enregistrement. |
| **Journal local des erreurs** + Diagnostic › « Copier le rapport » | Le support demande ce rapport (il ne contient aucun jeton ni mot de passe). |
| **Tests automatisés** : `npm run test:ui` (parcours d'interface), `npm run test:electron` (application de bureau réelle, `xvfb-run -a` sous Linux) | Jobs GitLab `ui` et `electron`, **non bloquants** au départ : les rendre bloquants après un premier passage vert sur GitLab. |

À vérifier **sur Windows** avant la diffusion (non testable dans l'environnement de développement) : installeur NSIS,
impression silencieuse des tickets sur l'imprimante thermique, mémorisation chiffrée de la session (DPAPI).

## Mettre en service un nouveau client (procédure courante)

1. **Dans l'app d'administration** (Clients → « + ») : nom, identifiant (proposé), téléphone,
   abonnement (annuel par défaut). Le mot de passe est généré si le champ est vide.
2. **Fiche d'accès** (affichée après la création) : identifiant, mot de passe — affiché une seule
   fois — et liens de téléchargement ; « Partager » l'envoie par WhatsApp / SMS.
3. **Sur le PC de la base** : installer l'agent (`…/mises-a-jour/agent/softly-agent-setup.exe`),
   se connecter avec l'identifiant et le mot de passe du client. L'agent est enregistré et rattaché
   au compte ; il apparaît dans Agents (en ligne). Renseigner la base locale si demandé.
4. **Sur le PC portable** : application PC (`…/gestion-commerciale/gestion-commerciale-setup.exe`) ;
   **sur le téléphone** : application mobile (`…/mobile/druxamed.apk`). Connexion avec les mêmes
   identifiants, puis choix du dossier et de l'utilisateur de la gestion commerciale.
5. **Employés** : fiche du client → « Ajouter un compte (employé) sur cet agent ». Chaque personne a
   son compte ; un compte rattaché à plusieurs agents bascule entre eux (« Changer d'agent »).
6. **Renouvellement** : fiche du client → « Renouveler l'abonnement » (la nouvelle période suit
   l'échéance en cours, sans perte de jours ; les comptes de ses agents sont alignés).
   **Impayé** : « Bloquer » (déconnexion immédiate de tous ses appareils) ou « Suspendre l'abonnement ».

**Mises à jour de l'agent** : depuis le tray **1.2**, le tray (et l'agent qu'il embarque) se met à jour
seul — vérification toutes les 6 h sur `…/mises-a-jour/agent/latest.yml`, installation silencieuse la nuit
(1 h – 5 h) ou « Mettre à jour maintenant » dans son menu. Publier une version : `npm version x.y.z` dans
`agent_tray`, `npm run bundle:agent && npm run build && npx electron-builder --win`, déposer l'installeur et
son `.blockmap`, **puis** `latest.yml`, et recopier l'installeur en `softly-agent-setup.exe`. Les postes en
1.0 / 1.1 passent une seule fois à la main en 1.2.x. La version de chaque agent est visible dans l'app
d'administration (écran Agents).

**Agent de démo** (VPS, service `sos-agent`, `/opt/sos-agent`, copie de `dist/`, sans git) : mise à jour =
sauvegarde de `dist`, `rsync` du `dist` compilé, `systemctl restart sos-agent`. Il tourne à l'heure
d'Alger (`/etc/systemd/system/sos-agent.service.d/fuseau.conf` : `TZ=Africa/Algiers`) : le serveur est à
l'heure de Berlin, et les dates Delphi (sans fuseau) s'affichaient à la veille. Chez un client, le
fuseau du PC de l'agent doit être celui de la pharmacie (Alger).

Page publique : https://api.druxamed.com/mises-a-jour/ (modèle : `sos-cloud-server/deploy/telechargements/index.html`).
Appareils : illimités par défaut (quota modifiable par client, 0 = illimité).
Contrôle de bout en bout après une mise à jour du cloud (crée puis supprime un client d'essai, désactive
quelques secondes l'agent de démo) : `scripts/essai-parcours-client.mjs` du dépôt cloud, exécuté dans
le conteneur avec `AGENT=serveur-demo-vps001`.

## 0. Ordre et compatibilité

Déployer **dans cet ordre** ; chaque étape reste compatible avec les versions encore en place :

1. **Cloud** — compatible avec les anciens agents et les anciennes applications : les nouveaux
   champs ne servent qu'à la nouvelle app, le jeton `X-Druxamed-User` est simplement relayé (un
   ancien agent l'ignore). Il corrige aussi `refreshToken` pour tous les clients.
2. **Agents** (nouvel installeur du tray) — compatibles avec l'ancienne app desktop et l'app mobile
   actuelle : sans jeton utilisateur, les commandes historiques restent acceptées (mode non strict).
3. **App desktop** — exige cloud **et** agent à jour (nouvelles commandes, jeton utilisateur,
   argument `grille` des listes : avec un ancien agent, les listes ne seraient ni triées ni
   filtrées côté serveur et la liste des transferts ne s'afficherait pas).
4. **App mobile** avec envoi du jeton utilisateur.
5. **Plus tard** : mode strict sur chaque agent (`exiger_jeton_utilisateur: true`), une fois tous
   les postes desktop et mobiles mis à jour (voir § 5).

## 1. Préparation (la veille)

- [x] Commits poussés sur `main` : `sos-cloud-server`, `sos-agent`, `agent_tray`,
      `gestion-commerciale-desktop`, `app_mobile_client` (26/09/2026).
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

> **Configuration réelle (26/09/2026)** : accès `ssh -p 1986 root@druxamed.com`, dossier
> `/opt/sos-cloud-server`. **Apache** est le frontal (80/443, plusieurs sites) et proxifie
> `api.druxamed.com` vers `127.0.0.1:3001` ; un **Caddy dédié au gRPC** publie le port 50051
> (`docker-compose.grpc.yml` + `Caddyfile.grpc`). `update.sh` réutilise le fichier compose du
> conteneur en service (ne jamais relancer avec `docker-compose.prod.yml` sur ce serveur : Caddy y
> réclame 80/443 et l'API tombe en 503). Mises à jour servies par Apache :
> `https://api.druxamed.com/mises-a-jour/gestion-commerciale/` (app) et `…/mises-a-jour/agent/`.
> Attention à fail2ban : pas d'essais SSH avec des utilisateurs au hasard (bannissement de l'IP
> sur tous les ports).

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
# vX.Y.Z = champ "version" de app/package.json (0.3.0 aujourd'hui) : l'incrémenter avant de taguer
git tag vX.Y.Z && git push origin vX.Y.Z
```

La CI construit Windows (NSIS) et Linux (AppImage, deb) ; macOS via le job manuel `build:macos`
(runner macOS). Distribuer les installeurs ; les postes déjà équipés d'une version avec
auto-update se mettront à jour seuls (téléchargement en fond, installation à la fermeture).

Premier démarrage après mise à jour : les sessions ouvertes avant cette version **reprennent au
choix du dossier** (pour obtenir le jeton utilisateur) — pas besoin de ressaisir le compte cloud.

### Mobile

Commité et poussé (commit `b9768e7`, versionCode 32) : envoi du jeton `X-Druxamed-User` et travaux
en cours de l'équipe. Publier via EAS (`eas build --profile production`). 4 erreurs de typage
restent dans `app/(app)/tiers/preview.tsx` (sans effet sur le build). Les utilisateurs mémorisés avant cette version ressaisissent **une
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
- [ ] Ventes (période avec des pièces) : tri par montant sur toute la liste (pas seulement la page),
      recherche, groupement par client (effectifs et totaux), export Excel = tout le résultat filtré.
- [ ] Fiche article : en-tête renseigné, fiche de stock (stock final = stock enregistré, sinon
      l'alerte « Recalculer » apparaît).
- [ ] Achat BR avec « Payer tout » → pièce « Payée ».
- [ ] Fiche client → Crédit initial : un montant inférieur au déjà payé est refusé ; les paiements
      du crédit restent dans le relevé.
- [ ] Référentiels : créer / supprimer un centre de coût et un commercial.

Ajouts 0.3.x :

- [ ] Diagnostic : Internet / serveur / agent au vert, « Session sur ce poste » = chiffrée.
- [ ] Comptoir : couper le réseau → bandeau immédiat, encaissement suspendu ; rétablir → reprise sans doublon.
- [ ] Facture en cours : fermer l'application puis la rouvrir → le brouillon est proposé et repris.
- [ ] Quitter une facture modifiée par le menu → « Quitter sans enregistrer ? ».
- [ ] Ticket : impression directe sur l'imprimante thermique (Paramètres › imprimante ticket).
- [ ] Facture : aperçu, puis PDF à la taille de la page.
- [ ] Profil vendeur (sans le droit « Afficher le bénéfice ») : ni PMP ni marge dans le stock, la fiche article et les statistiques.

Automatisé (sur une copie de dossier uniquement) :

```bash
# Agent (base gc_test_*, voir l'en-tête des scripts)
cd sos-agent && npm run build
node test/integration/cycle-pieces.itest.js   # 109 vérifications (cycle des pièces, droits, crédit initial…)
node test/integration/lectures.itest.js       # les 91 commandes de lecture, 0 erreur SQL attendue
node test/integration/schema.itest.js         # tables et colonnes utilisées = schéma Delphi réel
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

- Stocks non recalculés : la fiche de stock les signale (7 articles sur 2036 dans la base de
  test) ; le recalcul passe par la procédure standard `UpdateSingleArticleStock`.
- Solde cumulé de la trésorerie : non triable ni filtrable (n'a de sens qu'en ordre chronologique).
- Bordereau / impressions « tout » des listes : critères de l'écran, sans les filtres de la grille.
- Transfert inter-dépôts : trace documentaire (les lots ne portent pas de dépôt dans ce schéma).
- PMP non recalculé à la modification d'un achat (volontaire, parité de valorisation avec Delphi).
- Timbre : appliqué d'office aux nouvelles factures / comptoirs en espèces ; les pièces Delphi
  existantes sans timbre n'en reçoivent pas lorsqu'on les modifie.
