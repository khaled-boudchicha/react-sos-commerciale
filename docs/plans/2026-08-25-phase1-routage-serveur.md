# Phase 1 — Routage serveur (P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer bout-en-bout (cloud → agent) les opérations qui existent déjà dans les services de l'agent mais ne sont pas routées : CRUD articles, lots, tarifs, codes-barres, alertes, recalcul stock, fiches unitaires (charge, centre de coût, commercial), trésorerie simple, catégories de charges, createInventaire — et corriger le bug `type_doc` de `facturesNonReglees`.

**Architecture:** Aucun nouveau module. Trois fichiers portent l'essentiel : le `switch` du bridge agent ([grpc-bridge.service.ts](/Volumes/Dev/SOFTLY/sos-agent/src/grpc/grpc-bridge.service.ts)), le schéma proxy cloud ([proxy.schema.gql](/Volumes/Dev/SOFTLY/sos-cloud-server/src/proxy/proxy.schema.gql)) et le résolveur proxy ([proxy.resolver.ts](/Volumes/Dev/SOFTLY/sos-cloud-server/src/proxy/proxy.resolver.ts)). Retours `JSON!` flat, payloads scalaires, convention `create*` input à plat / `update*` `{id, input}` / `delete*` `{id}`.

**Tech Stack:** NestJS + GraphQL schema-first (cloud), NestJS + Knex (agent). Vérification : `npm run build` (tsc) dans chaque projet. Pas de tests unitaires existants sur ces couches — la vérification fonctionnelle passe par `proxyRaw` et l'API locale agent (`127.0.0.1:47800/graphql`).

**Signatures agent vérifiées (2026-08-25):**
`articles.create(input)` · `articles.update(id, input)` · `articles.delete(id)` · `getLots(article_id)` · `getLotPrix(lot_id)` · `addLot(article_id, n_lot, date_peremption?, qte?)` · `deleteLot(lot_id)` · `getTarifs(code_article)` · `getPrixPourQte(code_article, qte, type_prix=1)` · `getPromotions(article_id)` · `getNomenclature(article_id)` · `calculerPrix({pmp,tva,margep?,marge?,tax_supp?,poids_unitaire?})` · `getBarcodes(article_id)` · `getAlertesStock()` · `getArticlesMargeNegative()` · `recalculerStock()` · `charges.findOne(id)` · `referentiels.getCentreCout(id)` · `tresorie.findAll({date_debut?,date_fin?,bank_id?,limit?,offset?})` · `etatClient.getFacturesNonReglees(code_cli, type_doc?)` (le param existe déjà).
Déjà dans le bridge (cloud seulement à compléter) : `GetTresorie`, `GetCategoriesCharges`, `CreateInventaire`, `GetCommercial`.

---

### Task 1: Agent — nouveaux cas du bridge

**Files:** Modify: `sos-agent/src/grpc/grpc-bridge.service.ts`

- [ ] **Step 1:** Après le cas `GetArticleParCodeBarre` (~l.95), insérer :

```ts
      // ── Articles CRUD / lots / tarifs / codes-barres / alertes ──────────
      case 'CreateArticle':
        return this.articles.create(payload);

      case 'UpdateArticle':
        return this.articles.update(Number(payload.id), payload.input || payload);

      case 'DeleteArticle':
        return this.articles.delete(Number(payload.id));

      case 'GetLots':
        return this.articles.getLots(Number(payload.article_id));

      case 'GetLotPrix':
        return this.articles.getLotPrix(Number(payload.lot_id));

      case 'AddLot':
        return this.articles.addLot(Number(payload.article_id), String(payload.n_lot), payload.date_peremption, payload.qte);

      case 'DeleteLot':
        return this.articles.deleteLot(Number(payload.lot_id));

      case 'GetTarifs':
        return this.articles.getTarifs(String(payload.code_article));

      case 'GetPrixPourQte':
        return this.articles.getPrixPourQte(String(payload.code_article), Number(payload.qte), payload.type_prix != null ? Number(payload.type_prix) : 1);

      case 'GetPromotions':
        return this.articles.getPromotions(Number(payload.article_id));

      case 'GetNomenclature':
        return this.articles.getNomenclature(Number(payload.article_id));

      case 'CalculerPrix':
        return this.articles.calculerPrix(payload);

      case 'GetBarcodes':
        return this.articles.getBarcodes(Number(payload.article_id));

      case 'GetAlertesStock':
        return this.articles.getAlertesStock();

      case 'GetArticlesMargeNegative':
        return this.articles.getArticlesMargeNegative();

      case 'RecalculerStock':
        return this.articles.recalculerStock();
```

