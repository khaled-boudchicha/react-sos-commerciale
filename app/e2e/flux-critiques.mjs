// E2E « flux critiques » à travers toute la chaîne : app → cloud GraphQL → gRPC → agent → MariaDB.
// Même API que l'app (mêmes mutations, même header X-Druxamed-Dossier).
//
// ⚠ Écrit dans la base : à lancer UNIQUEMENT sur un dossier de test (nom « gc_test… »).
//   GC_CLOUD_URL=http://localhost:3001/graphql GC_API_KEY=<agent_token> GC_AGENT_ID=<client_id> \
//   GC_DOSSIER=gc_test_2026 node e2e/flux-critiques.mjs
// Chaque scénario nettoie ce qu'il crée et vérifie le retour au stock / solde initial.

const URL = process.env.GC_CLOUD_URL ?? 'http://localhost:3001/graphql';
const DOSSIER = process.env.GC_DOSSIER ?? 'gc_test_2026';
if (!DOSSIER.startsWith('gc_test') && process.env.GC_E2E_ALLOW !== '1') {
  console.error(`Refus : « ${DOSSIER} » n'est pas un dossier de test (GC_E2E_ALLOW=1 pour forcer).`);
  process.exit(2);
}

let token = null;
let userToken = null;
async function gq(query, variables) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-druxamed-dossier': encodeURIComponent(DOSSIER),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(userToken ? { 'x-druxamed-user': userToken } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors?.length) throw new Error(j.errors[0].message);
  return j.data;
}

let ok = 0, ko = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { ko++; console.log('  ✗', m); } };
const today = new Date().toISOString().slice(0, 10);
const stockDe = async (code) => {
  const d = await gq('query($s: String){ articles(search: $s, limit: 5) }', { s: code });
  return Number(d.articles.data.find((a) => a.code === code)?.qte_reale);
};

(async () => {
  // Authentification par appairage (clé API du tray), puis utilisateur dossier
  const l = await gq('mutation($i: LoginWithApiKeyInput!){ loginWithApiKey(input: $i){ success access_token message } }',
    { i: { apiKey: process.env.GC_API_KEY, agent_id: process.env.GC_AGENT_ID } });
  if (!l.loginWithApiKey.success) throw new Error(l.loginWithApiKey.message);
  token = l.loginWithApiKey.access_token;
  const u = (await gq('mutation { loginDossierUser(username: "Admin", password: "") }')).loginDossierUser;
  check(u.ok && u.droits?.admin && !!u.user_token, 'connexion cloud + utilisateur dossier (droits + jeton signé)');

  // Droits vérifiés par l'agent : une commande réservée à l'app exige le jeton utilisateur
  try { await gq('mutation { annulerMouvement(cle: "EN0") }'); check(false, 'commande sans jeton utilisateur refusée'); }
  catch (e) { check(/Session utilisateur/.test(e.message), 'commande sans jeton utilisateur refusée'); }
  userToken = u.user_token;

  // Le renouvellement du jeton doit conserver l'agent de la session (régression corrigée)
  const rt = (await gq('mutation { refreshToken { success access_token } }')).refreshToken;
  token = rt.access_token;
  await gq('{ modesPayement }');
  check(true, 'refreshToken : les commandes atteignent toujours l’agent');

  const art = (await gq('{ articles(limit: 50) }')).articles.data.find((a) => Number(a.qte_reale) > 5);
  const s0 = await stockDe(art.code);
  const compte = (await gq('{ soldesComptes }')).soldesComptes.find((c) => c.compte_id && c.compte);

  console.log('\n── Vente comptoir → encaissement → caisse');
  const bct = (await gq('mutation($i: JSON!){ createVente(input: $i) }', { i: {
    type_doc: 'BCT', date: today, user_id: u.user_id, user_name: u.username,
    lignes: [{ id_article: art.id, code_article: art.code, designation: art.designation, qte: 2, prix_ht: 100, tva: 19, remise: 0 }],
  } })).createVente;
  check(bct.numero && Math.abs(Number(bct.net_a_payer) - 238) < 0.01, `bon de comptoir ${bct.numero} · net 238`);
  check(await stockDe(art.code) === s0 - 2, 'stock −2');

  const avant = (await gq('query($c: Int, $d: String!){ arreteCaisse(compte_id: $c, date: $d) }', { c: compte.compte_id, d: today })).arreteCaisse;
  // Encaissé dans la caisse de l'utilisateur (comme l'éditeur de vente)
  await gq('mutation($i: JSON!){ addReglementClient(input: $i) }', { i: {
    vente_id: bct.id, montant: 238, date: today, mode_payement: 'Espece', compte: compte.compte, compte_id: compte.compte_id,
  } });
  const regle = (await gq('query($id: Int!){ vente(id: $id) }', { id: bct.id })).vente;
  check(Number(regle.reste_a_payer) === 0 && regle.reglements.length === 1, 'pièce soldée, règlement visible sur la fiche');
  const mvts = (await gq('query($d: String){ tresorieComplete(date_debut: $d, date_fin: $d, limit: 200) }', { d: today })).tresorieComplete.data;
  const rgf = mvts.find((m) => m.cle.startsWith('RGF') && Math.abs(m.montant - 238) < 0.01);
  check(!!rgf, `encaissement présent en trésorerie (${rgf?.cle})`);
  check(/Règlement BCT N°/.test(rgf?.objet ?? ''), `libellé de trésorerie « ${rgf?.objet} »`);
  const apres = (await gq('query($c: Int, $d: String!){ arreteCaisse(compte_id: $c, date: $d) }', { c: compte.compte_id, d: today })).arreteCaisse;
  check(Math.abs(apres.solde_theorique - avant.solde_theorique - 238) < 0.01, `arrêté de caisse ${compte.compte} : +238 au solde théorique`);
  check(apres.mouvements.some((m) => m.cle === rgf.cle), 'le règlement figure dans les mouvements du jour de la caisse');

  console.log('\n── Droit « par utilisateur »');
  const siennes = (await gq('query($u: Int){ ventes(type_doc: "BCT", user_id: $u, limit: 500) }', { u: u.user_id })).ventes.data;
  const autres = (await gq('query($u: Int){ ventes(type_doc: "BCT", user_id: $u, limit: 500) }', { u: 999999 })).ventes.data;
  check(siennes.some((v) => v.id === bct.id) && siennes.every((v) => Number(v.user_id) === Number(u.user_id)), 'filtre user_id : uniquement les pièces de l’utilisateur');
  check(!autres.some((v) => v.id === bct.id), 'pièce invisible pour un autre utilisateur');

  console.log('\n── Annulation et nettoyage');
  check((await gq('mutation($c: String!){ annulerMouvement(cle: $c) }', { c: rgf.cle })).annulerMouvement, 'annulation du règlement depuis la trésorerie');
  const rouverte = (await gq('query($id: Int!){ vente(id: $id) }', { id: bct.id })).vente;
  check(Math.abs(Number(rouverte.reste_a_payer) - 238) < 0.01, 'pièce rouverte (reste 238)');
  await gq('mutation($id: Int!){ deleteVente(id: $id) }', { id: bct.id });
  check(await stockDe(art.code) === s0, `stock revenu à ${s0}`);

  console.log(`\n${ok} OK · ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('ERREUR', e.message); process.exit(2); });
