import type { ReportDef } from '@softly/report';
import {
  THEMES, bandePied, bandeSuite, bandeTotauxListe, bandeDe, blocEntete, blocInfos, blocNote, blocSignatures, blocTiers, empiler, nouvelEtat, tableau, T,
  type Col, type Info, type ThemeId,
} from './kit';

/**
 * Pièces commerciales A4 / A5 (vente et achat) : factures, bons de livraison, bon de comptoir, pièces d'achat.
 * Une seule fabrique ; les modèles ne diffèrent que par le thème, les colonnes et les blocs imprimés.
 */

type Variante = 'facture' | 'bl' | 'bl-lot' | 'bl-sans-prix' | 'comptoir' | 'achat';

const COLONNES: Record<Variante, Col[]> = {
  facture: [
    { titre: 'Code', expr: 'Lignes.code_article', w: 12, mono: true, muted: true },
    { titre: 'Désignation', expr: 'Lignes.designation', w: 44, grow: true },
    { titre: 'Qté', expr: 'Lignes.qte', w: 7, align: 'right', fmt: 'qty' },
    { titre: 'Prix HT', expr: 'Lignes.prix_ht', w: 12, align: 'right', fmt: 'money' },
    { titre: 'Rem. %', expr: 'Lignes.remise', w: 8, align: 'right', fmt: 'pct', muted: true },
    { titre: 'TVA %', expr: 'Lignes.tva', w: 7.5, align: 'right', fmt: 'pct', muted: true },
    { titre: 'Montant HT', expr: 'Lignes.total_ht', w: 13, align: 'right', fmt: 'money', bold: true },
  ],
  bl: [
    { titre: 'Code', expr: 'Lignes.code_article', w: 13, mono: true, muted: true },
    { titre: 'Désignation', expr: 'Lignes.designation', w: 50, grow: true },
    { titre: 'Unité', expr: 'Lignes.unite', w: 7, muted: true },
    { titre: 'Qté', expr: 'Lignes.qte', w: 8, align: 'right', fmt: 'qty', bold: true },
    { titre: 'Prix HT', expr: 'Lignes.prix_ht', w: 12, align: 'right', fmt: 'money' },
    { titre: 'Montant HT', expr: 'Lignes.total_ht', w: 13, align: 'right', fmt: 'money', bold: true },
  ],
  'bl-lot': [
    { titre: 'Code', expr: 'Lignes.code_article', w: 11, mono: true, muted: true },
    { titre: 'Désignation', expr: 'Lignes.designation', w: 31, grow: true },
    { titre: 'N° lot', expr: 'Lignes.n_lot', w: 10, mono: true },
    { titre: 'Péremption', expr: 'Lignes.date_peremption', w: 12.5, fmt: 'date', muted: true },
    { titre: 'Qté', expr: 'Lignes.qte', w: 6.5, align: 'right', fmt: 'qty', bold: true },
    { titre: 'Prix HT', expr: 'Lignes.prix_ht', w: 11, align: 'right', fmt: 'money' },
    { titre: 'Rem. %', expr: 'Lignes.remise', w: 8, align: 'right', fmt: 'pct', muted: true },
    { titre: 'Montant HT', expr: 'Lignes.total_ht', w: 12, align: 'right', fmt: 'money', bold: true },
  ],
  'bl-sans-prix': [
    { titre: 'Code', expr: 'Lignes.code_article', w: 14, mono: true, muted: true },
    { titre: 'Désignation', expr: 'Lignes.designation', w: 52, grow: true },
    { titre: 'N° lot', expr: 'Lignes.n_lot', w: 12, mono: true },
    { titre: 'Unité', expr: 'Lignes.unite', w: 8, muted: true },
    { titre: 'Quantité', expr: 'Lignes.qte', w: 10, align: 'right', fmt: 'qty', bold: true },
  ],
  comptoir: [
    { titre: 'Désignation', expr: 'Lignes.designation', w: 58, grow: true },
    { titre: 'Qté', expr: 'Lignes.qte', w: 8, align: 'right', fmt: 'qty' },
    { titre: 'Prix TTC', expr: 'Lignes.prix_ttc', w: 15, align: 'right', fmt: 'money' },
    { titre: 'Total TTC', expr: 'Lignes.total_ttc', w: 16, align: 'right', fmt: 'money', bold: true },
  ],
  achat: [
    { titre: 'Code', expr: 'Lignes.code_article', w: 12, mono: true, muted: true },
    { titre: 'Désignation', expr: 'Lignes.designation', w: 42, grow: true },
    { titre: 'N° lot', expr: 'Lignes.n_lot', w: 10, mono: true, muted: true },
    { titre: 'Qté', expr: 'Lignes.qte', w: 7, align: 'right', fmt: 'qty' },
    { titre: 'Coût HT', expr: 'Lignes.prix_ht', w: 12, align: 'right', fmt: 'money' },
    { titre: 'TVA %', expr: 'Lignes.tva', w: 7.5, align: 'right', fmt: 'pct', muted: true },
    { titre: 'Total TTC', expr: 'Lignes.total_ttc', w: 13, align: 'right', fmt: 'money', bold: true },
  ],
};

