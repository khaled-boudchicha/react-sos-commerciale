import type { BandDef, HighlightRule, ObjDef, ReportDef } from '@softly/report/core';
import {
  THEMES, bandePied, bandeSuite, bandeDe, blocCartes, blocEntete, blocNote, blocSignatures, blocTiers, blocTotaux, empiler, nouvelEtat, tableau, T,
  type Carte, type Col, type LigneTotal, type ThemeId,
} from './kit';

/**
 * États et listes (relevés, impayés, créances, trésorerie, stock, journaux, inventaire…) : un même squelette —
 * en-tête, cadre tiers, cartes de synthèse, tableau, totaux, signatures, pied paginé — piloté par une spécification.
 */

type Spec = {
  nom: string; description: string; kind: string; theme?: ThemeId; paysage?: boolean;
  titre: string; reference?: string; date?: string;
  /** Ligne d'introduction (texte libre sous l'en-tête). */
  intro?: string;
  tiers?: { label: string; nom: string; lignes: string[] };
  cartes?: Carte[];
  tableaux: { source: string; cols: Col[]; legende?: string; tri?: string; hLigne?: number; taille?: number; zebre?: boolean }[];
  totaux?: { lignes: LigneTotal[]; final: { label: string; expr: string; suffixe?: string } };
  signatures?: string[];
  /** Bandes de synthèse supplémentaires construites à la main (arrêté de caisse). */
  synthese?: (ctx: ReturnType<typeof nouvelEtat>['ctx']) => BandDef[];
  refPied?: string;
};

function etat(s: Spec): ReportDef {
  const th = THEMES[s.theme ?? 'moderne'];
  const { def, ctx } = nouvelEtat(s.kind, s.nom, s.description, { th, orientation: s.paysage ? 'paysage' : 'portrait' });
  const { cw } = ctx;

  const blocs = [blocEntete(ctx, { titre: s.titre, reference: s.reference, date: s.date, fiscal: false })];
  if (s.tiers) {
    const t = blocTiers(ctx, { ...s.tiers, w: Math.min(100, cw * 0.5) });
    const gauche: ObjDef[] = s.intro ? [T(ctx, 0, 1, cw - Math.min(100, cw * 0.5) - 6, 10, s.intro, { size: 9, color: th.muted, canGrow: true })] : [];
    blocs.push({ objs: [...gauche, ...t.objs], h: t.h });
  } else if (s.intro) {
    blocs.push({ objs: [T(ctx, 0, 0, cw, 6, s.intro, { size: 9.5, color: th.muted, canGrow: true })], h: 6.5 });
  }
  if (s.cartes) blocs.push(blocCartes(ctx, s.cartes));
  const titre = empiler(blocs, 5);

  const bands: BandDef[] = [bandeSuite(ctx, s.titre, s.reference ?? ''), bandeDe('reportTitle', 'En-tête du document', { ...titre, h: titre.h + 4 })];
  for (const t of s.tableaux) bands.push(...tableau(ctx, t.cols, t));

  const resume: { objs: ObjDef[]; h: number }[] = [{ objs: [], h: 3 }];
  if (s.totaux) resume.push(blocTotaux(ctx, s.totaux.lignes, s.totaux.final));
  if (s.signatures) resume.push(blocSignatures(ctx, s.signatures));
  if (resume.length > 1) {
    const r = empiler(resume, 8);
    bands.push(bandeDe('reportSummary', 'Synthèse', { objs: r.objs, h: r.h + 4 }));
  }
  if (s.synthese) bands.push(...s.synthese(ctx));
  bands.push(bandePied(ctx, { reference: s.refPied ?? s.titre }));
  def.bands = bands;
  return def;
}

const rouge = (th: ThemeId, when: string): HighlightRule => ({ when, font: { color: THEMES[th].danger, bold: true } });
const vert = (th: ThemeId, when: string): HighlightRule => ({ when, font: { color: THEMES[th].ok } });
const ambre = (th: ThemeId, when: string): HighlightRule => ({ when, font: { color: THEMES[th].warn, bold: true } });

const AUJOURDHUI = "Édité le [FORMAT(Date, 'dd/MM/yyyy')]";

// ─── Relevés ────────────────────────────────────────────────────────────────

