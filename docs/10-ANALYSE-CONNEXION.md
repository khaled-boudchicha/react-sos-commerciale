# Analyse critique de la connexion — Gestion Commerciale Desktop

> Périmètre : dépôt `react-sos-commerciale` (app Electron + React + Apollo). Les serveurs `sos-cloud-server`
> et `sos-agent` ne sont pas dans ce dépôt : tout ce qui les concerne est **supposé** à partir de ce que le
> client appelle et de la documentation (`docs/02`, `03`, `04`, `07`, `08`). Les références `fichier:ligne`
> renvoient à `app/` sauf mention contraire. Convention : **[constaté]** = lu dans le code ; **[supposé]** =
> déduit de la doc ou du comportement attendu des serveurs.

---

## 1. Synthèse exécutive

**Verdict.** La connexion actuelle est correctement construite pour un client « cloud seul » : isolation
Electron propre, jeton chiffré au repos, en-têtes de dossier et d'utilisateur à chaque requête, renouvellement
automatique, veille d'abonnement. Mais elle fait reposer **100 % de l'activité de l'officine, caisse comprise,
sur la disponibilité simultanée d'Internet, du VPS Druxamed et du PC agent**, alors que les données sont à
10 mètres de la caisse. Aucun mode dégradé n'existe, l'indicateur « Connecté » peut être faux pendant une panne
cloud, et une vente au comptoir peut être enregistrée deux fois après une coupure. Côté sécurité, les points
faibles ne sont pas dans le renderer (bien verrouillé) mais à la périphérie : mises à jour non signées,
`connect-src http:`, clé d'appairage à longue durée de vie qui transite par le presse-papiers, droits de
lecture non contrôlés par l'agent.

**Recommandation en une phrase :** garder le cloud comme voie d'administration et d'accès distant, mais
ajouter une **voie LAN directe vers l'agent, prioritaire quand elle est joignable (option C, hybride)**,
précédée de quick wins de sécurité et d'un lot de résilience (idempotence des ventes, détection réseau
fiable). Le mode hors ligne complet avec synchronisation (option D) n'est pas justifié tant que l'agent est
sur le réseau local.

### Les 10 constats majeurs