type PieceOpts = {
  nom: string; description: string; theme: ThemeId; variante: Variante; format?: 'A4' | 'A5';
  achat?: boolean; /** Pas de montants (BL sans prix). */ sansMontants?: boolean; signatures?: string[];
};

const dateFr = (e: string) => `FORMAT(${e}, 'dd/MM/yyyy')`;

function piece(o: PieceOpts): ReportDef {
  const th = THEMES[o.theme];
  const D = o.achat ? 'Achat' : 'Vente';
  const A5 = o.format === 'A5';
  const { def, ctx } = nouvelEtat(o.achat ? 'achat' : 'vente', o.nom, o.description, { format: o.format, th });
  const { cw } = ctx;

  const entete = blocEntete(ctx, { titre: `[UPPER(${D}.titre)]`, reference: `N° [${D}.numero]`, date: `Date : [${dateFr(`${D}.date`)}]`, fiscal: !A5, compact: A5 });

  const infos: Info[] = o.achat
    ? [{ label: 'Règlement', expr: `${D}.mode_payement` }, { label: 'Fournisseur n°', expr: `${D}.code_four` }]
    : [
      { label: 'Échéance', expr: dateFr(`${D}.date_echeance`), si: `NOT ISEMPTY(${D}.date_echeance)` },
      { label: 'Règlement', expr: `${D}.mode_payement` },
      { label: 'Client n°', expr: `${D}.code_cli` },
      { label: 'Vendeur', expr: `${D}.user_name` },
    ];
  const gauche = blocInfos(ctx, infos, Math.min(78, cw * 0.4));
  const tiers = blocTiers(ctx, {
    label: o.achat ? 'Fournisseur' : 'Client', nom: `[${D}.raison]`, w: A5 ? cw * 0.58 : undefined,
    lignes: o.achat
      ? [`[IIF(${D}.tel, 'Tél : ' & ${D}.tel, '')]`]
      : [`[IIF(${D}.adresse, ${D}.adresse, '')]`, `[IIF(${D}.tel, 'Tél : ' & ${D}.tel, '')]`,
        `[IIF(${D}.rc, 'RC : ' & ${D}.rc & '   ', '')][IIF(${D}.nif, 'NIF : ' & ${D}.nif, '')]`,
        ...(A5 ? [] : [`[IIF(${D}.nis, 'NIS : ' & ${D}.nis & '   ', '')][IIF(${D}.art, 'Art : ' & ${D}.art, '')]`])],
  });
  const ligneTiers = { objs: [...gauche.objs, ...tiers.objs], h: Math.max(gauche.h, tiers.h) };
  const titre = empiler([entete, ligneTiers], 5);

  const bands = [
    bandeSuite(ctx, `[UPPER(${D}.titre)]`, `N° [${D}.numero]`),
    bandeDe('reportTitle', 'En-tête du document', { ...titre, h: titre.h + 4 }),
    ...tableau(ctx, COLONNES[o.variante], { source: 'Lignes', taille: A5 ? 8.2 : 8.8 }),
  ];
  if (!o.sansMontants) bands.push(bandeTotauxListe(ctx, 'Totaux', { w: A5 ? 70 : 80 }));

  const note = blocNote(ctx, { titre: o.achat ? 'Montant arrêté en lettres' : 'Arrêtée la présente pièce à la somme de', texte: `[${D}.total_lettres]`, w: cw, h: A5 ? 11 : 13 });
  const obs = { objs: [T(ctx, 0, 0, cw, 5, `[IIF(${D}.observation, 'Observation : ' & ${D}.observation, '')]`, { size: 8.5, color: th.muted, canGrow: true })], h: A5 ? 5 : 6 };
  const sign = blocSignatures(ctx, o.signatures ?? (o.achat ? ['Visa du responsable', 'Cachet et signature'] : ['Le client', 'Cachet et signature']), A5 ? 15 : 24);
  const resume = o.sansMontants ? empiler([obs, sign], 6) : empiler([note, obs, sign], 3);
  bands.push(bandeDe('reportSummary', 'Synthèse', { objs: resume.objs, h: resume.h + 4 }));
  bands.push(bandePied(ctx, { reference: `[${D}.titre] N° [${D}.numero]`, legal: !A5 }));
  def.bands = bands;
  return def;
}

