# Parité chiffrée avec le desktop Delphi

> Campagne du 26/08/2026 sur le dossier réel **« BON 2026 »** (2036 articles, 279 clients,
> 80 fournisseurs, 915 pièces de vente 2026). Méthode : exécuter en SQL direct la requête de
> référence du Delphi (`sos-agent/docs/SQL-GESTION-COMMERCIALE.md`, extraite de `ConstSql.pas`
> et des unités `EtatClients.pas` / `StatFournisseurs.pas` / `StatArticles.pas`), puis comparer
> au chiffre renvoyé par l'app via cloud → agent.

## Résultats

| Domaine | Référence Delphi | App (cloud→agent) | Verdict |
|---|---|---|---|
| **Solde client** 007 | 2 719 815,17 | 2 719 815,1735 | ✅ |
| **Solde client** 033 | 3 029 221,52 | 3 029 221,5191 | ✅ |
| **Solde client** 035 | 2 403 719,68 | 2 403 719,6761 | ✅ |
| **Solde client** 070 | 1 900 019,76 | 1 900 019,7625 | ✅ |
| **Solde client** 131 | 2 076 671,89 | 2 076 671,8924 | ✅ |
| **CA TTC 2026** (avoirs nettés) | 126 814 418,55 | 126 814 418,55 | ✅ |
| **Créances** (total / clients / factures) | 51 607 966,11 / 115 / 497 | idem | ✅ |
| **Solde fournisseur** 031 | 1 641 341,04 | 1 641 341,0365 | ✅ |
| **Valeur du stock au PMP** | 18 832 942,74 | 18 832 942,74 | ✅ |
| **Trésorerie — solde global** | 83 284 565,38 | 83 284 565,38 | ✅ *après correctif* |

Les écarts résiduels sont des décimales de présentation (le SQL de référence est arrondi à 2,
l'app renvoie 4 décimales) — aucune divergence de calcul.

## Bugs trouvés et corrigés par cette campagne

### 1. Trésorerie — signes de règlements inversés (grave)
`getSoldesComptes`, `getTresorieComplete` et `getSoldesCaisse` appliquaient à
`reglemntfournisseur` la convention de signe de `reglemntclient` et inversement — le piège de
nommage hérité de SOS/POS (`reglemntfournisseur` = paiements **reçus des clients**,
`reglemntclient` = paiements **émis aux fournisseurs**).

Conséquences : **tous les soldes de comptes avaient le signe inverse** (« Caisse Magasin » à
−82 M au lieu de +82 M), les encaissements clients apparaissaient en sortie et les paiements
fournisseurs en entrée. Corrigé dans les trois requêtes, avec commentaire explicite.

### 2. Noms des tiers absents (visible partout)
Sur les bases réelles, `clients.nom` et `fournisseurs.nom` sont **vides** (279/279 et 80/80) :
le nom est dans `raison` — ce qu'utilise le SQL Delphi. L'agent lisait `nom` dans la liste des
clients, la fiche (`nom_client`), les règlements, la caisse, les achats et les stats achats.

Conséquences : listes sans nom, **recherche par nom inopérante**, fiches et documents imprimés
sans identité du tiers. Corrigé partout par `COALESCE(NULLIF(TRIM(raison),''), nom)`.

## Campagne du 02/11/2026 — états ligne à ligne

> Méthode : pour chaque état, le **SQL exact du Delphi** (extrait de `ConstSql.pas`, `servermodule.dfm` et des
> unités `StatVentes.pas`, `StatAchats.pas`, `Statistique104.pas`, `Benefices.pas`, `EtatPaiements.pas`,
> `RecouverementForm.pas`, `JournalVentes.pas`, `journalAchats.pas`) est exécuté sur la base, puis comparé à la
> commande de l'agent **sur la même base**, clé par clé (client, article, mois, ligne…). Lecture seule.
> Scripts rejouables : `sos-agent/test/parite/` (voir son README). Dossiers : `bon 2026` (référence), `bon 2025`,
> `bon 2024`, et — pour les factures, absentes de `bon *` — `overlab 2025`, `overlab2024`, `facture 2024/2025`.

| État | Source Delphi | Résultat |
|---|---|---|
| Relevé client (ligne à ligne) | `servermodule.dfm` › `EtatClients` | ✅ 201 clients, 3 284 lignes de chaque côté, même solde (5 dossiers) |
| Relevé fournisseur | `servermodule.dfm` › `EtatFournisseurs` | ✅ soldes identiques (5 dossiers) |
| Ventes par article / client / famille | `StatVentes.pas` | ✅ 1 110 / 172 / 10 lignes, 0 écart (6 dossiers) |
| Achats par période / article | `StatAchats.pas` | ✅ 0 écart |
| Achats par fournisseur | `StatAchats.pas` | ✅ après correctif (TTC par les lignes) |
| Bénéfices | `StatVentes.pas` | ✅ écart 0,00 sur 11 mois — voir « Choix » pour `Benefices.pas` |
| États de paiement | `EtatPaiements.pas` | ✅ 168 clients, 285 296 465,12 (1 centime d'arrondi) |
| Stat 104 | `Statistique104.pas` | ✅ après correctif (4 dossiers avec factures) |
| Recouvrement | `RecouverementForm.pas` | ✅ en mode `delphi` (8 cas) — le mode par défaut est volontairement différent |
| Journal des ventes | `JournalVentes.pas` | ✅ 8 309 lignes, aucune absente ni en trop (6 dossiers) |
| Journal des achats | `journalAchats.pas` | ✅ 3 794 lignes (7 dossiers) |
| Avances clients / fournisseurs | `ConstSql.pas` | ⚠️ même filtre ; une seule avance existe (fournisseur, `khal`/`khlil`) |
| Recalcul du stock | `UpdateAllArticlesStockOptimized` | ✅ sur copie : aucun des 2 246 articles ne change, valeur 25 315 477,18 |

### Défauts trouvés et corrigés (sos-agent, branche `claude/acces-reseau-local`)

1. **Stat 104 excluait les factures de regroupement** (`e03e856`) : le filtre `grouped = 0` retirait les factures
   `Type 5` / `grouped = 1` (3 661 960,49 TTC sur `overlab 2025`, 4 clients). Le Delphi les compte.
2. **Jointures en double sur `Code`** (`e03e856`, `cc592de`, `2fe51ac`) : `clients.Code` et `fournisseurs.Code` ne sont
   pas uniques dans les dossiers issus du Delphi ; `LEFT JOIN clients c ON c.Code = …` comptait deux fois chaque pièce
   (Stat 104, recouvrement, achats par fournisseur). Les jointures prennent maintenant un seul tiers par code.
3. **Achats par fournisseur** (`2fe51ac`) : TTC calculé sur le total d'en-tête (timbre inclus, parfois ≠ somme des
   lignes) au lieu des lignes × (1 − remise %) comme `StatAchats.pas` (−196 DA sur `bon 2026`, −553 DA sur `bon 2025`).
4. **Recouvrement** (`cc592de`) : nouveau mode `mode: 'delphi'` (résumé par client, détail par pièce) qui reproduit
   le formulaire. Exposé de bout en bout : arguments `mode`, `annee`, `code_cli`, `detail` ajoutés au schéma
   `recouvrement(...)` de `sos-cloud-server`, copie de l'agent régénérée, et l'écran Tiers › Recouvrement de l'app
   propose « Solde client » ou « Comme le logiciel de bureau » (par client / par pièce, impression et export CSV ;
   modèles livrés `integre-recouvrement-bureau` et `integre-recouvrement-bureau-pieces`).

5. **`getSoldeClient` et les codes clients en double** : il ne lisait que la première fiche du code, donc ratait le
   crédit initial de l'autre (`facture 2025`, client 060 : 14 442 080,43 contre 15 331 336,88 pour le relevé et le
   recouvrement). Il additionne maintenant le crédit initial de toutes les fiches du code, comme le relevé. Vérifié
   sur 7 dossiers (script `14-solde-client.js`).

