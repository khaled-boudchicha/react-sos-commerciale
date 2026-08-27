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

## Ce qui reste à couvrir

- Relevés détaillés ligne à ligne (client / fournisseur) vs le PDF Delphi
- Statistiques par article / client / famille, bénéfices, achats
- États de paiement, avances, Stat 104
- Recalcul complet du stock après clôture d'inventaire