const colsReleve = (): Col[] => [
  { titre: 'Date', expr: 'Lignes.date', w: 12, fmt: 'date' },
  { titre: 'Opération', expr: 'Lignes.type_doc', w: 22, bold: true },
  { titre: 'N°', expr: 'Lignes.numero', w: 18, mono: true },
  { titre: 'Mode', expr: 'Lignes.mode_payement', w: 13, muted: true },
  { titre: 'Montant', expr: 'Lignes.montant', w: 17, align: 'right', fmt: 'money', si: [vert('moderne', 'Lignes.montant < 0')] },
  { titre: 'Solde cumulé', expr: 'Lignes.total_cumul', w: 18, align: 'right', fmt: 'money', bold: true },
];

const releveClient = (theme: ThemeId): ReportDef => etat({
  nom: `Relevé client — ${THEMES[theme].nom}`, kind: 'etatClient', theme, description: 'Relevé chronologique avec solde cumulé, synthèse financière (CA, crédit initial, réglé, solde) et totaux.',
  titre: 'RELEVÉ CLIENT', reference: 'Client [Client.code_cli]', date: AUJOURDHUI, intro: '[Client.periode]',
  tiers: { label: 'Client', nom: '[Client.nom_client]', lignes: ["[IIF(Client.code_cli, 'Code : ' & Client.code_cli, '')]"] },
  cartes: [
    { label: 'Chiffre d’affaires', expr: 'Client.ca' }, { label: 'Crédit initial', expr: 'Client.credit_initial' },
    { label: 'Total réglé', expr: 'Client.regler', ton: 'ok' }, { label: 'Solde dû', expr: 'Client.credit', ton: 'fort' },
  ],
  tableaux: [{ source: 'Lignes', cols: colsReleve() }],
  totaux: {
    lignes: [{ label: 'Total ventes', expr: 'Client.total_ventes' }, { label: 'Total avoirs', expr: 'Client.total_avoirs' }, { label: 'Total réglé', expr: 'Client.regler' }, { label: 'Avances', expr: 'Client.solde_avance' }],
    final: { label: 'Solde dû', expr: 'Client.credit', suffixe: ' DA' },
  },
  refPied: 'Relevé [Client.nom_client]',
});

const releveFournisseur = (theme: ThemeId): ReportDef => etat({
  nom: `Relevé fournisseur — ${THEMES[theme].nom}`, kind: 'etatFournisseur', theme, description: 'Relevé chronologique des achats, retours et règlements avec solde cumulé.',
  titre: 'RELEVÉ FOURNISSEUR', reference: 'Fournisseur [Fournisseur.code_four]', date: AUJOURDHUI, intro: '[Fournisseur.periode]',
  tiers: { label: 'Fournisseur', nom: '[Fournisseur.nom]', lignes: ["[IIF(Fournisseur.code_four, 'Code : ' & Fournisseur.code_four, '')]"] },
  cartes: [
    { label: 'Total achats', expr: 'Fournisseur.total_achats' }, { label: 'Crédit initial', expr: 'Fournisseur.credit_initial' },
    { label: 'Total réglé', expr: 'Fournisseur.regler', ton: 'ok' }, { label: 'Solde dû', expr: 'Fournisseur.credit', ton: 'fort' },
  ],
  tableaux: [{ source: 'Lignes', cols: colsReleve() }],
  totaux: {
    lignes: [{ label: 'Total achats', expr: 'Fournisseur.total_achats' }, { label: 'Total retours', expr: 'Fournisseur.total_retours' }, { label: 'Total réglé', expr: 'Fournisseur.regler' }, { label: 'Remboursements', expr: 'Fournisseur.remboursements' }],
    final: { label: 'Solde dû', expr: 'Fournisseur.credit', suffixe: ' DA' },
  },
  refPied: 'Relevé [Fournisseur.nom]',
});

// ─── Créances ───────────────────────────────────────────────────────────────

