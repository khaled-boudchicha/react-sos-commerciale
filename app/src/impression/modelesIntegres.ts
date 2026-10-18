import {
  declarerModeleIntegre, creerBande, creerEtat, creerObjet, creerPage,
  type BandDef, type FormatDef, type ObjDef, type ReportDef, type TextObj,
} from '@softly/report';

/**
 * Modèles livrés avec l'application (lecture seule). L'utilisateur les « Duplique » pour en
 * faire un fichier .gcr personnel qu'il peut modifier librement dans le designer.
 */

const INK = '#0F1A2E', MUTED = '#5B6A86', BRAND = '#2450E0', LIGNE = '#D5DDEC';

const montant: FormatDef = { kind: 'number', pattern: '#,##0.00' };
const entier: FormatDef = { kind: 'number', pattern: '#,##0.##' };

type Opt = Partial<TextObj>;
const T = (x: number, y: number, w: number, h: number, text: string, o: Opt = {}): TextObj =>
  creerObjet('text', x, y, { w, h, text, ...o }) as TextObj;
const gras = (size = 9, color = INK) => ({ size, bold: true, color });

function entete(D: string, titre: string, tiers: 'Client' | 'Fournisseur'): BandDef[] {
  const champTiers = D === 'Achat' ? `${D}.raison` : `${D}.raison`;
  const droite = D === 'Vente'
    ? [
      T(105, 11, 85, 5, `[${D}.raison]`, { font: gras(10) }),
      T(105, 16.5, 85, 4, `[IIF(${D}.adresse, ${D}.adresse, '')]`, { font: { size: 8, color: MUTED } }),
      T(105, 20.5, 85, 4, `[IIF(${D}.tel, 'Tél : ' & ${D}.tel, '')]`, { font: { size: 8, color: MUTED } }),
    ]
    : [
      T(105, 11, 85, 5, `[${champTiers}]`, { font: gras(10) }),
      T(105, 16.5, 85, 4, `[IIF(${D}.code_four, 'Code : ' & ${D}.code_four, '')]`, { font: { size: 8, color: MUTED } }),
    ];
  return [
    creerBande('pageHeader', {
      name: 'En-tête de page', height: 30, objects: [
        creerObjet('image', 0, 0, { w: 26, h: 24, expr: 'Societe.logo', fit: 'contain' }),
        T(29, 0, 100, 7, '[UPPER(Societe.raison_sociale)]', { font: gras(14), name: 'Raison sociale' }),
        T(29, 7.5, 100, 4, '[Societe.adresse]', { font: { size: 8.5, color: MUTED } }),
        T(29, 11.5, 100, 4, "[IIF(Societe.telephone, 'Tél : ' & Societe.telephone, '')]", { font: { size: 8.5, color: MUTED } }),
        T(29, 15.5, 100, 4, "[IIF(Societe.email, Societe.email, '')]", { font: { size: 8.5, color: MUTED } }),
        T(125, 0, 65, 4, "[IIF(Societe.rc, 'RC : ' & Societe.rc, '')]", { align: 'right', font: { size: 8, color: MUTED } }),
        T(125, 4, 65, 4, "[IIF(Societe.nif, 'NIF : ' & Societe.nif, '')]", { align: 'right', font: { size: 8, color: MUTED } }),
        T(125, 8, 65, 4, "[IIF(Societe.nis, 'NIS : ' & Societe.nis, '')]", { align: 'right', font: { size: 8, color: MUTED } }),
        T(125, 12, 65, 4, "[IIF(Societe.art, 'Art : ' & Societe.art, '')]", { align: 'right', font: { size: 8, color: MUTED } }),
        creerObjet('line', 0, 27, { w: 190, h: 0.4, direction: 'h', color: BRAND, lineWidth: 0.6 }),
      ],
    }),
    creerBande('reportTitle', {
      name: 'Titre du document', height: 30, objects: [
        T(0, 2, 100, 9, `[UPPER(${D}.titre)] N° [${D}.numero]`, { font: gras(16, BRAND), name: 'Titre' }),
        T(0, 12, 100, 5, `Date : [FORMAT(${D}.date, 'dd/MM/yyyy')]`, { font: { size: 9.5 } }),
        T(0, 17, 100, 5, D === 'Vente' ? "[IIF(Vente.date_echeance, 'Échéance : ' & FORMAT(Vente.date_echeance, 'dd/MM/yyyy'), '')]" : `[IIF(${D}.mode_payement, 'Règlement : ' & ${D}.mode_payement, '')]`, { font: { size: 9.5 } }),
        creerObjet('shape', 102, 0, { w: 88, h: 27, shape: 'rect', border: { top: true, right: true, bottom: true, left: true, color: LIGNE, width: 0.3, radius: 1.5 }, name: `Cadre ${tiers}` }),
        T(105, 3.5, 82, 4, tiers.toUpperCase(), { font: { size: 7.5, bold: true, color: MUTED } }),
        ...droite,
      ],
    }),
  ];
}