export const MODELES_PIECES: { id: string; build: () => ReportDef }[] = [
  { id: 'integre-facture-a4', build: () => piece({ nom: 'Facture A4 — Moderne', description: 'Facture, devis, avoir : en-tête société, cadre client, tableau zébré, totaux sur fond d’accent, montant en lettres, signatures.', theme: 'moderne', variante: 'facture' }) },
  { id: 'integre-facture-classique', build: () => piece({ nom: 'Facture A4 — Classique', description: 'Mise en page sobre noir et blanc, titres en empattement et filets doubles : s’imprime parfaitement sur imprimante monochrome.', theme: 'classique', variante: 'facture' }) },
  { id: 'integre-facture-prestige', build: () => piece({ nom: 'Facture A4 — Prestige', description: 'Bandeau bleu nuit, liserés dorés et titres en empattement : pour la correspondance haut de gamme.', theme: 'prestige', variante: 'facture' }) },
  { id: 'integre-bl-a4', build: () => piece({ nom: 'Bon de livraison A4', description: 'Bon de livraison avec prix et montants, zone de réception client.', theme: 'moderne', variante: 'bl', signatures: ['Réception du client', 'Cachet et signature'] }) },
  { id: 'integre-bl-lot', build: () => piece({ nom: 'Bon de livraison — N° de lot et péremption', description: 'Colonnes N° de lot, péremption et remise par article (traçabilité).', theme: 'moderne', variante: 'bl-lot', signatures: ['Réception du client', 'Cachet et signature'] }) },
  { id: 'integre-bl-sans-prix', build: () => piece({ nom: 'Bon de livraison — sans prix', description: 'Bon de livraison sans aucun montant, avec lot et quantité.', theme: 'classique', variante: 'bl-sans-prix', sansMontants: true, signatures: ['Réception du client', 'Le livreur'] }) },
  { id: 'integre-bon-comptoir-a5', build: () => piece({ nom: 'Bon de comptoir A5', description: 'Bon de comptoir compact (A5) : désignation, quantité, prix TTC.', theme: 'moderne', variante: 'comptoir', format: 'A5', signatures: ['Le client', 'Cachet et signature'] }) },
  { id: 'integre-achat-a4', build: () => piece({ nom: 'Pièce d’achat A4 — Moderne', description: 'Facture d’achat, bon de réception, bon de commande fournisseur.', theme: 'moderne', variante: 'achat', achat: true }) },
  { id: 'integre-achat-classique', build: () => piece({ nom: 'Pièce d’achat A4 — Classique', description: 'Pièce d’achat en mise en page sobre noir et blanc.', theme: 'classique', variante: 'achat', achat: true }) },
];