const impayes = (): ReportDef => etat({
  nom: 'Situation des impayés — Moderne', kind: 'impayes', description: 'Factures non réglées d’un client, avec reste dû et retard en jours.',
  titre: 'SITUATION DES IMPAYÉS', reference: 'Client [Client.code_cli]', date: AUJOURDHUI,
  tiers: { label: 'Client', nom: '[Client.nom]', lignes: ["[Client.nb] pièce(s) non soldée(s)"] },
  cartes: [
    { label: 'Total facturé', expr: 'Client.total_facture' }, { label: 'Total réglé', expr: 'Client.total_regle', ton: 'ok' },
    { label: 'Total dû', expr: 'Client.total_du', ton: 'fort' },
  ],
  tableaux: [{
    source: 'Factures', tri: 'Factures.date', cols: [
      { titre: 'Type', expr: 'Factures.type_facture', w: 19, bold: true },
      { titre: 'N°', expr: 'Factures.numero', w: 17, mono: true },
      { titre: 'Date', expr: 'Factures.date', w: 12, fmt: 'date' },
      { titre: 'Mode', expr: 'Factures.mode_payement', w: 12, muted: true },
      { titre: 'Montant', expr: 'Factures.net_a_payer', w: 14, align: 'right', fmt: 'money' },
      { titre: 'Réglé', expr: 'Factures.regler', w: 13, align: 'right', fmt: 'money', muted: true },
      { titre: 'Reste', expr: 'Factures.reste_a_payer', w: 14, align: 'right', fmt: 'money', bold: true, si: [rouge('moderne', 'Factures.reste_a_payer > 0')] },
      { titre: 'Retard', expr: 'Factures.jours', w: 9, align: 'right', fmt: 'int', suffixe: ' j', si: [rouge('moderne', 'Factures.jours > 60'), ambre('moderne', 'Factures.jours > 30')] },
    ],
  }],
  totaux: { lignes: [{ label: 'Total facturé', expr: 'Client.total_facture' }, { label: 'Total réglé', expr: 'Client.total_regle' }], final: { label: 'Total dû', expr: 'Client.total_du', suffixe: ' DA' } },
  refPied: 'Impayés [Client.nom]',
});

const creances = (): ReportDef => etat({
  nom: 'État des créances — Moderne', kind: 'creances', description: 'Créances clients classées par ancienneté (0–30, 30–60, +60 jours).',
  titre: 'ÉTAT DES CRÉANCES', reference: '[Etat.total_clients] client(s)', date: AUJOURDHUI,
  cartes: [
    { label: 'Total créances', expr: 'Etat.total_creances', ton: 'fort' }, { label: '0–30 jours', expr: 'Etat.bucket_0_30' },
    { label: '30–60 jours', expr: 'Etat.bucket_30_60', ton: 'warn' }, { label: '+60 jours', expr: 'Etat.bucket_60_plus', ton: 'danger' },
  ],
  tableaux: [{
    source: 'Debiteurs', tri: 'Debiteurs.montant', cols: [
      { titre: 'Code', expr: 'Debiteurs.code_cli', w: 12, mono: true, muted: true },
      { titre: 'Client', expr: 'Debiteurs.raison', w: 46, bold: true, grow: true },
      { titre: 'Factures', expr: 'Debiteurs.nb_factures', w: 11, align: 'right', fmt: 'int' },
      { titre: 'Retard', expr: 'Debiteurs.jours_retard', w: 11, align: 'right', fmt: 'int', suffixe: ' j', si: [rouge('moderne', 'Debiteurs.jours_retard > 60'), ambre('moderne', 'Debiteurs.jours_retard > 30')] },
      { titre: 'Créance', expr: 'Debiteurs.montant', w: 20, align: 'right', fmt: 'money', bold: true, si: [rouge('moderne', 'Debiteurs.montant > 0')] },
    ],
  }],
  totaux: { lignes: [{ label: 'Clients débiteurs', expr: 'Etat.total_clients', fmt: 'int' }, { label: 'Factures ouvertes', expr: 'Etat.total_factures', fmt: 'int' }], final: { label: 'Total des créances', expr: 'Etat.total_creances', suffixe: ' DA' } },
});

const recouvrement = (): ReportDef => etat({
  nom: 'État de recouvrement — Moderne', kind: 'recouvrement', description: 'Créances en retard par client avec ancienneté et échéances.',
  titre: 'ÉTAT DE RECOUVREMENT', reference: '[Etat.nb_clients] client(s)', date: AUJOURDHUI, intro: '[Etat.critere]',
  cartes: [
    { label: 'Total dû', expr: 'Etat.total_du', ton: 'fort' }, { label: 'En retard', expr: 'Etat.du_en_retard', ton: 'danger' }, { label: 'Échu', expr: 'Etat.echu', ton: 'danger' },
    { label: '0–30 j', expr: 'Etat.b_0_30' }, { label: '31–60 j', expr: 'Etat.b_31_60', ton: 'warn' }, { label: '61–90 j', expr: 'Etat.b_61_90', ton: 'warn' }, { label: '+90 j', expr: 'Etat.b_90_plus', ton: 'danger' },
  ],
  tableaux: [{
    source: 'Clients', tri: 'Clients.du_en_retard', taille: 8.4, cols: [
      { titre: 'Client', expr: 'Clients.raison', w: 38, bold: true, grow: true },
      { titre: 'Téléphone', expr: 'Clients.tel', w: 19, muted: true },
      { titre: 'Pièces', expr: 'Clients.nb_pieces', w: 8, align: 'right', fmt: 'int' },
      { titre: 'Plus ancienne', expr: 'Clients.plus_ancienne', w: 18, fmt: 'date', align: 'right' },
      { titre: 'Jours', expr: 'Clients.jours_max', w: 8, align: 'right', fmt: 'int', si: [rouge('moderne', 'Clients.jours_max > 90'), ambre('moderne', 'Clients.jours_max > 60')] },
      { titre: 'Dû total', expr: 'Clients.total_du', w: 16, align: 'right', fmt: 'money' },
      { titre: 'En retard', expr: 'Clients.du_en_retard', w: 16, align: 'right', fmt: 'money', bold: true, si: [rouge('moderne', 'Clients.du_en_retard > 0')] },
      { titre: 'Échu', expr: 'Clients.echu', w: 14, align: 'right', fmt: 'money' },
    ],
  }],
  totaux: { lignes: [{ label: 'Total dû', expr: 'Etat.total_du' }], final: { label: 'Total en retard', expr: 'Etat.du_en_retard', suffixe: ' DA' } },
});

