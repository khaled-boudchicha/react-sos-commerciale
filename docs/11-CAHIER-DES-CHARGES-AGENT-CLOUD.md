# Cahier des charges — évolutions de l'agent et du cloud pour la connexion

> Version 1.0 — 1er novembre 2026.
> Destinataires : équipes des dépôts `sos-agent`, `agent_tray` et `sos-cloud-server`.
> Source : analyse critique de la connexion (`docs/10-ANALYSE-CONNEXION.md`), complétée par ce que l'app
> desktop a déjà livré de son côté (PR #7 et #8).

---

## 0. Objet, périmètre, conventions

**Objet.** Décrire, de façon testable, ce que l'agent et le cloud doivent fournir pour que l'app desktop
(et à terme l'app mobile) :
1. ne puisse **jamais créer de doublon** de vente ou de règlement après une réponse perdue ;
2. dispose de jetons, de sessions et d'un appairage **sûrs et révocables poste par poste** ;
3. **continue de vendre sans Internet** tant que le PC de l'agent est joignable sur le réseau local
   (mode « LAN prioritaire, cloud en secours »).

**Hors périmètre.** File d'attente locale de tickets hors agent (« D-lite », phase 4 optionnelle, décrite
pour mémoire) ; refonte du schéma Delphi ; redondance du VPS.

**Conventions.**
- Identifiants d'exigence : `AG-xx` agent, `TR-xx` tray, `CL-xx` cloud, `OP-xx` exploitation.
- Niveau : **DOIT** (bloquant pour la recette), **DEVRAIT** (attendu, dérogation motivée), **PEUT** (optionnel).
- [constaté] = vérifié dans le code ou la doc de ce dépôt ; [supposé] = à confirmer par l'équipe concernée.
- Tous les messages destinés à l'utilisateur sont en français ; les codes (`extensions.code`) en anglais
  majuscules, comme l'existant (`ACCOUNT_BLOCKED`, `SUBSCRIPTION_EXPIRED`…).

## 1. Situation de départ

```
App desktop ──GraphQL HTTPS (Bearer JWT, X-Druxamed-Dossier, X-Druxamed-User)──▶ sos-cloud-server
                                                                                   │ gRPC bidi
                                                                                   ▼
                                                                    sos-agent (PC pharmacie) ──▶ MariaDB
```

[constaté] Points de départ utiles :
- Les mutations prennent un `input: JSON!` opaque et renvoient `JSON!` : **ajouter un champ dans `input` ne
  change pas le schéma GraphQL**.
- Le cloud coupe une commande au bout de 30 s (60 s pour les commandes « lentes ») ; l'app ne sait pas
  aujourd'hui si la commande a été exécutée par l'agent.
- `createVente` puis `addReglementClient` sont deux allers-retours distincts ; si le second échoue, la pièce
  existe sans son règlement.
- Les en-têtes CORS autorisés sont une liste explicite (`X-Druxamed-*` ajoutés un par un, `docs/04`).
- L'appairage repose sur un code `{u, k, a}` copié depuis le tray ; une seule session par compte et par agent
  (`agent_conflit` → `force`).

Ce que l'app a **déjà** fait seule (aucune attente côté serveur) :
- état Internet / serveur / agent distinct, délais client (35 s / 65 s), relances des **lectures** seulement ;
- parade anti-doublon au comptoir : après une réponse perdue, relecture des ventes du jour avant de
  réencaisser (heuristique montant + caissier, **pas une garantie**) ;
- cache hors ligne des référentiels et des articles consultés (lecture seule) ;
- lecture tolérante du code d'appairage et import d'un fichier `.druxamed-pairing`.

## 2. Phasage

| Phase | Contenu | Dépôts | Effort indicatif | Dépendances |
|---|---|---|---|---|
| **1 — Idempotence** | `client_request_id`, journal d'idempotence, commande atomique vente + règlement, codes d'erreur | agent, cloud | M (2–3 sem.) | aucune |
| **2 — Sessions, jetons, appairage** | conflit détaillé, jetons par poste, appairage à usage unique, JWT asymétriques + JWKS | cloud, tray, agent | M (2–3 sem.) | aucune ; prérequis de la phase 3 |
| **3 — Mode LAN** | endpoint HTTPS local, TLS épinglé, vérification hors ligne, statut d'abonnement signé, découverte | agent, tray, cloud | L (6–8 sem.) | phases 1 et 2 |
| 4 — D-lite (optionnel) | file de tickets rejouée par l'agent | agent | L | phase 1 |

La phase 1 est **prioritaire** : c'est la seule qui corrige un risque d'intégrité des données (stock
décrémenté deux fois). Elle est indépendante du mode LAN et livrable seule.

---

## 3. Phase 1 — Idempotence des écritures

### 3.1 Principe

Chaque écriture porte un identifiant généré par le client, `client_request_id` (UUID v4), **dans l'objet
`input`**. L'agent mémorise, dans la même transaction que l'écriture, l'identifiant et la réponse. Un
second envoi du même identifiant renvoie la réponse mémorisée **sans rien réexécuter**.

L'app réutilise le même identifiant tant qu'elle n'a pas reçu de réponse définitive pour la même opération
(même ticket, même pièce) ; elle en génère un nouveau pour toute nouvelle opération.

### 3.2 Exigences agent

| ID | Niveau | Exigence |
|---|---|---|
| AG-01 | DOIT | Accepter un champ `client_request_id` (chaîne, UUID v4, 36 car.) dans l'`input` des commandes listées en 3.4. Valeur absente ⇒ comportement actuel inchangé (rétrocompatibilité). Valeur mal formée ⇒ erreur `BAD_USER_INPUT`. |
| AG-02 | DOIT | Tenir un journal d'idempotence **dans la base du dossier**, écrit **dans la même transaction MariaDB** que l'écriture métier (voir 3.3). Sans cette atomicité, un arrêt entre la vente et le journal recrée le risque de doublon. |
| AG-03 | DOIT | Même `client_request_id` + même empreinte de contenu ⇒ renvoyer la réponse mémorisée, avec `rejoue: true` dans le JSON renvoyé, sans réexécution ni nouveau mouvement de stock. |
| AG-04 | DOIT | Même `client_request_id` + empreinte **différente** ⇒ refuser avec `IDEMPOTENCE_CONFLICT` (le client a réutilisé un identifiant pour une autre opération : bogue client à signaler, jamais à « corriger » côté serveur). |
| AG-05 | DOIT | Requête identique **en cours** d'exécution (deux arrivées simultanées, ex. cloud + LAN) ⇒ la seconde attend la fin de la première (verrou sur l'identifiant, ≤ 30 s) puis applique AG-03 ; à défaut, `IDEMPOTENCE_IN_PROGRESS` (erreur « réessayable »). |
| AG-06 | DOIT | Empreinte = SHA-256 du JSON canonique de l'`input` **hors** `client_request_id` (clés triées, sans espaces), calculée par l'agent. |
| AG-07 | DOIT | Rétention minimale : 7 jours ; purge quotidienne au-delà (tâche de fond de l'agent). |
| AG-08 | DOIT | Les contrôles de droits (`X-Druxamed-User`, mode strict) s'appliquent **avant** la lecture du journal : un rejeu par un autre utilisateur que l'auteur initial est refusé (`FORBIDDEN`). |
| AG-09 | DEVRAIT | Annoncer la capacité `idempotence-v1` (voir 3.6) pour que les clients n'envoient l'identifiant qu'aux agents qui le comprennent. |

### 3.3 Table du journal

Première addition au schéma des dossiers : une table **préfixée** que le Delphi ignore, créée par l'agent au
premier usage (`CREATE TABLE IF NOT EXISTS`), sans toucher aux tables existantes.

```sql
CREATE TABLE IF NOT EXISTS gc_requete_idempotente (
  client_request_id CHAR(36)     NOT NULL PRIMARY KEY,
  commande          VARCHAR(64)  NOT NULL,          -- ex. CreateVente
  empreinte         CHAR(64)     NOT NULL,          -- SHA-256 hex de l'input canonique
  user_id           INT          NULL,              -- auteur (jeton utilisateur)
  statut            ENUM('en_cours','termine') NOT NULL,
  reponse           MEDIUMTEXT   NULL,              -- JSON renvoyé au client
  cree_le           DATETIME     NOT NULL,
  termine_le        DATETIME     NULL,
  KEY ix_cree_le (cree_le)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

> **Décision à valider (question Q1)** : si l'ajout d'une table dans les bases Delphi est exclu, l'alternative
> est un journal local à l'agent (SQLite) — mais il n'est pas transactionnel avec MariaDB : un arrêt brutal
> entre les deux écritures peut alors produire un doublon. Cette alternative **réduit** le risque sans
> l'éliminer ; elle doit être explicitement acceptée.

### 3.4 Commandes concernées

| Priorité | Commandes |
|---|---|
| **P0** (comptoir, encaissement) | `CreateVente`, `AddReglementClient`, **`CreateVenteEncaissee`** (nouvelle, 3.5) |
| P1 (pièces, stock, trésorerie) | `CreateAchat`, `AddReglementFournisseur`, `ReglerClient`, `ReglerFournisseur`, `AddAvanceClient`, `AddAvanceFournisseur`, `AddEncaissement`, `AddDecaissement`, `TransfertCompte`, `CreateBonEntree`, `CreateBonSortie`, `TransfertStock`, `CloturerCaisse`, `CreerRetourVente`, `CreerRetourAchat`, `TransformerVente`, `TransformerAchat`, `GrouperBL`, `MarquerEcheancePayee` |
| P2 | `Create*` des référentiels et des tiers (doublon gênant mais sans effet de stock ni de caisse) |

Noms = opérations GraphQL utilisées par l'app ; le nom de la commande du bridge peut différer [supposé].

Les `Update*` et `Delete*` ne sont pas concernés en phase 1 (rejouer la même modification est sans effet
cumulatif) ; ils **peuvent** accepter `client_request_id` et l'ignorer.

### 3.5 Commande atomique `CreateVenteEncaissee`

| ID | Niveau | Exigence |
|---|---|---|
| AG-10 | DOIT | Nouvelle commande : création de la pièce **et** de son règlement dans **une seule transaction**. Échec de l'un ⇒ rien n'est écrit. |
| AG-11 | DOIT | Mêmes contrôles de droits que `CreateVente` + `AddReglementClient` réunis ; mêmes règles de calcul (timbre, remises, plafonnement du règlement au net à payer). |
| AG-12 | DOIT | Idempotente (AG-01 à AG-08). |
| CL-01 | DOIT | Champ proxy `createVenteEncaissee(input: JSON!): JSON!` et `case 'CreateVenteEncaissee'` dans le bridge (pattern `docs/03` §5). Délai : classe « normale » (30 s). |

Entrée (extension de l'`input` actuel de `createVente`) :

```json
{
  "client_request_id": "6f1c2a4e-8b0d-4c55-9a51-0d3c5e7f9a21",
  "type_doc": "BCT", "code_cli": null, "date": "2026-11-01",
  "mode_payement": "Espece", "remise": 0, "timbre": false,
  "user_id": 3, "user_name": "caisse1",
  "lignes": [ { "code_article": "DOL500", "qte": 1, "prix_ht": 120, "tva": 19, "n_lot": "L2401" } ],
  "reglement": { "montant": 142.8, "mode_payement": "Espece", "compte": "CAISSE 1", "compte_id": 4 }
}
```

Sortie :

```json
{
  "vente": { "id": 1532, "numero": "BCT-001532", "net_a_payer": 142.8, "regler": 142.8, "reste_a_payer": 0 },
  "reglement": { "id": 8810, "montant": 142.8 },
  "rejoue": false
}
```

`reglement` absent ou `montant` = 0 ⇒ vente sans règlement (vente à crédit), toujours atomique et idempotente.

### 3.6 Annonce des capacités

| ID | Niveau | Exigence |
|---|---|---|
| AG-13 | DOIT | L'agent publie dans son heartbeat la liste `capacites` (ex. `["idempotence-v1", "vente-encaissee-v1"]`) et sa version. |
| CL-02 | DOIT | `myAgents` renvoie `capacites: [String!]` et `version` pour chaque agent. Un agent ancien ⇒ liste vide. |

L'app n'envoie `client_request_id` et n'appelle `createVenteEncaissee` que si la capacité est annoncée :
l'ordre de déploiement devient libre et le retour arrière d'un agent est sans risque.

### 3.7 Codes d'erreur (phase 1)

| `extensions.code` | Émis par | Signification | Conduite de l'app |
|---|---|---|---|
| `AGENT_TIMEOUT` | cloud | l'agent n'a pas répondu dans le délai ; **la commande a pu s'exécuter** | résultat incertain : rejouer avec le **même** `client_request_id` (sûr grâce à AG-03) |
| `AGENT_OFFLINE` | cloud | l'agent n'est pas connecté ; la commande **n'a pas** été transmise | échec certain, message « agent hors ligne » |
| `IDEMPOTENCE_CONFLICT` | agent | identifiant réutilisé pour un autre contenu | erreur interne, journalisée, jamais rejouée |
| `IDEMPOTENCE_IN_PROGRESS` | agent | même requête en cours | réessayer après 1–2 s, même identifiant |

| ID | Niveau | Exigence |
|---|---|---|
| CL-03 | DOIT | Distinguer `AGENT_TIMEOUT` (commande transmise, pas de réponse) de `AGENT_OFFLINE` (commande non transmise) — aujourd'hui les deux remontent sous forme de message libre [supposé]. |

### 3.8 Recette phase 1

1. Envoyer deux fois la même `CreateVenteEncaissee` (même identifiant) : **une** pièce, **un** règlement,
   stock décrémenté **une** fois ; la seconde réponse est identique avec `rejoue: true`.
2. Même identifiant, quantité différente : `IDEMPOTENCE_CONFLICT`, rien d'écrit.
3. Deux envois simultanés (même identifiant) : une seule écriture ; l'autre réponse est le rejeu.
4. Couper le réseau de l'agent après réception de la commande (avant la réponse) : le cloud renvoie
   `AGENT_TIMEOUT` ; au retour, le rejeu renvoie la pièce créée, sans doublon.
5. Forcer une erreur sur le règlement (compte inexistant) : ni pièce ni règlement.
6. Rejeu par un autre utilisateur du dossier : `FORBIDDEN`.
7. Au-delà de 7 jours : le journal est purgé ; un rejeu tardif est traité comme une nouvelle requête
   (comportement documenté, cas non attendu en pratique).
8. Ancien client sans `client_request_id` : comportement strictement identique à aujourd'hui ; Delphi
   inchangé (la table préfixée ne gêne pas ses écrans ni ses sauvegardes).

---

## 4. Phase 2 — Sessions, jetons, appairage

### 4.1 Conflit de session explicite

| ID | Niveau | Exigence |
|---|---|---|
| CL-10 | DOIT | En cas d'`agent_conflit`, `loginWithAgent` renvoie aussi `conflit: { deviceName, platform, depuis }` de la session en place, pour que l'app nomme le poste qui sera déconnecté. |
| CL-11 | DOIT | La session évincée par `force` reçoit, à sa requête suivante, `extensions.code = SESSION_REPLACED` avec `deviceName` du nouveau poste (et non un `UNAUTHENTICATED` muet). |
| CL-12 | DEVRAIT | Journaliser chaque `force` (compte, agent, poste évincé, poste entrant, horodatage) et l'afficher dans l'app d'administration. |

### 4.2 Appairage à usage unique et jetons par poste

| ID | Niveau | Exigence |
|---|---|---|
| CL-13 | DOIT | Code d'appairage **à usage unique**, valable 10 min, généré à la demande depuis le tray. Une fois consommé, il est invalide. |
| CL-14 | DOIT | L'appairage émet un jeton **propre au poste** (`deviceId`, `deviceName` saisis à l'appairage), listé et **révocable individuellement** dans l'app d'administration (fiche agent → « Postes appairés »). |
| CL-15 | DOIT | La clé `k` actuelle (secret partagé de l'officine) n'est plus acceptée pour de nouveaux appairages une fois la phase déployée ; les postes déjà appairés continuent jusqu'à leur révocation ou leur expiration (30 j). |
| TR-01 | DOIT | Tray : « Appairer un poste » affiche un QR et un code, et propose « Enregistrer le fichier d'appairage » (`.druxamed-pairing`, déjà lu par l'app). |
| TR-02 | DOIT | Format v2 : `{ "v": 2, "u": "<compte>", "c": "<code à usage unique>", "a": "<agentId>", "exp": "<ISO 8601>", "lan": ["https://192.168.1.20:8443"], "fp": "<sha256>" }`. `lan` et `fp` sont vides tant que la phase 3 n'est pas livrée. L'app accepte v1 et v2. |

### 4.3 JWT asymétriques et JWKS (prérequis du mode LAN)

| ID | Niveau | Exigence |
|---|---|---|
| CL-16 | DOIT | Signer les JWT en asymétrique (EdDSA Ed25519 de préférence, RS256 accepté) avec un `kid`. |
| CL-17 | DOIT | Publier les clés publiques sur `GET https://api.druxamed.com/.well-known/jwks.json` (cache 1 h). |
| CL-18 | DOIT | Rotation : nouvelle clé publiée 7 jours avant usage ; ancienne conservée 7 jours après. |
| CL-19 | DOIT | Claims minimaux : `sub` (compte), `agentId`, `sid` (identifiant de session révocable), `deviceId`, `iat`, `exp`. |
| CL-20 | DOIT | Compatibilité : les jetons HS256 existants restent acceptés par le cloud jusqu'à leur expiration ; les apps mobiles actuelles continuent de fonctionner sans mise à jour. |

### 4.4 Recette phase 2

1. Deux postes, même compte : le second voit « Ce compte est ouvert sur **CAISSE-1** depuis 08:12 » ; après
   `force`, le premier affiche « Session ouverte sur **CAISSE-2** » (code `SESSION_REPLACED`).
2. Un code d'appairage utilisé deux fois : refus au second usage ; un code de plus de 10 min : refus.
3. Révocation d'un poste dans l'administration : ce poste est déconnecté à sa requête suivante, les autres
   non.
4. Jeton signé par une clé retirée du JWKS : refusé ; rotation de clé sans interruption de service.
5. App mobile non mise à jour : connexion et vente inchangées.

---

## 5. Phase 3 — Mode LAN (LAN prioritaire, cloud en secours)

### 5.1 Endpoint local de l'agent

| ID | Niveau | Exigence |
|---|---|---|
| AG-20 | DOIT | Serveur HTTPS sur le port **8443** (configurable dans `agent.config.json`), à l'écoute des interfaces du réseau local uniquement. |
| AG-21 | DOIT | `GET /health` **sans authentification** : `{ agentId, version, fp, capacites, heure }` — rien d'autre (ni dossier, ni compte). |
| AG-22 | DOIT | `POST /graphql` exposant **exactement le même schéma** que le proxy cloud (mêmes noms de champs, `JSON!`), en réutilisant le routage du bridge gRPC (`grpc-bridge.service.ts`) : les écrans de l'app ne changent pas. |
| AG-23 | DOIT | Mêmes en-têtes et mêmes contrôles que via le cloud : `Authorization: Bearer` (JWT cloud vérifié hors ligne, 5.3), `X-Druxamed-Dossier`, `X-Druxamed-User`. Aucune requête métier sans jeton valide. |
| AG-24 | DOIT | CORS : origines de l'app desktop (`file://`, `app://`) et méthodes `GET, POST, OPTIONS` ; en-têtes autorisés = ceux du cloud. |
| AG-25 | DOIT | Corps limité à 10 Mo ; limitation de débit par adresse IP (ex. 50 req/s) ; journal des accès (poste, utilisateur, commande, durée, code). |
| AG-26 | DOIT | Mêmes codes d'erreur que le cloud (`ACCOUNT_BLOCKED`, `SUBSCRIPTION_*`, `UNAUTHENTICATED`, phase 1…), pour que l'app ait un seul traitement. |

### 5.2 TLS et empreinte

| ID | Niveau | Exigence |
|---|---|---|
| AG-27 | DOIT | Certificat auto-signé généré à l'installation : clé EC P-256, validité 10 ans, SAN = adresses IP locales + `agent-<agentId>.local`. Clé privée dans le dossier de données de l'agent, lisible par son seul compte de service. |
| AG-28 | DOIT | Empreinte SHA-256 du certificat (`fp`) publiée dans le heartbeat, dans `/health` et dans le code d'appairage v2. |
| AG-29 | DOIT | Rotation : nouveau certificat annoncé au cloud ; l'app ne l'accepte que s'il lui parvient par `myAgents` (canal cloud authentifié) — jamais par simple présentation sur le LAN. |
| — | — | Côté app (pour information) : épinglage dans le processus principal Electron (`setCertificateVerifyProc`), **jamais** de « confiance au premier usage » silencieuse. |

### 5.3 Vérification des jetons hors ligne

| ID | Niveau | Exigence |
|---|---|---|
| AG-30 | DOIT | Mettre en cache le JWKS du cloud (rafraîchi toutes les 6 h et à chaque reconnexion gRPC) et vérifier localement signature, `exp`, `agentId` = lui-même, `sid` non révoqué. |
| AG-31 | DOIT | Tolérance d'horloge ±5 min ; au-delà, refuser avec `CLOCK_SKEW` et signaler l'écart dans le tray (exige NTP sur le PC de l'agent, voir OP-02). |
| AG-32 | DOIT | Liste de révocation (`sid`, `deviceId`) reçue du cloud par le flux gRPC, persistée localement, appliquée sur les deux routes. |

### 5.4 Statut d'abonnement signé et période de grâce

| ID | Niveau | Exigence |
|---|---|---|
| CL-30 | DOIT | Le cloud pousse à l'agent, à la connexion gRPC puis toutes les 6 h, un statut signé : `{ agentId, statut: "actif"\|"suspendu"\|"bloque"\|"expire", valideJusqua, emisLe, kid, signature }`. |
| AG-33 | DOIT | Statut valide (signature + `valideJusqua` non dépassé, TTL 72 h) ⇒ appliquer tel quel : `bloque` / `suspendu` / `expire` ⇒ mêmes refus que le cloud. |
| AG-34 | DOIT | Statut périmé (cloud injoignable depuis plus de 72 h) ⇒ **mode grâce** pendant N jours (Q4, défaut proposé : 7) : lectures et ventes autorisées, chaque réponse porte `extensions.avertissement = "ABONNEMENT_NON_VERIFIE"` avec le nombre d'heures depuis la dernière vérification. Au-delà de la grâce : refus `SUBSCRIPTION_UNVERIFIED`. |
| CL-31 | DOIT | Un blocage décidé dans l'administration est poussé immédiatement aux agents connectés. |

### 5.5 Découverte et publication de l'adresse

| ID | Niveau | Exigence |
|---|---|---|
| AG-35 | DOIT | Heartbeat enrichi : `lanUrls` (une URL par interface locale active), `port`, `fp`, `capacites`, `version`, compteurs d'usage LAN (requêtes, postes distincts sur 24 h). |
| CL-32 | DOIT | `myAgents` renvoie `lanUrls: [String!]`, `certFingerprint: String`, `capacites`, `derniereVueLan`. |
| AG-36 | PEUT | Annonce mDNS / DNS-SD `_druxamed-agent._tcp.local` avec TXT `agentId`, `fp` (utile quand l'adresse IP change par DHCP). |
| TR-03 | DOIT | L'installeur du tray crée la règle du pare-feu Windows pour le port 8443, **profil « Privé » uniquement** ; le tray affiche l'adresse LAN, l'empreinte et un indicateur « Accès réseau local actif ». |
| TR-04 | DEVRAIT | Le tray signale un port occupé, un pare-feu tiers bloquant ou une horloge décalée, avec la marche à suivre. |

### 5.6 Recette phase 3

1. Depuis un poste du réseau : `curl -k https://<ip>:8443/health` renvoie `agentId` et `fp` ; `POST /graphql`
   sans jeton ⇒ `UNAUTHENTICATED`.
2. **Internet coupé**, agent joignable en LAN : connexion d'un poste déjà appairé, vente encaissée,
   impression, consultation des listes, sans dégradation ; latence d'un scan < 100 ms.
3. Internet rétabli : l'app reste en LAN tant que le LAN répond ; agent éteint : bascule cloud, puis
   « Agent hors ligne » et comptoir bloqué.
4. Jeton révoqué dans l'administration : refusé en LAN dès la réception de la liste (≤ 1 min si l'agent est
   connecté au cloud).
5. Agent coupé du cloud 73 h : avertissement `ABONNEMENT_NON_VERIFIE` ; au-delà de la grâce : refus.
6. Certificat présenté avec une empreinte différente de celle publiée : l'app refuse la route LAN et reste
   sur le cloud (test d'interception).
7. Changement de dossier et droits identiques sur les deux routes (`X-Druxamed-Dossier`, `loginDossierUser`).
8. Deux postes sur le même agent, chacun en LAN : aucune éviction (sessions par poste, phase 2).
9. Même `client_request_id` envoyé par le cloud puis par le LAN : une seule écriture (AG-05).

---

## 6. Phase 4 (optionnelle) — D-lite comptoir

Pour mémoire, à n'engager que si le terrain montre des arrêts fréquents du **PC de l'agent** (le mode LAN
couvre les coupures d'Internet) : l'app conserve les tickets « à transmettre » (déjà persistés localement),
les rejoue avec leur `client_request_id` au retour de l'agent, qui attribue alors la numérotation. Repose
entièrement sur la phase 1 ; aucune exigence supplémentaire côté cloud.

---

## 7. Exploitation

| ID | Niveau | Exigence |
|---|---|---|
| OP-01 | DOIT | Activer `exiger_jeton_utilisateur` sur tous les agents une fois les clients à jour (`docs/07` §6). |
| OP-02 | DOIT | NTP actif sur les PC des agents (prérequis AG-31, AG-34). Le tray vérifie l'écart au démarrage. |
| OP-03 | DOIT | Signature de code des installeurs (certificat Authenticode, `publisherName` dans electron-builder) et manifestes de mise à jour signés ; hébergement des mises à jour séparé de l'API si possible. |
| OP-04 | DEVRAIT | Restreindre la clé SSH utilisée par la CI au seul dépôt des fichiers de mise à jour. |
| OP-05 | DEVRAIT | Tableau de bord d'administration : version et capacités de chaque agent, postes appairés, journal des `force`, dernière vérification d'abonnement. |

## 8. Compatibilité et ordre de déploiement

1. **Agent d'abord** (phase 1) : il accepte `client_request_id` et la nouvelle commande, et l'annonce dans
   ses capacités. Sans client à jour, rien ne change.
2. **Cloud** : champ proxy `createVenteEncaissee`, `capacites` dans `myAgents`, codes `AGENT_TIMEOUT` /
   `AGENT_OFFLINE`.
3. **App** : n'utilise les nouveautés que pour les agents qui les annoncent ; un agent revenu à une version
   antérieure repasse automatiquement sur l'ancien flux.
4. Phases 2 et 3 : même principe (capacités `appairage-v2`, `lan-v1`, `jwks-v1`) ; jetons HS256 acceptés
   pendant la transition (CL-20).

Retour arrière : chaque dépôt peut revenir à sa version précédente sans opération sur les données ; la table
`gc_requete_idempotente` peut rester en place (ignorée).

## 9. Ce que l'app fera à la livraison (pour information)

| Phase | Changement côté app |
|---|---|
| 1 | UUID par ticket (comptoir) et par pièce (éditeurs), conservé jusqu'à réponse définitive ; `createVenteEncaissee` au comptoir ; rejeu automatique **sûr** après `AGENT_TIMEOUT` ; suppression de l'heuristique « ventes du jour » devenue inutile. |
| 2 | Nom du poste dans le conflit ; message `SESSION_REPLACED` ; appairage v2 (QR, fichier, code à usage unique). |
| 3 | Routeur LAN / cloud avec sondes `/health`, épinglage de l'empreinte dans le processus principal, badge « LAN » / « Cloud », Diagnostic LAN, Paramètres › Connexion. |

## 10. Questions à trancher avant développement

| # | Question | Proposition par défaut |
|---|---|---|
| Q1 | Une table préfixée `gc_` peut-elle être ajoutée aux bases des dossiers ? | Oui (seule option sans risque résiduel de doublon). |
| Q2 | L'agent expose-t-il déjà un port GraphQL local (`docs/08` mentionne une API locale) ? | À vérifier : conditionne l'effort de la phase 3. |
| Q3 | Nature exacte de la clé `k` actuelle et nombre de postes qui la partagent. | Considérée comme secret d'officine ; remplacée par CL-13 / CL-14. |
| Q4 | Durée de grâce hors cloud en cas de statut non vérifiable. | 7 jours, avec avertissement dès 72 h. |
| Q5 | Données de santé nominatives dans les dossiers (ordonnances, chifa) ? | Si oui, la route LAN devient une exigence de conformité (loi 18-07). |
| Q6 | Durée de vie du jeton utilisateur du dossier (`user_token`). | Ré-identification quotidienne du caissier, comme le Delphi. |
| Q7 | Budget et identité pour la signature de code (OP-03). | Certificat Authenticode OV au nom de SOFTLY. |