function tableau(D: string): BandDef[] {
  const cols: { x: number; w: number; titre: string; align: TextObj['align'] }[] = [
    { x: 0, w: 26, titre: 'Code', align: 'left' },
    { x: 26, w: 70, titre: 'Désignation', align: 'left' },
    { x: 96, w: 16, titre: 'Qté', align: 'right' },
    { x: 112, w: 26, titre: 'Prix HT', align: 'right' },
    { x: 138, w: 14, titre: 'TVA %', align: 'right' },
    { x: 152, w: 38, titre: 'Total HT', align: 'right' },
  ];
  return [
    creerBande('dataHeader', {
      name: 'En-tête du tableau', dataSource: 'Lignes', height: 7, keepWithData: true,
      objects: cols.map((c) => T(c.x, 0, c.w, 7, c.titre, { style: 'Entête de colonne', align: c.align, valign: 'middle', padding: 1, name: `Titre ${c.titre}` })),
    }),
    creerBande('data', {
      name: 'Lignes', dataSource: 'Lignes', height: 6.7, canGrow: true, zebra: '#F7F9FC',
      objects: [
        T(0, 0, 26, 6.5, '[Lignes.code_article]', { font: { size: 8.5, color: MUTED }, padding: 1, valign: 'top' }),
        T(26, 0, 70, 6.5, `[Lignes.designation][IIF(Lignes.n_lot, '  (lot ' & Lignes.n_lot & ')', '')]`, { canGrow: true, shift: false, padding: 1 }),
        T(96, 0, 16, 6.5, '[Lignes.qte]', { align: 'right', format: entier, padding: 1 }),
        T(112, 0, 26, 6.5, '[Lignes.prix_ht]', { align: 'right', format: montant, padding: 1 }),
        T(138, 0, 14, 6.5, '[Lignes.tva]', { align: 'right', format: entier, padding: 1, font: { color: MUTED } }),
        T(152, 0, 38, 6.5, '[Lignes.total_ht]', { align: 'right', format: montant, padding: 1, font: { bold: true } }),
        // filet de séparation : placé sous la désignation et qui la suit quand elle s'étend (shift)
        creerObjet('line', 0, 6.5, { w: 190, h: 0.2, direction: 'h', color: LIGNE, lineWidth: 0.15, shift: true }),
      ],
    }),
    creerBande('reportSummary', {
      name: 'Totaux', height: 46, keepWithData: true, objects: [
        T(0, 4, 105, 4, 'Arrêté le présent document à la somme de :', { font: { size: 8.5, color: MUTED } }),
        T(0, 8.5, 105, 12, `[${D}.total_lettres]`, { canGrow: true, font: { size: 9.5, bold: true } }),
        ...(D === 'Vente' ? [T(0, 24, 105, 5, "[IIF(Vente.observation, 'Observation : ' & Vente.observation, '')]", { canGrow: true, font: { size: 8.5, italic: true, color: MUTED } })] : []),
        T(118, 4, 40, 5, 'Total HT', { align: 'right' }),
        T(158, 4, 32, 5, `[${D}.total_ht]`, { align: 'right', format: montant }),
        T(118, 9.5, 40, 5, 'TVA', { align: 'right' }),
        T(158, 9.5, 32, 5, `[${D}.total_ttc - ${D}.total_ht]`, { align: 'right', format: montant }),
        ...(D === 'Vente' ? [
          T(118, 15, 40, 5, 'Timbre', { align: 'right', visible: 'Vente.timbre > 0' }),
          T(158, 15, 32, 5, '[Vente.timbre]', { align: 'right', format: montant, visible: 'Vente.timbre > 0' }),
        ] : []),
        creerObjet('line', 118, 21, { w: 72, h: 0.3, direction: 'h', color: INK, lineWidth: 0.3 }),
        T(118, 22, 40, 7, 'NET À PAYER', { align: 'right', font: gras(10.5, BRAND), valign: 'middle' }),
        T(158, 22, 32, 7, `[${D}.net_a_payer]`, { align: 'right', format: { kind: 'currency', currency: 'DA' }, font: gras(10.5, BRAND), valign: 'middle', fill: '#EEF2FF', padding: 1 }),
        T(118, 31, 40, 5, 'Réglé', { align: 'right', font: { color: MUTED, size: 8.5 } }),
        T(158, 31, 32, 5, `[${D}.regler]`, { align: 'right', format: montant, font: { color: MUTED, size: 8.5 } }),
        T(118, 36, 40, 5, 'Reste à payer', { align: 'right', font: { bold: true, size: 9 } }),
        T(158, 36, 32, 5, `[${D}.reste_a_payer]`, { align: 'right', format: montant, font: { bold: true, size: 9 } }),
      ],
    }),
    creerBande('pageFooter', {
      name: 'Pied de page', height: 9, objects: [
        creerObjet('line', 0, 0.5, { w: 190, h: 0.2, direction: 'h', color: LIGNE, lineWidth: 0.2 }),
        T(0, 2, 120, 4, "[IIF(Societe.slogan, Societe.slogan, Societe.raison_sociale)]", { font: { size: 8, color: MUTED } }),
        T(140, 2, 50, 4, 'Page [Page] / [TotalPages]', { align: 'right', font: { size: 8, color: MUTED } }),
      ],
    }),
  ];
}