// ─── Trésorerie et caisse ───────────────────────────────────────────────────

const tresorerie = (): ReportDef => etat({
  nom: 'État de trésorerie — Moderne', kind: 'tresorerie', description: 'Mouvements d’un compte sur une période : solde initial, crédits, débits et solde final.',
  titre: 'ÉTAT DE TRÉSORERIE', reference: 'Compte [Compte.nom]', date: AUJOURDHUI, intro: 'Période : [Compte.periode]',
  cartes: [
    { label: 'Solde initial', expr: 'Compte.solde_initial' }, { label: 'Crédits', expr: 'Compte.total_credit', ton: 'ok' },
    { label: 'Débits', expr: 'Compte.total_debit', ton: 'danger' }, { label: 'Solde final', expr: 'Compte.solde_final', ton: 'fort' },
  ],
  tableaux: [{
    source: 'Mouvements', cols: [
      { titre: 'Date', expr: 'Mouvements.date', w: 11, fmt: 'date' },
      { titre: 'Catégorie', expr: 'Mouvements.categorie', w: 15, bold: true },
      { titre: 'Tiers / libellé', expr: 'Mouvements.libelle', w: 34, grow: true },
      { titre: 'Mode', expr: 'Mouvements.mode_payement', w: 11, muted: true },
      { titre: 'Montant', expr: 'Mouvements.montant', w: 16, align: 'right', fmt: 'money', bold: true, si: [{ when: 'Mouvements.montant < 0', font: { color: THEMES.moderne.danger, bold: true } }, vert('moderne', 'Mouvements.montant >= 0')] },
      { titre: 'Solde cumulé', expr: 'Mouvements.solde_cumul', w: 16, align: 'right', fmt: 'money' },
    ],
  }],
  totaux: { lignes: [{ label: 'Mouvements', expr: 'Compte.nb', fmt: 'int' }, { label: 'Total crédits', expr: 'Compte.total_credit' }, { label: 'Total débits', expr: 'Compte.total_debit' }], final: { label: 'Solde final', expr: 'Compte.solde_final', suffixe: ' DA' } },
  refPied: 'Trésorerie [Compte.nom]',
});

