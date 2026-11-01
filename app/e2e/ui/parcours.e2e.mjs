// Parcours d'interface critiques (build de production + GraphQL simulé).
// Lancer : npm run test:ui   (construit dist/ puis exécute ce fichier avec node --test ; nommé *.e2e.mjs pour que vitest l’ignore)
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
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