function pieceA4(kind: 'vente' | 'achat'): ReportDef {
  const D = kind === 'vente' ? 'Vente' : 'Achat';
  const e = creerEtat(kind, kind === 'vente' ? 'Facture A4 — moderne' : 'Bon d’achat A4 — moderne');
  e.description = 'Modèle de démonstration : en-tête société, cadre tiers, tableau avec lignes alternées, totaux et montant en lettres.';
  e.bands = [...entete(D, e.name, kind === 'vente' ? 'Client' : 'Fournisseur'), ...tableau(D)];
  return e;
}

function ticket80(): ReportDef {
  const e = creerEtat('vente', 'Ticket de caisse 80 mm');
  e.description = 'Ticket thermique à hauteur automatique.';
  e.page = { ...creerPage('Ticket80'), margins: { top: 3, right: 3, bottom: 3, left: 3 }, continuous: true };
  const W = 74;
  e.bands = [
    creerBande('reportTitle', {
      height: 26, objects: [
        T(0, 0, W, 6, '[UPPER(Societe.raison_sociale)]', { align: 'center', font: gras(11), canGrow: true }),
        T(0, 6.5, W, 4, '[Societe.adresse]', { align: 'center', font: { size: 7.5 }, canGrow: true }),
        T(0, 10.5, W, 4, "[IIF(Societe.telephone, 'Tél : ' & Societe.telephone, '')]", { align: 'center', font: { size: 7.5 } }),
        creerObjet('line', 0, 15, { w: W, h: 0.3, direction: 'h', dash: 'dashed' }),
        T(0, 16, W, 4.5, '[Vente.titre] N° [Vente.numero]', { font: gras(9) }),
        T(0, 20.5, W, 4, "[FORMAT(Vente.date, 'dd/MM/yyyy')] — [Vente.user_name]", { font: { size: 7.5 } }),
      ],
    }),
    creerBande('data', {
      dataSource: 'Lignes', height: 9, canGrow: true, objects: [
        T(0, 0, W, 4.2, '[Lignes.designation]', { font: { size: 8 }, canGrow: true, shift: false, padding: 0.3 }),
        T(0, 4.2, 40, 4, '[Lignes.qte] × [FORMAT(Lignes.prix_ttc, "#,##0.00")]', { font: { size: 8 }, padding: 0.3, shift: true }),
        T(40, 4.2, 34, 4, '[Lignes.total_ttc]', { align: 'right', format: montant, font: { size: 8, bold: true }, padding: 0.3, shift: true }),
      ],
    }),
    creerBande('reportSummary', {
      height: 22, objects: [
        creerObjet('line', 0, 1, { w: W, h: 0.3, direction: 'h', dash: 'dashed' }),
        T(0, 2.5, 34, 6, 'NET À PAYER', { font: gras(10), valign: 'middle' }),
        T(34, 2.5, 40, 6, '[Vente.net_a_payer]', { align: 'right', format: { kind: 'currency', currency: 'DA' }, font: gras(10), valign: 'middle' }),
        T(0, 9, 34, 4, 'Réglé', { font: { size: 8 } }),
        T(34, 9, 40, 4, '[Vente.regler]', { align: 'right', format: montant, font: { size: 8 } }),
        T(0, 13, 34, 4, 'Reste', { font: { size: 8 }, visible: 'Vente.reste_a_payer > 0' }),
        T(34, 13, 40, 4, '[Vente.reste_a_payer]', { align: 'right', format: montant, font: { size: 8 }, visible: 'Vente.reste_a_payer > 0' }),
        T(0, 17.5, W, 4, 'Merci de votre visite', { align: 'center', font: { size: 8, italic: true } }),
      ],
    }),
  ];
  return e;
}