const arreteCaisse = (): ReportDef => etat({
  nom: 'Arrêté de caisse — Moderne', kind: 'arreteCaisse', description: 'Arrêté journalier : ouverture, entrées, sorties, récapitulatif par mode, mouvements, comptage et écart, visas.',
  titre: 'ARRÊTÉ DE CAISSE', reference: '[Arrete.reference]', date: "Journée du [FORMAT(Arrete.date, 'dd/MM/yyyy')]", intro: 'Compte / caisse : [Arrete.compte]',
  cartes: [
    { label: 'Ouverture espèces', expr: 'Arrete.solde_ouverture' }, { label: 'Entrées espèces', expr: 'Arrete.total_entrees', ton: 'ok' },
    { label: 'Sorties espèces', expr: 'Arrete.total_sorties', ton: 'danger' }, { label: 'Espèces théoriques', expr: 'Arrete.solde_theorique', ton: 'fort' },
  ],
  tableaux: [
    {
      source: 'Modes', legende: 'Récapitulatif par mode de paiement', cols: [
        { titre: 'Mode', expr: 'Modes.mode', w: 40, bold: true },
        { titre: 'Entrées', expr: 'Modes.entrees', w: 20, align: 'right', fmt: 'money' },
        { titre: 'Sorties', expr: 'Modes.sorties', w: 20, align: 'right', fmt: 'money' },
        { titre: 'Net', expr: 'Modes.net', w: 20, align: 'right', fmt: 'money', bold: true },
      ],
    },
    {
      source: 'Mouvements', legende: 'Mouvements de la journée', cols: [
        { titre: 'Catégorie', expr: 'Mouvements.categorie', w: 16, bold: true },
        { titre: 'Tiers / libellé', expr: 'Mouvements.libelle', w: 46, grow: true },
        { titre: 'Mode', expr: 'Mouvements.mode_payement', w: 14, muted: true },
        { titre: 'Montant', expr: 'Mouvements.montant', w: 18, align: 'right', fmt: 'money', bold: true, si: [{ when: 'Mouvements.montant < 0', font: { color: THEMES.moderne.danger, bold: true } }, vert('moderne', 'Mouvements.montant >= 0')] },
      ],
    },
  ],
  synthese: (ctx) => {
    const visas = blocSignatures(ctx, ['Le caissier : [Arrete.utilisateur]', 'Le responsable'], 24);
    const avec = empiler([{ objs: [], h: 3 }, blocTotaux(ctx, [{ label: 'Solde théorique', expr: 'Arrete.solde_theorique' }, { label: 'Montant compté', expr: 'Arrete.montant_compte' }], { label: 'Écart', expr: 'Arrete.ecart', suffixe: ' DA' }), visas], 8);
    const sans = empiler([{ objs: [], h: 3 }, blocTotaux(ctx, [], { label: 'Solde théorique', expr: 'Arrete.solde_theorique', suffixe: ' DA' }), visas], 8);
    return [
      bandeDe('reportSummary', 'Synthèse (avec comptage)', { objs: avec.objs, h: avec.h + 4 }, { visible: 'Arrete.compte_saisi' }),
      bandeDe('reportSummary', 'Synthèse (théorique)', { objs: sans.objs, h: sans.h + 4 }, { visible: 'NOT Arrete.compte_saisi' }),
    ];
  },
  refPied: 'Arrêté de caisse [Arrete.reference]',
});

// ─── Stock ──────────────────────────────────────────────────────────────────

const stock = (): ReportDef => etat({
  nom: 'État du stock — Moderne', kind: 'articles', description: 'Articles, PMP, prix de vente, stock (alertes de rupture et de seuil) et valeur du stock.',
  titre: 'ÉTAT DU STOCK', reference: '[Etat.filtre]', date: AUJOURDHUI,
  cartes: [
    { label: 'Articles', expr: 'Etat.nb_articles', fmt: 'int' }, { label: 'En alerte', expr: 'Etat.en_alerte', fmt: 'int', ton: 'warn' },
    { label: 'En rupture', expr: 'Etat.en_rupture', fmt: 'int', ton: 'danger' }, { label: 'Valeur du stock', expr: 'Etat.valeur_pmp', ton: 'fort' },
  ],
  tableaux: [{
    source: 'Articles', tri: 'Articles.designation', cols: [
      { titre: 'Code', expr: 'Articles.code', w: 11, mono: true, muted: true },
      { titre: 'Désignation', expr: 'Articles.designation', w: 40, grow: true },
      { titre: 'Famille', expr: 'Articles.famille', w: 16, muted: true, grow: true },
      { titre: 'PMP', expr: 'Articles.pmp', w: 12, align: 'right', fmt: 'money' },
      { titre: 'P.V. TTC', expr: 'Articles.prix_vente_ttc', w: 12, align: 'right', fmt: 'money' },
      { titre: 'Stock', expr: 'Articles.qte_reale', w: 8, align: 'right', fmt: 'qty', bold: true, si: [rouge('moderne', 'Articles.rupture'), ambre('moderne', 'Articles.alerte')] },
      { titre: 'Valeur (PMP)', expr: 'Articles.valeur_pmp', w: 14, align: 'right', fmt: 'money', bold: true },
    ],
  }],
  totaux: { lignes: [{ label: 'Articles', expr: 'Etat.nb_articles', fmt: 'int' }, { label: 'Dont en alerte', expr: 'Etat.en_alerte', fmt: 'int' }], final: { label: 'Valeur du stock', expr: 'Etat.valeur_pmp', suffixe: ' DA' } },
});

