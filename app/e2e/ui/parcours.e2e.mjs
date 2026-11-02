// Parcours d'interface critiques (build de production + GraphQL simulé).
// Lancer : npm run test:ui   (construit dist/ puis exécute ce fichier avec node --test ; nommé *.e2e.mjs pour que vitest l’ignore)
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { demarrerServeur, droitsLimites, lancerNavigateur, ouvrir } from './harnais.mjs';

const ARTICLES = [
  { id: 1, code: 'DOL500', designation: 'Doliprane 500 mg', famille: 'Antalgiques', code_bare: '3400930000001', prix_vente_ht: 120, prix_vente_ht1: 110, prix_vente_ttc: 142.8, tva: 19, qte_reale: 240, pmp: 92.5, margep: 23.4 },
  { id: 2, code: 'AMOXI1G', designation: 'Amoxicilline 1 g', famille: 'Antibiotiques', code_bare: '3400930000002', prix_vente_ht: 845.5, prix_vente_ht1: 845.5, prix_vente_ttc: 1006.15, tva: 19, qte_reale: 3, pmp: 615.25, margep: 20.1 },
];
const AGENTS = { myAgents: [{ agentId: 'AG-01', label: 'Pharmacie Centrale', isOnline: true }] };

/** Réponses communes ; `extra` complète ou remplace par nom d'opération. */
const serveur = (extra = {}) => (op, v) => {
  if (op in extra) return typeof extra[op] === 'function' ? extra[op](v) : extra[op];
  switch (op) {
    case 'MyAgents': return AGENTS;
    case 'Articles': {
      const t = String(v.search ?? '').toLowerCase();
      return { articles: { data: ARTICLES.filter((a) => a.designation.toLowerCase().includes(t) || a.code.toLowerCase().includes(t)), total: 2 } };
    }
    case 'ArticleParCodeBarreComptoir': return { articleParCodeBarre: ARTICLES.find((a) => a.code_bare === v.code) ?? null };
    case 'Lots': return { lots: [] };
    case 'Ventes': return { ventes: { data: [], total: 0 } };
    default: return null;
  }
};

async function ajouterAuTicket(page, terme) {
  const champ = page.locator('#comptoir-scan');
  await champ.click();
  await champ.fill(terme);
  await page.waitForTimeout(700);
  await champ.press('Enter');
  await page.waitForTimeout(400);
}

let arreter, navigateur;
before(async () => { arreter = await demarrerServeur(); navigateur = await lancerNavigateur(); });
after(async () => { await navigateur?.close(); arreter?.(); });

describe('navigation', () => {
  test('les écrans chargés à la demande s’ouvrent depuis le menu', async () => {
    const page = await ouvrir(navigateur, { gql: serveur() });
    for (const [lien, titre] of [['#/statistiques', 'Statistiques'], ['#/tresorerie', 'Trésorerie'], ['#/referentiels', 'Référentiels'], ['#/echeances', 'Échéances clients']]) {
      await page.click(`a[href="${lien}"]`);
      await page.locator(`h1:has-text("${titre}")`).waitFor({ timeout: 8000 });
    }
    // Diagnostic : hors menu latéral (Paramètres, palette) — lien direct
    await page.evaluate(() => { window.location.hash = '#/diagnostic'; });
    await page.locator('h1:has-text("Diagnostic de connexion")').waitFor({ timeout: 8000 });
    assert.deepEqual(page.erreurs, []);
    await page.context().close();
  });
});