| # | Constat | Gravité | Preuves |
|---|---|---|---|
| 1 | **Pas de mode dégradé** : la caisse refuse d'encaisser dès que la chaîne Internet → cloud → agent est rompue ; les tickets sont seulement conservés localement. | **Haute** | `src/screens/comptoir/Comptoir.tsx:149-153`, `:336-340` ; aucune file d'attente, aucun `navigator.onLine` |
| 2 | **Indicateur « Connecté » faux pendant une panne cloud/Internet** : quand `myAgents` échoue, l'app se replie sur `agent.isOnline` figé au moment de la connexion (et codé `true` en dur pour l'appairage et la bascule d'agent). L'encaissement est alors tenté puis échoue. | **Haute** | `src/components/AppShell.tsx:85-90`, `Comptoir.tsx:77-79`, `src/screens/Login.tsx:68`, `src/components/AgentSwitcher.tsx:31` |
| 3 | **Double enregistrement possible d'une vente** : aucune clé d'idempotence ; `createVente` puis `addReglementClient` sont deux mutations non atomiques ; en cas de réponse perdue l'utilisateur voit « Enregistrement échoué » et refait F2. | **Haute** | `Comptoir.tsx:163-212` (notamment `:167`, `:188`, `:209-211`) |
| 4 | **Mises à jour automatiques sans signature de code ni contrôle d'éditeur** : `autoDownload` + `autoInstallOnAppQuit` depuis un dossier HTTP public ; une compromission du VPS ou de la clé SSH de déploiement = exécution de code sur tous les postes. | **Haute** | `electron/updater.ts:51-62`, `package.json` (pas de `publisherName`), `.gitlab-ci.yml` (`CSC_LINK` facultatif), `docs/07-DEPLOIEMENT.md:91-93`, `docs/08:43` (B6) |
| 5 | **Transport** : CSP `connect-src 'self' https: http:` et URL de serveur non validée (schéma `http:` accepté) ; polices Google chargées à chaque lancement (fuite d'usage, dépendance externe). | Moyenne | `vite.config.ts:15`, `src/store/session.ts:46`, `src/api/client.ts:11`, `index.html:7-8` |
| 6 | **Appairage** : la clé `k` (vraisemblablement le jeton propre de l'agent) transite en clair par le presse-papiers, donne un JWT de 30 j renouvelable indéfiniment, n'est rattachée à aucun compte nominatif (`u` ignoré) ; révocation et traçabilité faibles. | Moyenne | `Login.tsx:55-77`, `e2e/flux-critiques.mjs:5` (`GC_API_KEY=<agent_token>`), `docs/03:20`, `src/api/useSessionKeepAlive.ts:9` |
| 7 | **Erreurs réseau invisibles** : `errorLink` ignore `networkError`, pas de `RetryLink`, pas de timeout côté client, `catch` silencieux ; les pannes apparaissent comme des listes vides. | Moyenne | `client.ts:32-42`, `useSessionKeepAlive.ts:38-49`, `comptoir/ChampScan.tsx:69`, `docs/08:67` (I12) |
| 8 | **Droits** : absence de droits ⇒ tout autorisé côté app ; les lectures ne sont pas contrôlées par l'agent ; le mode strict de l'agent n'est pas activé. | Moyenne | `src/lib/droits.ts:155`, `:206` ; `docs/08:28` ; `docs/07:219-230` |
| 9 | **Stockage local** : jeton chiffré par `safeStorage` mais **repli en clair** si le chiffrement est indisponible ; tickets en attente (lignes, client, prix) en clair dans `localStorage` ; `deviceId` en clair. | Moyenne | `electron/main.ts:32-39`, `comptoir/comptoirStore.ts:40-45`, `session.ts:97-103` |
| 10 | **Latence et trafic de fond** : chaque action = 2 à 5 allers-retours via un VPS en Europe ; `myAgents` toutes les 20 s (deux fois au comptoir), `sessionStatus` 2 min, droits 5 min ; exports « tout » de 5 000 lignes en JSON opaque. | Basse | `AppShell.tsx:85`, `Comptoir.tsx:77`, `useSessionKeepAlive.ts:11`, `useDroitsSync.ts:7`, `Ventes.tsx:79`, `Tresorerie.tsx:100` |

---

## 2. Cartographie de la connexion actuelle

### 2.1 Chaîne physique

```
Poste de l'officine (Electron)                 VPS Druxamed (Europe)            PC de l'officine
┌──────────────────────────────┐   HTTPS/JSON   ┌──────────────────────┐  gRPC   ┌──────────────┐  SQL  ┌─────────┐
│ renderer (React + Apollo)    │ ─────────────▶ │ Apache :443           │ bidi   │ sos-agent    │ ────▶ │ MariaDB │
│   authLink → 3 en-têtes      │ ◀───────────── │  └▶ sos-cloud-server  │◀──────▶│ (tray)       │ ◀──── │ dossiers│
│ main (electron-store,        │                │     :3001 GraphQL     │ :50051 │ droits-guard │       └─────────┘
│   safeStorage, updater)      │                │     proxy → gRPC      │(Caddy) │ HMAC user_tk │
└──────────────────────────────┘                └──────────────────────┘        └──────────────┘
          ▲                                               ▲
          │ HTTPS : latest.yml + installeur (non signé)   │ stream ouvert PAR l'agent (sortant) [supposé]
          └───────────────────────────────────────────────┘
```

- [constaté] Un seul transport : `createHttpLink({ uri: () => cloudUrl })` (`client.ts:9-12`). Aucune autre
  route, aucun WebSocket, aucune subscription (`docs/03:25`).
- [supposé] Le gRPC est un flux bidirectionnel ouvert par l'agent vers le cloud (`docs/03:14`, `docs/07:112`) :
  l'agent n'expose **aucun port entrant** aujourd'hui ; c'est ce qui rend l'architecture compatible NAT, mais
  aussi ce qui impose le détour par l'Europe pour parler à un PC situé dans la même pièce.
- [supposé] Timeouts de commande côté cloud : 30 s (défaut) / 60 s (« slow ») (`docs/03:24`, `:77`). Le client
  n'a aucun timeout propre.

### 2.2 Flux d'authentification

```
A. Compte cloud (3 étapes — Login.tsx)
   1. loginIdentify(username, password)      ──▶ { token_temp, agents[{agentId,label,isOnline,lastDossier}] }   (Login.tsx:79-96)
   2. loginWithAgent({ token_temp, agentId, deviceId, deviceName, platform:'desktop', force })                     (Login.tsx:98-133)
        statut agent_conflit → bouton « Forcer la connexion » (Login.tsx:117-121, 316-319)
        ──▶ { access_token (JWT cloud, 7 j [doc]) }  → session.setAuth(token, agent)
   3. query dossiers / dossierUsers ; loginDossierUser(username, password)                                         (Login.tsx:135-152)
        en-tête X-Druxamed-Dossier déjà positionné (setDossier AVANT la mutation, :139)
        ──▶ { ok, user_id, username, droits, user_token (HMAC signé par l'agent) } → setDossierUser

B. Appairage (poste dédié)
   coller JSON { u, k, a } (QR du tray)  →  loginWithApiKey({ apiKey:k, agent_id:a })                             (Login.tsx:55-77)
        `u` ignoré ; agent = { agentId:a, label:a, isOnline:true (codé) }   → même étape 3 ensuite
        ──▶ JWT 30 j [docs/03:20]
```

### 2.3 Jetons, secrets et en-têtes

| Élément | Origine | Où il vit | Durée / renouvellement | Envoyé comment |
|---|---|---|---|---|
| `token_temp` | `loginIdentify` | état React de `Login` uniquement (`Login.tsx:30`) | le temps du choix de l'agent | variable de `loginWithAgent` |
| **JWT cloud** (`token`) | `loginWithAgent` / `loginWithApiKey` / `refreshToken` / `switchAgentMobile` | zustand en mémoire + `electron-store` clé `session` **chiffrée safeStorage** (`main.ts:13`, `:32-39`) | 7 j [doc], **renouvelé toutes les 6 h** tant que l'app tourne (`useSessionKeepAlive.ts:9`, `:30-41`) ; 30 j pour l'appairage [doc] | `authorization: Bearer …` (`client.ts:24`) |
| **`user_token`** (jeton utilisateur dossier) | `loginDossierUser`, signé HMAC par l'agent (clé dérivée de secrets du PC, `docs/04:146`) | dans `dossierUser` → même blob chiffré (`session.ts:50-58`) | inconnue [supposé : lié aux secrets du PC, pas d'expiration visible] ; droits rafraîchis toutes les 5 min (`useDroitsSync.ts:7`) | `X-Druxamed-User` (`client.ts:27`) |
| **Dossier** | choix utilisateur | même blob | jusqu'au changement | `X-Druxamed-Dossier: encodeURIComponent(nom)` (`client.ts:25`) ; override par opération (`DossierSwitcher.tsx:58`) |
| `deviceId` | `crypto.randomUUID()` | `electron-store` clé `deviceId` **en clair** (`session.ts:97-103`, `main.ts:11`) | permanent | variable de `loginWithAgent` (quota `max_devices`) |
| `cloudUrl` | `VITE_CLOUD_URL` au build ou valeur persistée | même blob chiffré | permanent | — (c'est la cible des requêtes) |
| Clé d'appairage `k` | presse-papiers | état React, jamais persistée | — | variable de `loginWithApiKey` |
| Tickets comptoir en attente | saisie | `localStorage` **en clair** par dossier (`comptoirStore.ts:37-45`) | permanent | — |

Note : **aucun** secret n'est en `localStorage` (vérifié : `localStorage` ne sert qu'aux préférences de grille,
densité, récents, modèles et tickets comptoir). En mode navigateur (sans `window.gc`), la session n'est pas
persistée du tout (`session.ts:51`, `:82`).

### 2.4 Cycle de vie et signaux de fond

| Mécanisme | Période | Fichier | Remarque |
|---|---|---|---|
| Statut agent (`myAgents`) | 20 s, `network-only` | `AppShell.tsx:85` **et** `Comptoir.tsx:77` | les deux hooks tournent simultanément sur `/comptoir` (AppShell appelle le hook avant son `return` anticipé `:96-106`) |
| Veille compte/abonnement (`sessionStatus`) | 2 min | `useSessionKeepAlive.ts:11`, `:43-49` | les codes `ACCOUNT_BLOCKED`, `SUBSCRIPTION_*`, `AGENT_NOT_ALLOWED` passent par l'errorLink → bandeau (`AppShell.tsx:271-285`) |
| Renouvellement JWT | 6 h + au démarrage | `useSessionKeepAlive.ts:9`, `:51` | échec silencieux |
| Droits utilisateur | 5 min | `useDroitsSync.ts:7` | un agent ancien répond `{error}` → ignoré |
| Mise à jour app | 15 s après démarrage puis 6 h | `updater.ts:60-62` | installation à la fermeture |
| `UNAUTHENTICATED` | sur n'importe quelle réponse | `client.ts:38-40` | `logout()` immédiat : store effacé, cache Apollo vidé (`session.ts:74-80`) |
| Changement de dossier | à la demande | `DossierSwitcher.tsx:70-97` | dossier positionné avant `loginDossierUser`, restauré en cas d'échec, `resetStore` |
| Changement d'agent | à la demande | `AgentSwitcher.tsx:23-38` | nouveau JWT, `clearStore`, dossier vidé → retour à l'étape 3 |
| Reprise après redémarrage | au lancement | `session.ts:81-93`, `App.tsx:47-49`, `Login.tsx:26` | si `user_token` absent (session antérieure) → reprise à l'étape « dossier » sans ressaisir le compte cloud |

---

## 3. Analyse critique détaillée

### 3.1 Sécurité

#### S1 — Stockage des jetons : bon par défaut, repli dangereux [constaté]
- `main.ts:32-39` : si `safeStorage.isEncryptionAvailable()` est faux, le blob `session` (JWT + `user_token` +
  dossier + URL) est écrit **en clair** dans `gestion-commerciale.json`, sans avertissement. Cas réels : Linux
  sans trousseau (Electron peut alors retenir le backend `basic_text`, clé codée en dur — à vérifier sur le
  poste cible), profil Windows en cours de migration.
- Sur Windows, DPAPI déchiffre pour **tout processus du même compte Windows** : sur un PC d'officine à compte
  partagé, n'importe quel logiciel lancé par la caissière peut lire le JWT. C'est acceptable pour un poste
  de travail, mais le JWT vaut 7 j et se renouvelle indéfiniment.
- Impact : vol du fichier = session complète (dossier + utilisateur) jusqu'à révocation côté cloud.
- Recommandation : refuser de persister si le chiffrement n'est pas disponible (session en mémoire,
  reconnexion au prochain lancement, message dans Paramètres → Connexion) ; afficher le backend utilisé dans
  `/diagnostic` ; envisager une expiration courte du `user_token` (8–12 h) avec re-saisie du mot de passe
  dossier le matin, ce qui est le comportement du Delphi.