### Choix assumés (écarts volontaires avec le Delphi)

- **Règlement sur une pièce sans numéro** (devis, Type 3) : la liste des soldes du Delphi (`EtatClients.pas`) le
  compte, son relevé (`servermodule.dfm`) l'ignore. L'agent reproduit chacun des deux écrans (2 clients dans
  `overlab2024`) ; ce n'est pas un défaut de l'agent mais une incohérence du logiciel de bureau.

- **Stat 104 retranche les avoirs liés à une facture** ; le Delphi (`WHERE code IS NOT NULL`) les ignore
  (exemple : `bon 2025`, −18 571). À confirmer par le propriétaire.
- **Bénéfices suivent `StatVentes.pas`** (avoirs nettés, `Net_HT`). `Benefices.pas` les ignore et utilise `Total_HT` ;
  la différence s'explique exactement par les avoirs (7 512 495,19) et les remises (2 229 487,72) sur `bon 2026`.
- **Recouvrement par défaut = solde client** (crédit initial, avoirs, pièces trop payées) : 157 clients et
  75 523 447,82 contre 69 et 20 614 305,45 pour le formulaire Delphi, qui ne somme que le reste à payer des
  factures et BL.
- **Règlements sans `uuid`** : le Delphi fusionne ceux d'un même jour en une ligne, l'agent les garde séparés
  (soldes identiques ; 57 règlements concernés dans `overlab2024`, aucun dans `bon 2026/2025`).
- **Stock** : la procédure plafonne à 0, `ficheStock` montre l'arithmétique brute (AR489 : −1 contre 0).

### Reste à faire / à surveiller

- Jointures encore sensibles aux codes en double : journal des achats et listes d'avances (aucun cas réel pour
  vérifier une correction).
- Avances clients : aucune donnée réelle (aucune avance cliente dans les bases du poste).
- Stat 104 sur le dossier de production : `bon *` n'a pas de facture, confirmer sur un dossier qui en a.
- Le filtre de dates de la fenêtre Stat 104 du Delphi semble défectueux (second `where` après `WHERE code IS NOT NULL`,
  colonne `FFDate` inexistante dans `vente`) — lu dans le code, non exécuté.