describe('accessibilité (axe-core, WCAG 2 A / AA), thèmes clair et sombre', () => {
  const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
  // Données minimales pour que chaque écran affiche son contenu réel (tableaux, onglets, graphiques)
  const donnees = serveur({
    Ventes: { ventes: { data: [{ id: 1, numero: 'FA-0001', type_doc: 'FA', date: '2026-11-01', raison: 'Client A', net_a_payer: 1200, regler: 0, reste_a_payer: 1200 }], total: 1 } },
    Achats: { achats: { data: [], total: 0 } },
    Clients: { clients: { data: [{ id: 1, code: 'C01', nom: 'Client A', solde: 100 }], total: 1 } },
    Referentiels: { familles: [{ id: 1, code: 'ANT', designation: 'Antalgiques' }], depots: [], banques: [], modesPayement: ['Espece'], tauxTVA: [19], unitesMesure: [] },
    SoldesComptes: { soldesComptes: [{ compte_id: 4, compte: 'CAISSE 1', solde: 1000 }] },
    DossierUsers: { dossierUsers: [{ id: 1, username: 'caisse1', typeuser: 'user' }] },
  });
  const ECRANS = [
    ['tableau de bord', '/'], ['ventes', '/ventes?type=FA'], ['achats', '/achats'], ['stock', '/stock'], ['tiers', '/tiers'],
    ['échéances', '/echeances'], ['trésorerie', '/tresorerie'], ['statistiques', '/statistiques'], ['référentiels', '/referentiels'],
    ['paramètres', '/parametres'], ['utilisateurs', '/parametres/utilisateurs'], ['mouvements de stock', '/stock/mouvements'],
    ['inventaires', '/stock/inventaires'], ['comptoir', '/comptoir'], ['éditeur de facture', '/ventes/nouvelle?type=FA'],
    ['éditeur d’achat', '/achats/nouvelle?type=BR'], ['diagnostic', '/diagnostic'], ['connexion', null],
  ];
  for (const theme of ['light', 'dark']) {
    for (const [nom, route] of ECRANS) {
      test(`${nom} (${theme === 'light' ? 'clair' : 'sombre'}) : aucune violation`, async () => {
        const page = await ouvrir(navigateur, { route: route ?? '/', gql: donnees, theme, ...(route ? {} : { session: null }) });
        // Injecté par le protocole du navigateur : la CSP de l'app interdit (à raison) les scripts en ligne
        await page.evaluate(AXE);
        const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } }))
          .violations.map((v) => `${v.id} (${v.impact}) : ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
        assert.deepEqual(violations, []);
        assert.deepEqual(page.erreurs, []);
        await page.context().close();
      });
    }
  }
});

describe('assistance', () => {
  test('Diagnostic : le rapport copié contient l’état du poste, sans aucun jeton', async () => {
    const page = await ouvrir(navigateur, { route: '/diagnostic', gql: serveur() });
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:4317' });
    await page.locator('h1:has-text("Diagnostic de connexion")').waitFor({ timeout: 8000 });
    await page.click('button:has-text("Copier le rapport")');
    await page.waitForTimeout(400);
    const texte = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(texte, /RAPPORT DE DIAGNOSTIC/);
    assert.match(texte, /Pharmacie Centrale/);
    assert.match(texte, /GC_TEST/);
    assert.doesNotMatch(texte, /jeton-test/);
    await page.context().close();
  });
});

describe('connexion', () => {
  test('jeton expiré : retour à la connexion avec une explication', async () => {
    const page = await ouvrir(navigateur, { gql: () => ({ erreurs: [{ message: 'jwt expired', extensions: { code: 'UNAUTHENTICATED' } }] }) });
    await page.locator('text=Votre session a expiré').waitFor({ timeout: 8000 });
    await page.context().close();
  });

  test('fichier d’appairage abîmé par une messagerie : la bonne clé est envoyée', async () => {
    const dossier = mkdtempSync(join(tmpdir(), 'gc-appairage-'));
    const fichier = join(dossier, 'code.druxamed-pairing');
    writeFileSync(fichier, 'Voici le code :\n{“u”:“pharma”, “k”:“CLE-SECRETE”, “a”:“AG-01”}\n');
    let cle = null;
    const page = await ouvrir(navigateur, { session: null, gql: (op, v) => {
      if (/ApiKey/i.test(op)) { cle = v.input?.apiKey; return { loginWithApiKey: { success: false, statut: 'agent_invalide' } }; }
      return null;
    } });
    await page.click('button:has-text("code d’appairage")');
    await page.setInputFiles('input[type="file"]', fichier);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(600);
    assert.equal(cle, 'CLE-SECRETE');
    await page.context().close();
  });
});

describe('comptoir', () => {
  test('Internet coupé : bandeau immédiat, encaissement suspendu', async () => {
    const page = await ouvrir(navigateur, { route: '/comptoir', gql: serveur() });
    await page.context().setOffline(true);
    await page.locator('[role="alert"]:has-text("Pas d’Internet")').waitFor({ timeout: 4000 });
    await page.context().setOffline(false);
    await page.context().close();
  });

  test('réponse perdue : aucun doublon, même après rechargement de la caisse', async () => {
    const etat = { echec: true, creations: 0, fantome: null };
    const page = await ouvrir(navigateur, { route: '/comptoir', gql: serveur({
      CreateVenteComptoir: () => {
        etat.creations++;
        if (etat.echec) { etat.echec = false; return { panne: true }; }
        return { createVente: { id: 500, numero: 'BCT-0500', net_a_payer: 1148.95 } };
      },
      Ventes: () => ({ ventes: { data: etat.fantome ? [etat.fantome] : [], total: etat.fantome ? 1 : 0 } }),
    }) });
    await ajouterAuTicket(page, 'doli');
    await ajouterAuTicket(page, 'amox');
    await page.keyboard.press('F11');
    await page.locator('text=n’a pas reçu de réponse').first().waitFor({ timeout: 6000 });
    await page.reload();
    await page.waitForTimeout(1200);
    await page.locator('text=les ventes du jour seront vérifiées').waitFor({ timeout: 6000 });
    etat.fantome = { id: 150, numero: 'BCT-000150', user_name: 'caisse1', net_a_payer: 1148.95, regler: 1148.95, reste_a_payer: 0 };
    await page.keyboard.press('F11');
    await page.locator('text=Ticket déjà enregistré ?').waitFor({ timeout: 6000 });
    assert.equal(etat.creations, 1, 'une seule création envoyée');
    assert.deepEqual(page.erreurs, []);
    await page.context().close();
  });

  test('Ctrl+Q : quantité calculée depuis un montant', async () => {
    const page = await ouvrir(navigateur, { route: '/comptoir', gql: serveur() });
    await ajouterAuTicket(page, 'doli');
    await page.keyboard.press('Control+q');
    await page.keyboard.type('500');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    assert.equal(await page.locator('input[aria-label*="uantit"]').first().inputValue(), '3,501');
    await page.context().close();
  });

  test('serveur injoignable : recherche servie par le cache local, signalée', async () => {
    let panne = false;
    const base = serveur();
    const page = await ouvrir(navigateur, { route: '/comptoir', gql: (op, v) => (panne ? { panne: true } : base(op, v)) });
    const champ = page.locator('#comptoir-scan');
    await champ.click();
    await champ.fill('li');
    await page.waitForTimeout(1200);
    await champ.fill('');
    panne = true;
    await champ.fill('doli');
    await page.locator('text=Hors ligne : articles déjà consultés').waitFor({ timeout: 8000 });
    await page.context().close();
  });
});

describe('impression', () => {
  test('aperçu chargé à la demande : état du stock rendu avec ses lignes, puis fermé', async () => {
    const page = await ouvrir(navigateur, { route: '/stock', gql: serveur({ Articles: { articles: { data: ARTICLES, total: 2 } } }) });
    await page.click('button:has-text("Imprimer l\'état du stock")');
    const apercu = page.locator('[role="dialog"][aria-label^="Aperçu"]');
    await apercu.waitFor({ timeout: 8000 });
    await apercu.locator('text=/2 lignes?/').waitFor({ timeout: 4000 });
    await apercu.locator('button[aria-label="Fermer"]').click();
    await apercu.waitFor({ state: 'detached', timeout: 4000 });
    assert.deepEqual(page.erreurs, []);
    await page.context().close();
  });

  test('modèles d’impression : la bibliothèque s’ouvre et prévisualise un modèle livré', async () => {
    const page = await ouvrir(navigateur, { route: '/modeles', gql: serveur() });
    const vignette = page.locator('button[aria-label^="Aperçu de "]').first();
    await vignette.waitFor({ timeout: 8000 });
    await vignette.click();
    await page.locator('[role="dialog"][aria-label^="Aperçu"]').waitFor({ timeout: 8000 });
    assert.deepEqual(page.erreurs, []);
    await page.context().close();
  });
});

describe('designer d’états', () => {
  const ouvrirDesigner = async () => {
    const page = await ouvrir(navigateur, { route: '/modeles', viewport: { width: 1440, height: 900 }, gql: serveur() });
    await page.locator('button:has-text("Personnaliser")').first().click();
    await page.locator('[aria-label="Designer d’états"]').waitFor({ timeout: 8000 });
    await page.waitForTimeout(500);
    return page;
  };

  test('modèle livré : déplacer puis annuler, clic droit, enregistrement sous un nouveau nom', async () => {
    const page = await ouvrirDesigner();
    const titre = page.getByText('FACTURE', { exact: true }).first();
    const avant = await titre.boundingBox();
    await page.mouse.move(avant.x + 30, avant.y + 10);
    await page.mouse.down(); await page.mouse.move(avant.x - 10, avant.y + 14, { steps: 8 }); await page.mouse.up();
    assert.ok(Math.abs((await titre.boundingBox()).x - avant.x + 40) < 3, 'objet déplacé');
    assert.match(await page.locator('[aria-label="Position et taille de la sélection"]').innerText(), /^X .* · L .* mm$/);
    await page.keyboard.press('Control+z');
    assert.ok(Math.abs((await titre.boundingBox()).x - avant.x) < 1, 'déplacement annulé');

    // Clic droit : actions de l'objet, Échap referme
    await page.mouse.click(avant.x + 30, avant.y + 10, { button: 'right' });
    const menu = page.locator('[role="menu"][aria-label="Actions"]');
    await menu.waitFor();
    for (const action of ['Modifier le contenu…', 'Copier', 'Dupliquer', 'Premier plan', 'Verrouiller', 'Supprimer']) {
      assert.equal(await menu.locator(`[role="menuitem"]:has-text("${action}")`).count(), 1, action);
    }
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'detached' });

    // Bande supprimée par le clic droit, rétablie par Ctrl+Z
    await page.locator('main [data-bande] >> text=Synthèse du rapport').first().click({ button: 'right' });
    await page.locator('[role="menuitem"]:has-text("Supprimer la bande")').click();
    assert.equal(await page.locator('main [data-bande] >> text=Synthèse du rapport').count(), 0);
    await page.keyboard.press('Control+z');
    assert.equal(await page.locator('main [data-bande] >> text=Synthèse du rapport').count(), 1);

    // Ctrl+K : la palette de l'application ne s'ouvre pas derrière le designer
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(200);
    assert.equal(await page.locator('[aria-label="Recherche globale"]').count(), 0);

    // Ctrl+S sur un modèle livré : demande un nom, jamais celui de l'original
    await page.keyboard.press('Control+s');
    const nom = page.locator('[role="dialog"][aria-label="Enregistrer le modèle"] input');
    assert.equal(await nom.inputValue(), 'Facture A4 — Moderne (personnalisé)');
    await page.keyboard.press('Enter');
    await page.locator('text=Facture A4 — Moderne (personnalisé).gcr ·').waitFor({ timeout: 4000 });
    await page.click('button:has-text("Retour")');
    await page.locator('[title="Facture A4 — Moderne (personnalisé)"]').waitFor({ timeout: 4000 });
    assert.deepEqual(page.erreurs, []);
    await page.context().close();
  });

  test('nouveau modèle : squelette standard prêt à imprimer', async () => {
    const page = await ouvrir(navigateur, { route: '/modeles', viewport: { width: 1440, height: 900 }, gql: serveur() });
    await page.click('button:has-text("Nouveau modèle")');
    const dialogue = page.locator('[role="dialog"][aria-label="Nouveau modèle"]');
    await dialogue.locator('input').first().fill('Bon de préparation');
    await dialogue.locator('button:has-text("Créer")').click();
    await page.locator('[aria-label="Designer d’états"]').waitFor();
    assert.equal(await page.locator('main [data-bande]').count(), 5);
    await page.keyboard.press('F5');
    const apercu = page.locator('[role="dialog"][aria-label^="Aperçu"]');
    await apercu.waitFor({ timeout: 8000 });
    await apercu.locator('text=BON DE PRÉPARATION').first().waitFor();
    await apercu.locator('text=/Page 1 \\/ 1/').first().waitFor();
    assert.deepEqual(page.erreurs, []);
    await page.context().close();
  });
});

describe('droits et saisie', () => {
  test('profil vendeur : ni PMP ni marge dans le stock', async () => {
    const page = await ouvrir(navigateur, {
      route: '/stock', droits: droitsLimites({ vente: ['Facture de Vente'], stock: ['Accés Article'] }),
      gql: serveur({ Articles: { articles: { data: ARTICLES, total: 2 } } }),
    });
    await page.locator('th:has-text("Désignation")').first().waitFor({ timeout: 8000 });
    assert.equal(await page.locator('th:has-text("PMP")').count(), 0);
    assert.equal(await page.locator('th:has-text("Marge")').count(), 0);
    await page.context().close();
  });

  test('facture en cours : quitter demande confirmation', async () => {
    const page = await ouvrir(navigateur, { route: '/ventes/nouvelle?type=FA', gql: serveur() });
    await page.getByLabel('Note').fill('Livraison urgente');
    await page.click('a[href="#/achats"]');
    await page.locator('text=Quitter sans enregistrer ?').waitFor({ timeout: 4000 });
    await page.click('button:has-text("Continuer la saisie")');
    assert.ok(page.url().includes('/ventes/nouvelle'));
    await page.context().close();
  });

  test('achat : les lots existants de l’article sont proposés, la péremption est reprise', async () => {
    const page = await ouvrir(navigateur, { route: '/achats/nouvelle?type=BR', gql: serveur({
      Lots: { lots: [{ id: 11, n_lot: 'L2401', date_peremption: '2027-03-31', qte: 40 }, { id: 12, n_lot: 'L2312', date_peremption: '2026-12-31', qte: 0 }] },
    }) });
    const recherche = page.getByPlaceholder(/Article/).first();
    await recherche.fill('doli');
    await page.waitForTimeout(800);
    await recherche.press('Enter');
    await page.waitForTimeout(800);
    const options = await page.locator('datalist option').evaluateAll((els) => els.map((e) => e.getAttribute('value')));
    assert.deepEqual(options.sort(), ['L2312', 'L2401']);
    const champ = page.locator('input[list^="lots-"]').first();
    await champ.fill('L2401');
    await page.waitForTimeout(300);
    assert.ok(await page.locator('input[type="date"][value="2027-03-31"], input[value="2027-03-31"]').count() > 0, 'péremption reprise');
    assert.deepEqual(page.erreurs, []);
    await page.context().close();
  });

  test('brouillon : une facture interrompue est proposée à la réouverture et reprise', async () => {
    const page = await ouvrir(navigateur, { route: '/ventes/nouvelle?type=FA', gql: serveur() });
    await page.getByLabel('Note').fill('Commande du Dr Benali');
    await page.waitForTimeout(1200); // enregistrement du brouillon (délai 0,8 s)
    await page.reload();
    await page.waitForTimeout(1200);
    await page.locator('text=Brouillon non enregistré').waitFor({ timeout: 6000 });
    await page.click('button:has-text("Reprendre")');
    assert.equal(await page.getByLabel('Note').inputValue(), 'Commande du Dr Benali');
    // Écarter le brouillon : il ne revient plus
    await page.getByLabel('Note').fill('');
    await page.waitForTimeout(1200);
    await page.reload();
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('text=Brouillon non enregistré').count(), 0);
    assert.deepEqual(page.erreurs, []);
    await page.context().close();
  });

  test('liste en erreur 503 : message lisible puis « Réessayer »', async () => {
    let panne = true;
    const page = await ouvrir(navigateur, { route: '/ventes?type=FA', gql: serveur({
      Ventes: () => (panne ? { http: 503 } : { ventes: { data: [{ id: 1, numero: 'FA-0001', type_doc: 'FA', date: '2026-11-01', raison: 'Client A', net_a_payer: 1200, regler: 0, reste_a_payer: 1200 }], total: 1 } }),
    }) });
    await page.locator('text=Serveur momentanément indisponible (HTTP 503)').first().waitFor({ timeout: 15000 });
    panne = false;
    await page.click('button:has-text("Réessayer")');
    await page.locator('text=FA-0001').first().waitFor({ timeout: 8000 });
    await page.context().close();
  });
});