function etiquettesPrix(): ReportDef {
  const e = creerEtat('articles', 'Étiquettes de prix — 3 colonnes');
  e.description = 'Étiquettes de rayon (nom, prix TTC, code-barres), 3 par ligne sur A4.';
  e.page = { ...creerPage('A4'), margins: { top: 8, right: 8, bottom: 8, left: 8 } };
  const cell: ObjDef[] = [
    creerObjet('shape', 0, 0, { w: 60, h: 34, shape: 'rect', border: { top: true, right: true, bottom: true, left: true, color: '#9AA7BD', width: 0.2, style: 'dashed' }, name: 'Cadre' }),
    T(1.5, 1, 57, 8, '[Articles.designation]', { font: { size: 8.5, bold: true }, canGrow: false, valign: 'top' }),
    T(1.5, 10, 57, 9, '[Articles.prix_vente_ttc]', { align: 'right', font: { size: 17, bold: true, color: BRAND }, format: { kind: 'currency', currency: 'DA' }, valign: 'middle' }),
    creerObjet('barcode', 3, 20, { w: 54, h: 12, symbology: 'code128', value: '[Articles.code_bare]', showText: true }),
  ];
  e.bands = [creerBande('data', { dataSource: 'Articles', height: 34, columns: 3, columnGap: 5, objects: cell, name: 'Étiquette' })];
  return e;
}