- [ ] **Step 2:** Corriger `GetFacturesNonReglees` (transmettre `type_doc`) :

```ts
      case 'GetFacturesNonReglees':
        return this.etatClient.getFacturesNonReglees(payload.code_cli, payload.type_doc);
```

- [ ] **Step 3:** Après `GetCategoriesCharges`, ajouter `GetCharge` ; après `GetCentresCout`, ajouter `GetCentreCout` :

```ts
      case 'GetCharge':
        return this.charges.findOne(Number(payload.id));
```
```ts
      case 'GetCentreCout':
        return this.referentiels.getCentreCout(Number(payload.id));
```

- [ ] **Step 4:** `cd sos-agent && npm run build` → succès attendu (tsc sans erreur).

### Task 2: Cloud — schéma proxy

**Files:** Modify: `sos-cloud-server/src/proxy/proxy.schema.gql`

- [ ] **Step 1:** Dans la section Articles, compléter la query et ajouter les mutations :

```graphql
extend type Query {
  # ... existants ...
  lots(article_id: Int!): JSON!
  lotPrix(lot_id: Int!): JSON!
  tarifsArticle(code_article: String!): JSON!
  prixPourQte(code_article: String!, qte: Float!, type_prix: Int): JSON!
  promotions(article_id: Int!): JSON!
  nomenclature(article_id: Int!): JSON!
  barcodesArticle(article_id: Int!): JSON!
  alertesStock: JSON!
  articlesMargeNegative: JSON!
}

extend type Mutation {
  createArticle(input: JSON!): JSON!
  updateArticle(id: Int!, input: JSON!): JSON!
  deleteArticle(id: Int!): Boolean!
  addLot(article_id: Int!, n_lot: String!, date_peremption: String, qte: Float): JSON!
  deleteLot(lot_id: Int!): Boolean!
  calculerPrix(input: JSON!): JSON!
  recalculerStock: Boolean!
}
```

- [ ] **Step 2:** Trésorerie : `tresorie(date_debut: String, date_fin: String, bank_id: Int, limit: Int, offset: Int): JSON!` + `categoriesCharges: JSON!` + `charge(id: Int!): JSON` ; Inventaire : `createInventaire(input: JSON!): JSON!` ; Référentiels : `commercial(id: Int!): JSON` + `centreCout(id: Int!): JSON`.

### Task 3: Cloud — résolveur proxy

**Files:** Modify: `sos-cloud-server/src/proxy/proxy.resolver.ts`

- [ ] **Step 1:** Section Articles — ajouter queries/mutations (pattern existant, `this.p(u, 'Cmd', args)`) et corriger `facturesNonReglees` pour transmettre `type_doc` (`@Args() a: any` → `this.p(u,'GetFacturesNonReglees', a)`).
- [ ] **Step 2:** Ajouter `tresorie`, `categoriesCharges`, `charge`, `createInventaire`, `commercial`, `centreCout`.
- [ ] **Step 3:** `cd sos-cloud-server && npm run build` → succès.

### Task 4: Cloud — timeouts

**Files:** Modify: `sos-cloud-server/src/config/config.ts`

- [ ] Ajouter `'RecalculerStock'` à `commandTimeout.slow` et `'GetCategoriesCharges'` à `commandTimeout.fast`.

### Task 5: Docs & TODO

**Files:** Modify: `sos-agent/docs/AGENT-GRPC.md`, `gestion-commerciale-desktop/docs/04-TODO.md`

- [ ] Documenter les nouvelles commandes dans AGENT-GRPC.md (section « Ajouts 2026-08-25 »).
- [ ] Cocher les items Phase 1 dans 04-TODO.md.

### Vérification finale
- [ ] `npm run build` OK dans les deux projets.
- [ ] Cohérence nom commande bridge ↔ résolveur (grep croisé).
- [ ] Pas de commit (dépôts porteurs de modifications pré-existantes non liées ; commits à la demande de l'utilisateur).