const bonStock = (): ReportDef => etat({
  nom: 'Bon d’entrée / de sortie — Moderne', kind: 'bonStock', description: 'Bon de mouvement de stock hors pièce commerciale : dépôt, motif, agent, lignes valorisées, visas.',
  titre: '[UPPER(Bon.titre)]', reference: 'N° [Bon.numero]', date: "Date : [FORMAT(Bon.date, 'dd/MM/yyyy')]",
  cartes: [{ label: 'Dépôt', expr: 'Bon.depot', fmt: 'texte' }, { label: 'Motif', expr: 'Bon.motif', fmt: 'texte' }, { label: 'Agent', expr: 'Bon.agent', fmt: 'texte' }],
  tableaux: [{
    source: 'Lignes', cols: [
      { titre: 'Code', expr: 'Lignes.code_article', w: 13, mono: true, muted: true },
      { titre: 'Désignation', expr: 'Lignes.designation', w: 46, grow: true },
      { titre: 'Qté', expr: 'Lignes.qte', w: 10, align: 'right', fmt: 'qty', bold: true },
      { titre: 'Unité', expr: 'Lignes.unite', w: 8, muted: true },
      { titre: 'P.U.', expr: 'Lignes.prix_unitaire', w: 13, align: 'right', fmt: 'money' },
      { titre: 'Total', expr: 'Lignes.total', w: 14, align: 'right', fmt: 'money', bold: true },
    ],
  }],
  totaux: { lignes: [{ label: 'Lignes', expr: 'Bon.nb_lignes', fmt: 'int' }], final: { label: 'Valeur totale', expr: 'Bon.total', suffixe: ' DA' } },
  signatures: ['Magasinier', 'Visa du responsable'],
  refPied: '[Bon.titre] N° [Bon.numero]',
});

const inventaireEtat = (): ReportDef => etat({
  nom: 'Inventaire — état chiffré', kind: 'inventaire', description: 'Quantités théoriques / comptées, écarts en quantité et en valeur.',
  titre: '[UPPER(Inventaire.titre)]', reference: '[Inventaire.designation]', date: "Date : [FORMAT(Inventaire.date, 'dd/MM/yyyy')]",
  cartes: [{ label: 'Articles', expr: 'Inventaire.nb', fmt: 'int' }, { label: 'Valeur théorique', expr: 'Inventaire.valeur_theorique' }, { label: 'Valeur comptée', expr: 'Inventaire.valeur_reale' }, { label: 'Écart de valorisation', expr: 'Inventaire.ecart_valeur', ton: 'fort' }],
  tableaux: [{
    source: 'Lignes', cols: [
      { titre: 'Code', expr: 'Lignes.code_article', w: 11, mono: true, muted: true },
      { titre: 'Désignation', expr: 'Lignes.designation', w: 38, grow: true },
      { titre: 'Dépôt', expr: 'Lignes.depot', w: 11, muted: true },
      { titre: 'Théorique', expr: 'Lignes.qte_theorique', w: 11, align: 'right', fmt: 'qty' },
      { titre: 'Compté', expr: 'Lignes.qte_reale', w: 11, align: 'right', fmt: 'qty', bold: true },
      { titre: 'Écart', expr: 'Lignes.ecart', w: 9, align: 'right', fmt: 'qty', bold: true, si: [rouge('moderne', 'Lignes.ecart < 0'), vert('moderne', 'Lignes.ecart > 0')] },
      { titre: 'Valeur écart', expr: 'Lignes.valeur_ecart', w: 13, align: 'right', fmt: 'money', si: [rouge('moderne', 'Lignes.valeur_ecart < 0')] },
    ],
  }],
  totaux: { lignes: [{ label: 'Valeur théorique', expr: 'Inventaire.valeur_theorique' }, { label: 'Valeur comptée', expr: 'Inventaire.valeur_reale' }], final: { label: 'Écart de valorisation', expr: 'Inventaire.ecart_valeur', suffixe: ' DA' } },
  signatures: ['Responsable de l’inventaire', 'Visa de la direction'],
});