function releveClient(): ReportDef {
  const e = creerEtat('etatClient', 'Relevé client');
  e.description = 'Mouvements du client avec solde cumulé.';
  e.bands = [
    creerBande('pageHeader', { height: 16, objects: [
      T(0, 0, 120, 7, '[UPPER(Societe.raison_sociale)]', { font: gras(13) }),
      T(0, 7.5, 120, 4, '[Societe.adresse]', { font: { size: 8.5, color: MUTED } }),
      creerObjet('line', 0, 13.5, { w: 190, h: 0.4, direction: 'h', color: BRAND, lineWidth: 0.6 }),
    ] }),
    creerBande('reportTitle', { height: 24, objects: [
      T(0, 1, 130, 8, 'RELEVÉ DE COMPTE — [Client.raison]', { font: gras(14, BRAND) }),
      T(0, 10, 130, 5, "Période du [FORMAT(Client.date_debut, 'dd/MM/yyyy')] au [FORMAT(Client.date_fin, 'dd/MM/yyyy')]"),
      T(0, 15, 130, 5, 'Code : [Client.code]   Tél : [Client.telephone]', { font: { color: MUTED, size: 8.5 } }),
    ] }),
    creerBande('dataHeader', { dataSource: 'Lignes', height: 7, objects: [
      T(0, 0, 24, 7, 'Date', { style: 'Entête de colonne', valign: 'middle', padding: 1 }),
      T(24, 0, 34, 7, 'Pièce', { style: 'Entête de colonne', valign: 'middle', padding: 1 }),
      T(58, 0, 52, 7, 'Libellé', { style: 'Entête de colonne', valign: 'middle', padding: 1 }),
      T(110, 0, 26, 7, 'Débit', { style: 'Entête de colonne', align: 'right', valign: 'middle', padding: 1 }),
      T(136, 0, 26, 7, 'Crédit', { style: 'Entête de colonne', align: 'right', valign: 'middle', padding: 1 }),
      T(162, 0, 28, 7, 'Solde', { style: 'Entête de colonne', align: 'right', valign: 'middle', padding: 1 }),
    ] }),
    creerBande('data', { dataSource: 'Lignes', height: 6, zebra: '#F7F9FC', objects: [
      T(0, 0, 24, 6, "[FORMAT(Lignes.date, 'dd/MM/yyyy')]", { padding: 1 }),
      T(24, 0, 34, 6, '[Lignes.piece]', { padding: 1 }),
      T(58, 0, 52, 6, '[Lignes.libelle]', { padding: 1 }),
      T(110, 0, 26, 6, '[Lignes.debit]', { align: 'right', format: { ...montant, hideZeros: true }, padding: 1 }),
      T(136, 0, 26, 6, '[Lignes.credit]', { align: 'right', format: { ...montant, hideZeros: true }, padding: 1 }),
      T(162, 0, 28, 6, '[Lignes.solde]', { align: 'right', format: montant, padding: 1, font: { bold: true } }),
    ] }),
    creerBande('dataFooter', { dataSource: 'Lignes', height: 9, objects: [
      creerObjet('line', 0, 0.5, { w: 190, h: 0.3, direction: 'h', color: INK, lineWidth: 0.3 }),
      T(58, 1.5, 52, 6, 'Totaux', { font: { bold: true }, padding: 1 }),
      T(110, 1.5, 26, 6, '[SUM(Lignes.debit)]', { align: 'right', format: montant, font: { bold: true }, padding: 1 }),
      T(136, 1.5, 26, 6, '[SUM(Lignes.credit)]', { align: 'right', format: montant, font: { bold: true }, padding: 1 }),
      T(162, 1.5, 28, 6, '[Client.solde]', { align: 'right', format: montant, font: { bold: true, color: BRAND }, padding: 1 }),
    ] }),
    creerBande('pageFooter', { height: 8, objects: [
      T(120, 2, 70, 4, 'Page [Page] / [TotalPages]', { align: 'right', font: { size: 8, color: MUTED } }),
    ] }),
  ];
  return e;
}

export const MODELES_INTEGRES: { id: string; build: () => ReportDef }[] = [
  { id: 'integre-facture-a4', build: () => pieceA4('vente') },
  { id: 'integre-achat-a4', build: () => pieceA4('achat') },
  { id: 'integre-ticket-80', build: ticket80 },
  { id: 'integre-etiquettes-prix', build: etiquettesPrix },
  { id: 'integre-releve-client', build: releveClient },
];

/** Déclare les modèles livrés auprès du moteur d'états. */
export function declarerModelesIntegres(): void {
  for (const m of MODELES_INTEGRES) declarerModeleIntegre(m);
}