#### S2 — Transport : CSP permissive et URL non validée [constaté]
- `vite.config.ts:15` : `connect-src 'self' https: http:` ; commentaire : « reste ouvert car l'URL du serveur
  cloud est configurable ». Or **aucun écran n'appelle `setCloudUrl`** (grep : seul `session.ts:37,69` le
  définit ; le TODO `docs/04:55` dit « sélecteur de serveur ☑ » mais `Parametres.tsx:113-120` n'affiche que
  l'agent et le dossier). La permissivité n'a donc pas de contrepartie fonctionnelle.
- `session.ts:46` : `VITE_CLOUD_URL` accepté sans contrôle de schéma ; `e2e/flux-critiques.mjs:9` utilise
  `http://localhost:3001` — un build de test peut partir en clair.
- `index.html:7-8` : feuilles de style et polices depuis Google à chaque lancement : dépendance réseau tierce
  (rendu dégradé hors ligne), et chaque poste signale son usage à un tiers — gênant pour une officine.
- Impact : faible aujourd'hui (pas d'UI pour changer l'URL, blob chiffré), mais c'est précisément le point qui
  deviendra critique avec une route LAN (voir §5).
- Recommandation : `connect-src 'self' https:` ; valider `https:` dans `setCloudUrl`/`hydrate` (liste blanche
  de domaines pour les builds de production) ; vendoriser les polices (`public/fonts`) et retirer
  `fonts.googleapis.com` de la CSP.

#### S3 — En-têtes et contrôle des droits [constaté + supposé]
- Les trois en-têtes sont rejoués à chaque requête, lus dans le store au moment de l'envoi (`client.ts:18-30`) —
  correct, pas de closure périmée.