/** Feuille de comptage à remplir à la main : colonne « Compté » vide, encadrée, lignes aérées. */
const inventaireComptage = (): ReportDef => {
  const d = etat({
    nom: 'Inventaire — feuille de comptage', kind: 'inventaire', description: 'Feuille vierge à remplir au crayon pendant le comptage : colonnes Compté et Observation encadrées.',
    titre: 'FEUILLE DE COMPTAGE', reference: '[Inventaire.designation]', date: "Date : [FORMAT(Inventaire.date, 'dd/MM/yyyy')]",
    tableaux: [{
      source: 'Lignes', hLigne: 9, zebre: false, cols: [
        { titre: 'Code', expr: 'Lignes.code_article', w: 12, mono: true, muted: true },
        { titre: 'Désignation', expr: 'Lignes.designation', w: 46, grow: true },
        { titre: 'Dépôt', expr: 'Lignes.depot', w: 12, muted: true },
        { titre: 'Théorique', expr: 'Lignes.qte_theorique', w: 12, align: 'right', fmt: 'qty' },
        { titre: 'Compté', expr: "''", w: 14 },
        { titre: 'Observation', expr: "''", w: 24 },
      ],
    }],
    signatures: ['Compteur', 'Contrôleur'],
  });
  // Cases à remplir : cadre sur les deux dernières colonnes de la ligne de données
  const data = d.bands.find((b) => b.type === 'data')!;
  for (const o of data.objects) if (o.type === 'text' && (o.name === 'Compté' || o.name === 'Observation')) o.border = { top: true, right: true, bottom: true, left: true, color: '#9AA5B8', width: 0.25 };
  return d;
};

// ─── Listes ─────────────────────────────────────────────────────────────────

const bordereau = (): ReportDef => etat({
  nom: 'Bordereau de pièces — Moderne', kind: 'bordereau', description: 'Liste des pièces d’une période (ventes ou achats) : net, réglé, reste.',
  titre: '[UPPER(Bordereau.titre)]', reference: '[Bordereau.nb] pièce(s)', date: '[Bordereau.periode]',
  cartes: [{ label: 'Total net', expr: 'Bordereau.total_net' }, { label: 'Total réglé', expr: 'Bordereau.total_regle', ton: 'ok' }, { label: 'Reste dû', expr: 'Bordereau.total_reste', ton: 'fort' }],
  tableaux: [{
    source: 'Lignes', cols: [
      { titre: 'N° pièce', expr: 'Lignes.numero', w: 16, mono: true, bold: true },
      { titre: 'Date', expr: 'Lignes.date', w: 11, fmt: 'date' },
      { titre: '[Bordereau.tiers_label]', expr: 'Lignes.tiers', w: 33, grow: true },
      { titre: 'Mode', expr: 'Lignes.mode_payement', w: 11, muted: true },
      { titre: 'Net à payer', expr: 'Lignes.net', w: 14, align: 'right', fmt: 'money', bold: true },
      { titre: 'Réglé', expr: 'Lignes.regler', w: 13, align: 'right', fmt: 'money', muted: true },
      { titre: 'Reste', expr: 'Lignes.reste', w: 13, align: 'right', fmt: 'money', si: [rouge('moderne', 'Lignes.reste > 0')] },
    ],
  }],
  totaux: { lignes: [{ label: 'Total net', expr: 'Bordereau.total_net' }, { label: 'Total réglé', expr: 'Bordereau.total_regle' }], final: { label: 'Total reste dû', expr: 'Bordereau.total_reste', suffixe: ' DA' } },
  refPied: '[Bordereau.titre]',
});

const journal = (vente: boolean): ReportDef => etat({
  nom: vente ? 'Journal des ventes — Moderne' : 'Journal des achats — Moderne', kind: 'journal',
  description: vente ? 'Journal ligne à ligne des ventes avec marge.' : 'Journal ligne à ligne des achats.',
  titre: '[UPPER(Journal.titre)]', reference: '[Journal.nb] ligne(s)', date: '[Journal.periode]',
  cartes: vente
    ? [{ label: 'Quantité totale', expr: 'Journal.total_qte', fmt: 'qty' }, { label: 'Marge totale', expr: 'Journal.total_marge', ton: 'ok' }, { label: 'Total TTC', expr: 'Journal.total_ttc', ton: 'fort' }]
    : [{ label: 'Quantité totale', expr: 'Journal.total_qte', fmt: 'qty' }, { label: 'Total TTC', expr: 'Journal.total_ttc', ton: 'fort' }],
  tableaux: [{
    source: 'Lignes', taille: 8.3, cols: [
      { titre: 'Date', expr: 'Lignes.date', w: 12, fmt: 'date' },
      { titre: 'Pièce', expr: 'Lignes.numero', w: 16, grow: true },
      { titre: 'Code', expr: 'Lignes.code_article', w: 10, mono: true, muted: true },
      { titre: 'Désignation', expr: 'Lignes.designation', w: vente ? 27 : 36, grow: true },
      { titre: 'Lot', expr: 'Lignes.n_lot', w: 11, muted: true, grow: true },
      { titre: 'Qté', expr: 'Lignes.qte', w: 6, align: 'right', fmt: 'qty' },
      { titre: 'P.U. HT', expr: 'Lignes.prix_ht', w: 11, align: 'right', fmt: 'money' },
      { titre: 'Total TTC', expr: 'Lignes.total_ttc', w: 12, align: 'right', fmt: 'money', bold: true },
      ...(vente ? [{ titre: 'Marge', expr: 'Lignes.total_marge', w: 10, align: 'right' as const, fmt: 'money' as const, si: [rouge('moderne', 'Lignes.total_marge < 0')] }] : []),
    ],
  }],
  totaux: { lignes: [{ label: 'Quantité totale', expr: 'Journal.total_qte', fmt: 'qty' }, ...(vente ? [{ label: 'Marge totale', expr: 'Journal.total_marge' }] : [])], final: { label: 'Total TTC', expr: 'Journal.total_ttc', suffixe: ' DA' } },
  refPied: '[Journal.titre]',
});

const etat104 = (): ReportDef => etat({
  nom: 'État 104 — Moderne', kind: 'etat104', paysage: true, description: 'Annexe de la déclaration annuelle : chiffre d’affaires par client avec identifiants fiscaux (A4 paysage).',
  titre: 'ÉTAT 104', reference: 'Période [Etat.periode]', date: AUJOURDHUI, intro: '[Etat.perimetre]',
  cartes: [
    { label: 'Clients', expr: 'Etat.nb_clients', fmt: 'int' }, { label: 'Total HT', expr: 'Etat.montant_ht' }, { label: 'Total TVA', expr: 'Etat.tva' },
    { label: 'Total TTC', expr: 'Etat.montant_ttc', ton: 'fort' }, { label: 'Identifiants manquants', expr: 'Etat.incomplets', fmt: 'int', ton: 'warn' },
  ],
  tableaux: [{
    source: 'Clients', tri: 'Clients.raison', taille: 8.3, cols: [
      { titre: 'Client', expr: 'Clients.raison', w: 30, bold: true, grow: true },
      { titre: 'Adresse', expr: 'Clients.adresse', w: 24, muted: true, grow: true },
      { titre: 'RC', expr: "IIF(Clients.rc, Clients.rc, '—')", w: 15, mono: true },
      { titre: 'NIF', expr: "IIF(Clients.nif, Clients.nif, 'manquant')", w: 17, mono: true, si: [rouge('moderne', 'Clients.incomplet')] },
      { titre: 'NIS', expr: "IIF(Clients.nis, Clients.nis, '—')", w: 16, mono: true },
      { titre: 'Art. imp.', expr: "IIF(Clients.art, Clients.art, '—')", w: 14, mono: true },
      { titre: 'Pièces', expr: 'Clients.nb_pieces', w: 8, align: 'right', fmt: 'int' },
      { titre: 'Montant HT', expr: 'Clients.montant_ht', w: 13, align: 'right', fmt: 'money' },
      { titre: 'TVA', expr: 'Clients.tva', w: 11, align: 'right', fmt: 'money' },
      { titre: 'Montant TTC', expr: 'Clients.montant_ttc', w: 13, align: 'right', fmt: 'money', bold: true },
    ],
  }],
  totaux: { lignes: [{ label: 'Total HT', expr: 'Etat.montant_ht' }, { label: 'Total TVA', expr: 'Etat.tva' }], final: { label: 'Total TTC', expr: 'Etat.montant_ttc', suffixe: ' DA' } },
  refPied: 'État 104 [Etat.periode]',
});

export const MODELES_ETATS: { id: string; build: () => ReportDef }[] = [
  { id: 'integre-releve-client', build: () => releveClient('moderne') },
  { id: 'integre-releve-client-classique', build: () => releveClient('classique') },
  { id: 'integre-releve-fournisseur', build: () => releveFournisseur('moderne') },
  { id: 'integre-releve-fournisseur-classique', build: () => releveFournisseur('classique') },
  { id: 'integre-impayes', build: impayes },
  { id: 'integre-creances', build: creances },
  { id: 'integre-recouvrement', build: recouvrement },
  { id: 'integre-tresorerie', build: tresorerie },
  { id: 'integre-arrete-caisse', build: arreteCaisse },
  { id: 'integre-etat-stock', build: stock },
  { id: 'integre-bon-stock', build: bonStock },
  { id: 'integre-inventaire-etat', build: inventaireEtat },
  { id: 'integre-inventaire-comptage', build: inventaireComptage },
  { id: 'integre-bordereau', build: bordereau },
  { id: 'integre-journal-ventes', build: () => journal(true) },
  { id: 'integre-journal-achats', build: () => journal(false) },
  { id: 'integre-etat-104', build: etat104 },
];

export { blocNote };