- `droits.ts:155` : `if (!droits) return true` et `:206` `admin: !droits || droits.admin`. Donc un agent qui
  renvoie une réponse partielle ou un `loginDossierUser` sans `droits` donne **tous les menus**. Les écritures
  restent protégées par l'agent (`docs/08:28`, e2e `:52-53` vérifie qu'une commande sans jeton est refusée),
  mais **pas les lectures** (`docs/08:28` : « `Get*` ne sont pas contrôlées par l'agent ») : relevés clients,
  statistiques, bénéfices sont accessibles à quiconque possède le JWT cloud, même sans `user_token`.
- Mode strict `exiger_jeton_utilisateur` non activé (`docs/07:159-160`, `:219-230`).
- Recommandation : inverser le défaut côté app (`!droits` ⇒ rien d'autre que le tableau de bord) une fois
  tous les agents à jour ; côté agent, contrôler aussi les lectures sensibles (`GetBenefices`, `GetEtatClient`,
  `GetStatVentes*`) ; activer le mode strict.

#### S4 — Appairage par code [constaté + supposé]
- `Login.tsx:55-77` : le code `{u,k,a}` est collé dans un `<Textarea>` en clair (`:260-262`), `u` n'est jamais
  utilisé, `k` part tel quel. `e2e:5` nomme cette valeur `<agent_token>` : **[supposé]** c'est le secret
  d'enregistrement de l'agent lui-même, donc un secret longue durée partagé par tous les postes appairés.
- Le JWT obtenu (30 j, `docs/03:20`) est ensuite renouvelé toutes les 6 h (`useSessionKeepAlive.ts:9`) : une
  session appairée ne meurt jamais tant que l'app démarre au moins une fois par semaine.
- Le presse-papiers Windows est lisible par toute application ; l'historique du presse-papiers (Win+V) et la
  synchronisation cloud du presse-papiers conservent le code.
- Pas de nom de poste ni d'utilisateur cloud derrière la session ⇒ dans l'administration, toutes les caisses
  appairées se ressemblent ; révoquer une caisse = régénérer la clé pour toutes.
- Recommandation : code d'appairage **à usage unique et court (10 min)** émis par le tray, échangé contre un
  jeton **par poste** (nommé, révocable individuellement dans l'admin) ; vider le champ et le presse-papiers
  après succès ; masquer la saisie.

#### S5 — Session concurrente et `force` [constaté]
- `Login.tsx:117-121` : en cas d'`agent_conflit`, un simple second clic « Forcer la connexion » éjecte la
  session existante. Rien n'indique quel poste/utilisateur sera éjecté, ni ne trace l'action.
- Impact : une caissière en pleine vente peut être déconnectée par un autre poste ; selon l'implémentation
  cloud [supposé], le `UNAUTHENTICATED` qui suit déclenche `logout()` (`client.ts:38-40`) et vide la session
  — le ticket en cours est conservé (localStorage) mais l'encaissement en cours peut être perdu.
- Recommandation : afficher qui occupe l'agent (`deviceName`, heure), exiger une confirmation explicite,
  journaliser côté cloud ; côté app, ne pas `logout()` brutalement pendant une mutation en vol (file d'attente
  de déconnexion).

#### S6 — Isolation Electron : bon niveau [constaté]
- `main.ts:57-63` : `contextIsolation`, `sandbox`, `nodeIntegration:false`, `webSecurity` ; `preload.ts` expose
  une API étroite ; IPC filtrés par liste blanche de clés et par expéditeur (`main.ts:11`, `:42-45`, `:91-102`) ;
  navigation et `window.open` bloqués (`:71-78`) ; fenêtre d'impression sans JS (`:116`).
- Réserve mineure : `expediteurValide` accepte `http://localhost:` même en production (`main.ts:44`) alors que
  `will-navigate` ne l'autorise qu'en développement (`:72`). Aligner les deux sur `NODE_ENV`.
- `modeles:lire/ecrire` reçoivent un nom de fichier depuis le renderer (`electron/modeles.ts:58-78`) : hors
  périmètre connexion, mais à vérifier contre la traversée de répertoire.

#### S7 — Mises à jour : le maillon le plus faible [constaté]
- `updater.ts:51-52` : téléchargement et installation automatiques ; fournisseur `generic` sur un dossier servi
  « sans authentification » (`docs/07:91-93`) ; binaires **non signés** (`docs/04:104`, `docs/08:43`,
  `.gitlab-ci.yml` : `CSC_LINK` facultatif) ; aucune option `verifyUpdateCodeSignature`/`publisherName` dans
  `package.json`.
- electron-updater vérifie le SHA-512 annoncé par `latest.yml`, mais ce fichier est sur le même serveur que
  l'installeur : qui modifie l'un modifie l'autre. La clé SSH de déploiement est dans les variables CI.
- Impact : un attaquant qui obtient l'écriture sur `mises-a-jour/` (VPS, clé CI, pipeline) exécute du code
  **sur tous les PC d'officine** à la prochaine fermeture de l'app — l'agent est dans le même cas
  (`docs/07:43-49`).
- Recommandation : signature Authenticode (Windows) + `publisherName`, notarisation macOS ; en complément,
  signer `latest.yml` (clé hors VPS) et vérifier dans `updater.ts` avant `autoDownload` ; séparer l'hôte de
  publication de l'API ; restreindre la clé SSH à `rsync` en écriture seule.

### 3.2 Fiabilité / résilience

#### R1 — Scénarios de panne : ce qui se passe réellement

| Scénario | Détection | Comportement observé dans le code | Verdict |
|---|---|---|---|
| **Internet coupé** à l'officine | aucune (`networkError` ignoré `client.ts:32`, pas de `navigator.onLine`) | `myAgents` échoue → `data` indéfini → `online = agent.isOnline` (valeur du login, souvent `true`) ⇒ **en-tête « Connecté »**, comptoir non bloqué ; F2 → `createVente` → « Enregistrement échoué : Failed to fetch » ; listes : grille vide ou « Chargement impossible » (`useSourceDistante.ts:104`) | **Trompeur** |
| **Cloud en panne** (VPS, Apache 503) | idem | idem ; `sessionStatus` échoue en silence | **Trompeur** |
| **Agent éteint** | `myAgents.isOnline=false` dans les 20 s | en-tête rouge, comptoir bloqué avec message clair (`Comptoir.tsx:153`, `:338`) ; `AgentSwitcher` grise les agents hors ligne (`:49`) | Correct |
| **Agent en cours de redémarrage** (mise à jour nocturne du tray, `docs/07:44`) | 20 s de latence de détection | fenêtre de 0–20 s où l'app croit l'agent en ligne ; commande → timeout cloud 30 s [supposé] | Moyen |
| **Latence élevée (800 ms)** | aucune | pas de timeout client ; chaque scan = 2 allers-retours (voir P2) ; `useLazyQuery` sans annulation : réponses de recherche désordonnées possibles (`ChampScan.tsx:43`) | Moyen |
| **Réponse perdue après écriture** | aucune | voir R2 | **Risque de doublon** |
| **JWT expiré** (app fermée > 7 j) | `UNAUTHENTICATED` | `logout()` → écran de connexion complet ; pas de message explicatif | Acceptable |
| **Abonnement expiré / compte bloqué** | ≤ 2 min | bandeau rouge persistant, pas de déconnexion automatique (sauf `AGENT_NOT_ALLOWED` → bouton) | Correct |

Le point structurel : **l'app ne sait pas distinguer « Internet absent », « cloud absent » et « agent
absent »** ; elle n'a qu'un booléen `isOnline` venant du cloud, qui devient indisponible exactement quand on
en a besoin.

#### R2 — Idempotence des écritures : absente [constaté]
- `Comptoir.tsx:167-182` : `createVente(input)` sans identifiant client (pas d'UUID de ticket, pas de
  `clientMutationId`). `:186-196` : `addReglementClient` ensuite, dans un second aller-retour ; si le second
  échoue, toast « Ticket N enregistré, mais l'encaissement a échoué » — l'utilisateur doit régler depuis la
  pièce (état incohérent caisse/pièce en attendant).
- `:209-211` : si `createVente` a été exécuté par l'agent mais que la réponse n'est pas revenue (coupure,
  timeout cloud 30 s), l'app affiche « Enregistrement échoué » avec le ticket intact ; la caissière refait F2 ⇒
  **deuxième bon de comptoir, stock décrémenté deux fois**. Même schéma dans `VenteEditor.tsx` (`:137-158`)
  et `AchatEditor`.
- Les garde-fous existants ne couvrent que le double clic local : `creation` (`Comptoir.tsx:152`), `enCours`
  (`PaiementDialog.tsx:37`), `saving` (`VenteEditor.tsx:365`).
- Recommandation : `client_request_id` (UUID v4 généré à la création du ticket, conservé dans le ticket
  persisté) transmis dans `input` ; côté agent [exigence] table `requete_idempotente(id, commande, reponse,
  date)` conservée 7 j : même id ⇒ même réponse, sans ré-exécution. Fusionner `createVente` + règlement en
  une commande atomique `createVenteEncaissee` (une transaction MariaDB).

#### R3 — Timeouts, relances, cache [constaté]
- Pas de `RetryLink`, pas d'`AbortController` : une requête peut rester pendante jusqu'au timeout du cloud
  (30/60 s) ou du socket. Les lectures idempotentes (listes, `myAgents`) mériteraient 2 relances avec
  backoff ; les mutations **jamais** sans idempotence.
- `fetchPolicy` : `cache-and-network` par défaut (`client.ts:48`), `network-only` sur les écrans critiques
  (comptoir, recherche, droits). Le cache Apollo n'est pas persisté : au redémarrage sans réseau, rien à
  afficher. Pour une caisse, un cache persistant des **référentiels** (articles, modes de paiement, coordonnées
  société, TVA) permettrait au moins de préparer les tickets et d'imprimer.
- `apollo.clearStore()` au `logout` et `switchAgent`, `resetStore()` au changement de dossier : correct, évite
  les mélanges de bases.

#### R4 — Détection et messages [constaté]
- La détection est un polling à 20 s d'une donnée **du cloud** sur l'état de l'agent. Elle ne mesure ni la
  joignabilité du cloud ni la santé de la base.
- Messages : `err.message` brut (« Failed to fetch », « Serveur injoignable ») (`Login.tsx:75,94,131`) ;
  `docs/08:67` (I12) relève que des pannes sont présentées comme « Aucun article ».
- `/diagnostic` (`Diagnostic.tsx:50-83`) est bien conçu (4 étapes, latences) mais manuel et sans test LAN.

### 3.3 Performance

#### P1 — Latence cumulée par requête [supposé, ordres de grandeur]
Officine en Algérie → VPS en Europe (`docs/07:53` : serveur à l'heure de Berlin) : 60–150 ms d'aller-retour
réseau, plus TLS, plus Apache → Node, plus le saut gRPC cloud → agent (second trajet Europe → Algérie sur le
flux ouvert par l'agent), plus MariaDB. Réaliste : **250–600 ms par requête simple**, 1–3 s pour les listes
agrégées, pics à plusieurs secondes sur ADSL/4G chargée. Le même appel en LAN : 5–30 ms.

#### P2 — Allers-retours par geste au comptoir [constaté]
| Geste | Requêtes | Fichier |
|---|---|---|
| Frappe texte (≥ 2 car.) | `articles(search, limit 12)` après 250 ms de debounce, `network-only` | `ChampScan.tsx:37-46` |
| Scan code-barres + Entrée | `articleParCodeBarre` (+ `articleParCode` en mode Code) puis `lots(article_id)` pour le lot le mieux fourni | `ChampScan.tsx:56-77`, `Comptoir.tsx:120-128` |
| F2 / F11 / F12 | `createVente` → `addReglementClient` → `refetch ventes(BCT, jour, limit 500)` → si impression `vente(id)` + `coordonneesSociete` | `Comptoir.tsx:167-221` |
| Ouverture de la caisse | `ventes(BCT, jour, 500)` + `myAgents` + droits | `Comptoir.tsx:82-88` |

Soit 2 allers-retours par article scanné et 3 à 5 par encaissement. À 400 ms, un ticket de 10 articles coûte
~10 s d'attente réseau cumulée (le lot arrive en asynchrone, donc perçu ≈ 4–5 s), et l'encaissement 1,5–2 s
avant le ticket. Le Delphi local est instantané : c'est la comparaison que feront les utilisateurs.

#### P3 — Tailles de réponses [constaté]
- Exports « tout » : `limit 5000` (`Ventes.tsx:79`, `Achats.tsx:77`, `JournalVentes.tsx:49`,
  `Tresorerie.tsx:100`, `RecouvrementPanel.tsx:68`), `limit 1000` tiers (`Tiers.tsx:265`), 500 BCT du jour
  rechargés **après chaque vente** (`Comptoir.tsx:203`). Les retours sont du `JSON!` opaque (`docs/03:13`) :
  pas de sélection de champs GraphQL, donc chaque ligne transporte toutes ses colonnes. Un export de 5 000
  ventes = plusieurs Mo via gRPC puis HTTPS ; à vérifier contre le `commandTimeout.slow` de 60 s.
- Dashboard : une requête, 5 champs (`dashboard.ts:4-12`) ; [supposé] résolus en parallèle par le proxy, sinon
  5 commandes gRPC séquentielles.

#### P4 — Trafic de fond
`myAgents` ×2 toutes les 20 s sur `/comptoir` (6 req/min/poste), `sessionStatus` 2 min, droits 5 min. Pour
une officine à 3 postes : ~20 requêtes/min vers le cloud sans aucune action utilisateur. Négligeable en bande
passante, mais chaque requête est une commande gRPC vers l'agent [supposé pour `myAgents` : probablement
répondu par le cloud seul].

### 3.4 Expérience utilisateur de connexion

- **Flux en 3 étapes** (`Login.tsx:175-179`) : lisible (Compte → Établissement → Dossier), indicateur d'étape,
  pré-sélection de l'agent unique (`:91`) et du dernier dossier (`:126`), reprise à l'étape 3 après
  redémarrage (`:26`). Bon niveau.
- **Messages** : table `STATUT_MESSAGES` claire (`:13-21`) ; mais les erreurs transport sont techniques
  (`err.message`). « Serveur injoignable » ne dit pas lequel.
- **Appairage** : coller un JSON dans un textarea est fragile (espaces, guillemets typographiques depuis
  WhatsApp) et peu rassurant ; un lecteur de QR via webcam ou un fichier `.druxamed-pairing` serait plus
  robuste.
- **Changement de dossier/agent** : modales soignées, ré-identification obligatoire, restauration en cas
  d'échec (`DossierSwitcher.tsx:76-96`). Réserve : `AgentSwitcher` force `isOnline:true` (`:31`) et vide le
  dossier sans ramener explicitement à l'écran de connexion — `App.tsx:49` le fait implicitement.
- **Multi-postes** : chaque poste a son `deviceId` et son JWT ; `agent_conflit` suggère [supposé] une session
  par agent **et par compte cloud** : deux caisses avec le même identifiant se chassent mutuellement sauf
  `force`. La doc (`docs/07:37`) recommande un compte employé par personne — à imposer dans l'UI (message
  explicite lors du conflit).
- **État « agent hors ligne »** : bandeau et pastille cohérents (AppShell, Ruban, Comptoir), mais, comme vu en
  R1, l'état « cloud hors ligne » est invisible et se confond avec « tout va bien ».

### 3.5 Dépendance au cloud

- **Continuité d'activité** : une officine sans Internet ne peut ni vendre ni consulter son stock alors que
  la base est locale. Le Delphi, lui, continue. C'est une régression fonctionnelle majeure par rapport à
  l'existant, et le premier motif de rejet prévisible.
- **Point de défaillance unique** : un seul VPS, Apache + Node + Caddy gRPC (`docs/07:110-118`), mises à jour
  et API sur le même hôte ; aucune redondance décrite.
- **Coûts** : chaque requête consomme CPU/bande passante VPS ; les exports de 5 000 lignes et les pollings
  s'additionnent avec le nombre de clients.
- **Conformité / données de santé** : si les dossiers contiennent des données de patients (ventes nominatives
  de médicaments), elles **transitent** par un serveur hors du pays à chaque consultation, même si elles ne
  sont pas stockées (réglementation algérienne sur les données personnelles — loi 18-07 — et exigences de
  localisation : à faire qualifier juridiquement). Le LAN supprime ce transit pour l'usage courant.
- **Souveraineté / dépendance éditeur** : abonnement, blocage à distance (`docs/07:41`) — légitimes
  commercialement, mais le client doit savoir qu'un impayé coupe la caisse. Une route LAN avec période de grâce
  signée (voir §5) concilie les deux.

---

## 4. Comparaison des architectures

Notation 1 (mauvais) → 5 (excellent). Pondération indicative entre parenthèses.

| Critère (poids) | (A) Cloud seul — actuel | (B) LAN direct seul | (C) Hybride LAN prioritaire, cloud secours | (D) Hors ligne local + file + synchro |
|---|---|---|---|---|
| Continuité d'activité (×3) | 1 — tout s'arrête sans Internet | 4 — dépend du PC agent + LAN | **5** — LAN ou cloud, au choix du réseau | 5 — même l'agent éteint |
| Latence perçue (×2) | 2 — 250–600 ms/requête, 2–5 par geste | 5 — 5–30 ms | **5** en LAN, 2 en secours | 5 |
| Sécurité (×3) | 3 — TLS public, mais appairage et MAJ faibles | 3 — TLS LAN à construire (cert auto-signé épinglé), découverte à sécuriser, port entrant sur le PC agent | 3 — cumule les deux surfaces ; épinglage et jeton vérifié hors ligne obligatoires | 2 — données et file sur chaque poste, conflits de numérotation, surface élargie |
| Complexité serveur/agent (×2) | 5 — rien à faire | 2 — endpoint HTTPS local, vérification JWT hors ligne, cert, heartbeat | 2 — idem + publication lanUrl/empreinte par le cloud | 1 — moteur de synchro, résolution de conflits, numérotation différée |
| Complexité client (×2) | 5 | 3 — route, épinglage, QR étendu | 3 — idem + routeur et bascule | 1 — base locale, file, rejeu, réconciliation UI |
| Déploiement / maintenance (×2) | 4 — un seul endpoint | 3 — pare-feu Windows, IP/mDNS, renouvellement cert | 3 — idem, mais le cloud reste la voie de secours « zéro config » | 1 — chaque poste devient un système à administrer |
| Multi-sites / accès distant (×2) | 5 — natif | 1 — perdu (sauf VPN) | **5** — cloud conservé | 3 — via cloud après synchro |
| Administration / abonnement (×1) | 5 | 2 — blocage impossible hors cloud sans mécanisme signé | 4 — statut signé avec TTL | 3 |
| Coût d'exploitation (×1) | 2 — tout passe par le VPS | 5 | 4 — 90 % du trafic reste local | 4 |
| **Score pondéré /90** | **56** | **58** | **72** | **54** |

Lecture : (B) seul perd l'accès distant et l'administration ; (D) est le plus robuste mais démesuré tant que
l'agent et sa base sont sur le réseau de l'officine (c'est l'agent qui est la « base locale », pas le poste).
**(C) domine** parce qu'il réutilise tout l'existant (même API, mêmes jetons, même agent) et ne change que la
route.

---

## 5. Recommandation et conception cible

### 5.1 Choix : (C) hybride, LAN prioritaire, cloud en secours — précédé des lots sécurité et résilience

Pourquoi LAN prioritaire plutôt que cloud prioritaire : la latence et la continuité sont les deux motifs
utilisateurs ; le cloud ne sert vraiment qu'à l'accès distant, à l'administration et au secours. Pourquoi pas
(D) maintenant : la file d'attente locale n'apporte de valeur que si l'**agent** lui-même est injoignable
(PC éteint) — cas rare et réglé par une alimentation de secours. Un « D-lite » (file de tickets comptoir
seulement, numérotés par l'agent au rejeu) reste possible plus tard, et devient simple une fois
l'idempotence (R2) en place.

### 5.2 Conception de haut niveau

```
                      ┌────────────────────── Routeur de connexion (app) ──────────────────────┐
                      │ état : route ∈ {lan, cloud}, sondes LAN (health, 1,5 s) toutes les 15 s │
                      │ bascule → lan après 2 sondes OK ; → cloud après 2 échecs ; toast + badge │
                      └───────┬─────────────────────────────────────────────┬────────────────────┘
                              │ https://<ip-agent>:8443/graphql              │ https://api.druxamed.com/graphql
                              │ cert auto-signé ÉPINGLÉ (empreinte SHA-256)  │ CA publique
                              │ mêmes 3 en-têtes                             │ mêmes 3 en-têtes
                              ▼                                              ▼
                    ┌──────────────────┐   gRPC (inchangé)   ┌──────────────────────┐
                    │ sos-agent        │◀───────────────────▶│ sos-cloud-server     │
                    │ + endpoint HTTPS │  heartbeat enrichi : │ + myAgents.lanUrl,   │
                    │   GraphQL local  │  lanUrl, empreinte,  │   certFingerprint    │
                    │ + vérif JWT      │  compteurs d'usage   │ + JWKS (clé publique │
                    │   hors ligne     │ ◀── statut abonnement│   des JWT)           │
                    │ + idempotence    │     signé (TTL 72 h) │ + révocations        │
                    └──────────────────┘                     └──────────────────────┘
```

**Découverte de l'agent (3 sources, par ordre)**
1. Adresse mémorisée dans la session (`lanUrl` + `fingerprint`), fournie par `myAgents` [exigence cloud] ou
   par le code d'appairage étendu `{u,k,a,lan,fp}` [exigence tray].
2. mDNS/DNS-SD `_druxamed-agent._tcp.local` (TXT : `agentId`, `fp`) — optionnel, utile quand l'IP change
   (DHCP). Implémenté dans **main** (Node), jamais dans le renderer.
3. Saisie manuelle dans Paramètres → Connexion (IP:port), avec affichage de l'empreinte à confirmer.
   Dans tous les cas, l'app n'accepte une adresse LAN que si l'empreinte présentée correspond à celle associée
   à `agentId` — jamais « trust on first use » silencieux.

**API côté agent** : **même schéma GraphQL « proxy » que le cloud** (champs `JSON!`, mêmes noms), pour que
`src/api/queries.ts` et tous les écrans restent inchangés. [supposé] L'agent possède déjà des modules GraphQL
(`docs/02:71` « `sos-agent/src/modules/*/*.schema.gql` », `docs/08:98` « API GraphQL locale de l'agent ») :
le coût est d'exposer le **bridge** (`grpc-bridge.service.ts`, qui fait déjà le routage commande → service et le
contrôle de droits) derrière un résolveur HTTP local, pas de réécrire les services.

**Authentification sur le LAN**
- JWT cloud **vérifié hors ligne** par l'agent : le cloud signe en asymétrique (RS256/EdDSA) et publie sa clé
  publique (JWKS) que l'agent met en cache ; l'agent vérifie signature, expiration, `agentId` du jeton =
  lui-même. Pas de nouveau jeton à inventer, pas de secret partagé.
- `X-Druxamed-User` : déjà signé et vérifié par l'agent (`docs/04:146`) ; inchangé. Les droits et la
  traçabilité (`user_id`/`user_name` depuis le jeton, `docs/08:42` B2) sont donc **identiques** sur les deux
  routes.
- Révocation : l'agent reçoit du cloud (sur le flux gRPC existant) la liste des sessions révoquées et le
  **statut d'abonnement signé avec TTL** (ex. 72 h). Hors TTL (cloud injoignable trop longtemps), l'agent passe
  en mode « grâce » : lectures et comptoir autorisés, bandeau « Abonnement non vérifié depuis N h », puis
  blocage après la grâce configurée. Le propriétaire conserve ainsi son levier commercial sans couper une
  officine pour une panne de fibre.
- Appairage : code à usage unique (10 min) → jeton **par poste** nommé, révocable ; le QR contient aussi
  `lan` et `fp`.

**TLS sur le LAN** : certificat auto-signé généré par l'agent à l'installation (clé 2048/EC P-256, validité
10 ans, SAN = IP + `agent-<id>.local`), empreinte SHA-256 publiée au cloud et dans le QR. Côté app :
épinglage dans **main** (`app.on('certificate-error')` restreint aux hôtes LAN mémorisés, ou mieux
`session.setCertificateVerifyProc` comparant l'empreinte) ; le renderer continue d'appeler `fetch` via Apollo.
Rotation : nouvelle empreinte annoncée par le cloud, acceptée seulement si elle arrive signée par le cloud.

**Basculement et indicateur**
- Hook `useRoute()` remplace le polling `myAgents` comme source de vérité d'état : trois voyants —
  **Agent** (LAN sonde ou `myAgents`), **Cloud** (sonde `__typename` 30 s), **Route active** (« LAN » /
  « Cloud »). Badge dans l'en-tête et dans la barre de caisse ; toast à chaque bascule.
- Les **lectures** basculent librement ; les **mutations** ne sont jamais rejouées automatiquement sur l'autre
  route sans `client_request_id` (R2). Une mutation en vol lors d'une bascule reçoit une erreur explicite
  « Vérifiez les ventes du jour avant de ressaisir ».
- Mode « LAN seul » (cloud injoignable) : tout fonctionne ; les fonctions purement cloud (changer d'agent,
  `sessionStatus`, mises à jour) sont grisées avec explication.

**Droits et traçabilité** : identiques (même jeton utilisateur, même garde). Ajouter dans l'agent un journal
local des connexions LAN (poste, utilisateur, heure) remonté au cloud par le heartbeat pour l'écran Agents.

### 5.3 Ce qui doit changer, par dépôt

**Côté agent (`sos-agent` / `agent_tray`) — exigences**
1. Endpoint HTTPS local (port fixe, configurable, défaut 8443) exposant le schéma proxy GraphQL ; `GET /health`
   (sans auth) renvoyant `agentId`, version, empreinte.
2. Génération/rotation du certificat ; ouverture du port dans le pare-feu Windows par l'installeur du tray.
3. Vérification hors ligne des JWT cloud (cache JWKS) + liste de révocation + statut d'abonnement signé (TTL,
   grâce configurable).
4. Table d'idempotence des commandes d'écriture (`client_request_id`), commande atomique
   `CreateVenteEncaissee`.
5. Heartbeat enrichi (lanUrl détectée, empreinte, compteurs) ; journal des accès LAN.
6. Code d'appairage à usage unique, QR étendu `{u,k,a,lan,fp}` ; mode strict des droits activé ; contrôle des
   lectures sensibles.

**Côté cloud (`sos-cloud-server`) — exigences**
1. JWT signés en asymétrique + JWKS public ; `myAgents` renvoie `lanUrl`, `certFingerprint`, `lanPort`.
2. Diffusion vers l'agent (gRPC) : statut d'abonnement signé, révocations de sessions, nouvelle empreinte
   acceptée.
3. Jetons par poste (appairage) révocables individuellement dans l'admin ; journal des `force`.
4. Séparation de l'hôte de mises à jour et signature des manifestes.

**Côté app (ce dépôt) — fichiers concernés**
| Fichier | Changement |
|---|---|
| `src/api/client.ts` | `uri` devient `() => route === 'lan' ? lanUrl : cloudUrl` ; ajout d'un `RetryLink` (lectures seulement) et d'un timeout (`AbortController`) ; `onError` traite `networkError` → store réseau |
| `src/store/session.ts` | `lanUrl`, `lanFingerprint`, `route`, `reseau: {cloud, agent, lan}` ; validation `https:` ; refus de persister sans chiffrement |
| `src/api/useRoute.ts` (nouveau) | sondes, machine d'états, bascule, remplace les deux pollings `MY_AGENTS` |
| `electron/main.ts` | épinglage de certificat pour les hôtes LAN mémorisés ; IPC `lan:discover` (mDNS) ; `expediteurValide` strict en prod |
| `electron/preload.ts` | exposition `lan.discover`, `lan.pin` |
| `src/screens/Login.tsx` | QR étendu, champ masqué, nettoyage du presse-papiers, confirmation explicite du `force` |
| `src/components/AppShell.tsx`, `navigation/Ruban.tsx`, `comptoir/Comptoir.tsx` | badge tri-état, `bloque` dérivé de `useRoute` |
| `src/screens/Diagnostic.tsx` | test LAN (health, empreinte, latence) et test cloud séparés |
| `src/screens/Parametres.tsx` | section Connexion : adresse LAN, empreinte, préférence de route, backend de chiffrement |
| `src/screens/comptoir/Comptoir.tsx`, `VenteEditor.tsx`, `AchatEditor.tsx` | `client_request_id` dans les `input` ; appel de la commande atomique |
| `src/screens/comptoir/comptoirStore.ts` | UUID par ticket (base de l'idempotence et d'un futur D-lite) |
| `vite.config.ts`, `index.html` | CSP `connect-src 'self' https:` ; polices vendorisées |
| `electron/updater.ts`, `package.json` | `publisherName`, vérification de signature, manifeste signé |

---

## 6. Plan d'action priorisé

### Lot 0 — Quick wins sécurité (effort S, 1–2 semaines, aucun impact serveur sauf signature)
| Action | Effort | Risque | Recette |
|---|---|---|---|
| CSP `connect-src 'self' https:` ; validation `https:` de l'URL ; polices vendorisées | S | nul | build prod : aucune requête `http:` ni vers Google ; app fonctionne hors ligne au niveau rendu |
| Refus de persistance si `safeStorage` indisponible + affichage du backend dans `/diagnostic` | S | reconnexion au lancement sur postes sans trousseau | Linux sans keyring : pas de fichier `session` en clair |
| Signature Authenticode + `publisherName` + manifeste signé ; clé SSH CI restreinte | S–M (procédure d'achat de certificat) | pipeline à rejouer | installeur altéré refusé par l'updater |
| Champ d'appairage masqué, presse-papiers vidé après succès ; confirmation du `force` avec nom du poste | S | nul | code invisible après collage ; conflit affiché avec `deviceName` |
| `expediteurValide` strict en prod | S | nul | IPC refusé depuis une URL `http://localhost` en prod |
| Activer `exiger_jeton_utilisateur` sur les agents (côté exploitation) | S | mobile non à jour bloqué | commande sans `X-Druxamed-User` refusée (déjà couvert par l'e2e `:52`) |

**État d'avancement (01/11/2026) — partie application livrée :**

- ✅ Polices embarquées (`@fontsource`, aucun appel à Google Fonts) ; CSP de production `connect-src 'self' https:`, `font-src 'self' file: data:`.
- ✅ URL cloud validée (`urlCloudValide`, `store/session.ts`) : `https:` seule en production, `http://localhost` / `127.0.0.1` tolérés en développement ; une valeur invalide (variable d'environnement ou session mémorisée) retombe sur l'URL officielle. Tests : `src/__tests__/securite.test.ts`.
- ✅ Jetons : plus aucune écriture en clair. Sans chiffrement fiable (`safeStorage` indisponible ou moteur Linux `basic_text`), la session n'est pas mémorisée (reconnexion au lancement) ; une ancienne session en clair est rechiffrée ou purgée. L'état s'affiche dans `/diagnostic` (« Session sur ce poste »), via l'IPC `securite:etat`.
- ✅ `expediteurValide` : `http://localhost` accepté seulement si `NODE_ENV=development`.
- ✅ Code d'appairage masqué (bouton œil), effacé du champ et du presse-papiers après succès (si le presse-papiers contient encore ce code).
- ✅ « Forcer la connexion » : fenêtre de confirmation (danger, focus sur « Annuler ») nommant l'établissement et prévenant que l'autre poste sera déconnecté. *Le nom du poste concurrent (`deviceName`) n'est pas renvoyé par le cloud aujourd'hui : à ajouter côté serveur.*
- ⏳ Hors application : signature Authenticode + `publisherName` (achat du certificat), restriction de la clé SSH de CI, activation de `exiger_jeton_utilisateur` sur les agents (exploitation).

### Lot 1 — Résilience (effort M, 3–5 semaines, app + agent)
| Action | Effort | Risque | Recette |
|---|---|---|---|
| Store réseau tri-état (`cloud`, `agent`, `route`) alimenté par `networkError` + sondes ; badge et messages distincts | M | faux positifs sur réseaux lents → seuils (2 échecs) | **Internet coupé** : en < 30 s le badge passe « Cloud injoignable », F2 bloqué avec message adapté, aucun appel `createVente` émis |
| `client_request_id` + table d'idempotence agent + commande atomique vente+règlement | M | migration agent | **Double clic « Encaisser » pendant une coupure** : une seule pièce en base, stock décrémenté une fois ; rejeu de la même requête ⇒ même numéro renvoyé |
| `RetryLink` (lectures, 2 essais, backoff) + timeout client 15 s lectures / 45 s écritures | S | relances inutiles sur 5xx | **Latence 800 ms** : scan → article affiché < 1,2 s ; aucune requête pendante > 45 s |
| Cache persistant des référentiels (articles, modes, coordonnées, TVA) via `apollo3-cache-persist` dans `electron-store` | M | fraîcheur des prix → TTL 24 h + invalidation à la connexion | **Cloud en panne** : la recherche d'article fonctionne en lecture depuis le cache, encaissement bloqué proprement |
| Un seul poller `myAgents` (sortir le hook de `AppShell` quand `/comptoir`) ; `refetchJour` différé | S | nul | trafic de fond ≤ 3 req/min/poste |
| Journal local des erreurs de transport consultable dans `/diagnostic` | S | nul | après coupure : liste horodatée des échecs |

### Lot 2 — Mode LAN / hybride (effort L, 6–10 semaines, agent + cloud + app)
| Action | Effort | Risque | Recette |
|---|---|---|---|
| Agent : endpoint HTTPS local + `/health` + certificat + pare-feu | L | antivirus/pare-feu d'officine ; conflits de port | depuis un poste : `curl -k https://<ip>:8443/health` répond avec `agentId` et empreinte |
| Agent : vérification JWT hors ligne (JWKS), révocations, statut d'abonnement signé + grâce | M | désynchronisation d'horloge PC (tolérance ±5 min) | agent coupé du cloud : requêtes LAN acceptées pendant la grâce, bandeau affiché, blocage ensuite |
| Cloud : JWT asymétriques, `myAgents.lanUrl/fingerprint`, diffusion statut/révocations | M | rotation de clé : double signature pendant 7 j | ancienne app mobile continue de fonctionner (jeton vérifié par le cloud comme avant) |
| App : `useRoute`, routeur d'URI, épinglage dans `main`, QR étendu, badge, Diagnostic LAN | M | bascule en pleine mutation → erreur explicite, pas de rejeu silencieux | **Agent joignable en LAN, Internet coupé** : vente, impression, consultation sans aucune dégradation ; badge « LAN » ; **Internet rétabli** : pas de bascule tant que le LAN répond ; **agent éteint** : bascule cloud → agent hors ligne détecté, comptoir bloqué |
| App : changement de dossier et droits sur la route LAN | S | nul | **Changement de dossier** en LAN : `X-Druxamed-Dossier` honoré, `loginDossierUser` renvoie un jeton accepté sur les deux routes |
| Deux postes sur le même agent | — | sessions par poste (Lot 0) | **Deux postes** : chacun en LAN, badges indépendants, aucune éjection ; `force` seulement sur conflit réel de compte |

### Lot 3 — Optionnel : D-lite comptoir (effort L)
File locale de tickets « à transmettre » (déjà persistés en `localStorage`), rejeu automatique avec
`client_request_id` quand l'agent revient, numérotation par l'agent au rejeu, bandeau « N tickets en
attente ». À n'entreprendre que si les retours terrain montrent des arrêts fréquents du PC agent.

---

## 7. Questions ouvertes à trancher par le propriétaire

1. **L'agent expose-t-il déjà un port local ?** `docs/08:98` mentionne une « API GraphQL locale de l'agent »
   avec résolveurs ; est-elle servie (port, TLS, auth) ou seulement compilée ? Cela conditionne l'effort du Lot 2.
2. **Nature de la clé d'appairage `k`** : est-ce le jeton d'enregistrement de l'agent (secret unique par
   officine) ou une clé dédiée ? Combien de postes la partagent aujourd'hui ?
3. **Données de santé** : les dossiers contiennent-ils des informations nominatives de patients (ordonnances,
   chifa) ? Si oui, le transit par un VPS hors du pays doit être qualifié juridiquement, et la route LAN devient
   une exigence de conformité, pas seulement de confort.
4. **Nombre de postes par officine et par agent**, et combien de comptes cloud partagés : détermine la
   politique de session (`agent_conflit`) et le besoin de jetons par poste.
5. **Besoin réel d'accès à distance** (gérant hors site, multi-officines via `switchAgent`) : justifie de
   garder le cloud en route de secours plutôt que de passer au LAN seul.
6. **Politique commerciale en cas d'impayé** : coupure immédiate (actuel) ou grâce signée de N jours en LAN ?
7. **Hébergement** : le VPS unique (API + gRPC + mises à jour) est-il appelé à être redondé ou rapatrié dans
   le pays ? Le mode LAN réduit l'enjeu mais ne supprime pas l'administration.
8. **Signature de code** : budget et identité (certificat EV Windows, Apple Developer) — prérequis du Lot 0.
9. **Horloges** : les PC agents sont-ils synchronisés (NTP) ? Nécessaire pour la vérification hors ligne des
   JWT et des statuts signés.
10. **Durée de vie du `user_token`** : illimitée aujourd'hui [supposé] ; souhaite-t-on une ré-identification
    quotidienne du caissier comme dans le Delphi ?
