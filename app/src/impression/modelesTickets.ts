import { creerBande, creerObjet, type BandDef, type ObjDef, type ReportDef } from '@softly/report/core';
import { FMT, THEMES, T, bandeDe, nouvelEtat, type Ctx } from './kit';

/**
 * Tickets thermiques (80 et 58 mm, hauteur continue) : ticket de caisse, « articles vendus », reçu de transfert.
 * Noir sur blanc (imprimantes thermiques), séparateurs en pointillés, chiffres tabulaires.
 */

const th = THEMES.classique;
const NOIR = '#000000';
const tiret = (ctx: Ctx, y: number): ObjDef => creerObjet('line', 0, y, { w: ctx.cw, h: 0.3, direction: 'h', color: NOIR, lineWidth: 0.25, dash: 'dashed', name: 'Séparateur' });
const centre = (ctx: Ctx, y: number, h: number, text: string, o: Parameters<typeof T>[6] = {}) => T(ctx, 0, y, ctx.cw, h, text, { align: 'center', color: NOIR, canGrow: true, ...o });

/** Logo (bande masquée s'il n'y en a pas) puis bloc société centré terminé par un séparateur. */
function bandesSociete(ctx: Ctx, k: number): BandDef[] {
  const logo = bandeDe('reportTitle', 'Logo', {
    objs: [creerObjet('image', (ctx.cw - 18 * k) / 2, 0, { w: 18 * k, h: 12 * k, expr: 'Societe.logo', fit: 'contain', name: 'Logo' })], h: 13 * k,
  }, { visible: 'NOT ISEMPTY(Societe.logo)' });
  const societe = bandeDe('reportTitle', 'Société', {
    objs: [
      centre(ctx, 0, 5.5 * k, '[UPPER(Societe.raison_sociale)]', { size: 11 * k, bold: true }),
      centre(ctx, 5.8 * k, 3.6 * k, '[Societe.adresse]', { size: 7.5 * k, shift: true }),
      centre(ctx, 9.4 * k, 3.6 * k, "[IIF(Societe.telephone, 'Tél : ' & Societe.telephone, '')]", { size: 7.5 * k, shift: true }),
      tiret(ctx, 13.4 * k),
    ], h: 14.4 * k,
  });
  return [logo, societe];
}

const nouveauTicket = (nom: string, description: string, kind: string, format: 'Ticket80' | 'Ticket58') => nouvelEtat(kind, nom, description, { format, th });

// ─── Ticket de caisse ───────────────────────────────────────────────────────

function ticketVente(format: 'Ticket80' | 'Ticket58'): ReportDef {
  const k = format === 'Ticket80' ? 1 : 0.72;
  const mm = format === 'Ticket80' ? '80' : '58';
  const { def, ctx } = nouveauTicket(`Ticket de caisse ${mm} mm`, `Ticket thermique ${mm} mm à hauteur automatique : lignes, totaux, règlement, rendu monnaie et code-barres de la pièce.`, 'vente', format);
  const { cw } = ctx;
  const infos: ObjDef[] = [
    centre(ctx, 0.5, 5 * k, '[UPPER(Vente.titre)]  N° [Vente.numero]', { size: 9.5 * k, bold: true }),
    centre(ctx, 5.5 * k, 4 * k, "[FORMAT(Vente.date, 'dd/MM/yyyy')]   [IIF(Vente.caissier, 'Caissier : ' & Vente.caissier, '')]", { size: 7.5 * k, shift: true }),
    centre(ctx, 9.5 * k, 4 * k, "[IIF(Vente.raison, 'Client : ' & Vente.raison, '')]", { size: 7.5 * k, shift: true }),
    tiret(ctx, 14 * k),
  ];
  const hL = 9 * k;
  const ligne: ObjDef[] = [
    T(ctx, 0, 0, cw, 4.2 * k, '[Lignes.designation]', { size: 8.3 * k, bold: true, color: NOIR, canGrow: true, name: 'Désignation' }),
    T(ctx, 0, 4.4 * k, cw * 0.62, 4 * k, "[FORMAT(Lignes.qte, '#,##0.###')] × [FORMAT(Lignes.prix_ttc, '#,##0.00')]", { size: 8 * k, color: NOIR, shift: true, name: 'Quantité × prix' }),
    T(ctx, cw * 0.55, 4.4 * k, cw * 0.45, 4 * k, '[Lignes.total_ttc]', { size: 8.5 * k, bold: true, align: 'right', family: 'Consolas', color: NOIR, format: FMT.money, shift: true, name: 'Total ligne' }),
  ];
  const hT = 5.2 * k;
  const totaux: ObjDef[] = [
    T(ctx, 0, 0, cw * 0.6, hT, '[Totaux.libelle]', {
      size: 8.3 * k, color: NOIR, valign: 'middle', highlight: [{ when: 'Totaux.final', font: { size: 11 * k, bold: true } }, { when: 'Totaux.info', font: { size: 8 * k } }], name: 'Libellé',
    }),
    T(ctx, cw * 0.4, 0, cw * 0.6, hT, '[Totaux.montant]', {
      size: 8.5 * k, bold: true, align: 'right', family: 'Consolas', color: NOIR, valign: 'middle', format: FMT.money, highlight: [{ when: 'Totaux.final', font: { size: 11.5 * k, bold: true } }], name: 'Montant',
    }),
  ];
  const fin: ObjDef[] = [
    tiret(ctx, 0.5),
    centre(ctx, 2, 4 * k, '[COUNT(Lignes)] article(s) — Merci de votre visite', { size: 7.5 * k, bold: true }),
    creerObjet('barcode', (cw - Math.min(cw, 58 * k)) / 2, 7.5 * k, { w: Math.min(cw, 58 * k), h: 10 * k, symbology: 'code128', value: '[Vente.numero]', showText: true, name: 'Code-barres' }),
  ];
  def.bands = [
    ...bandesSociete(ctx, k),
    bandeDe('reportTitle', 'Pièce', { objs: infos, h: 15 * k }),
    creerBande('data', { name: 'Lignes', dataSource: 'Lignes', height: hL, objects: ligne, canGrow: true }),
    bandeDe('reportSummary', 'Séparateur', { objs: [tiret(ctx, 0.5)], h: 2 }),
    creerBande('data', { name: 'Totaux', dataSource: 'Totaux', height: hT, objects: totaux }),
    bandeDe('reportSummary', 'Pied du ticket', { objs: fin, h: 20 * k }),
  ];
  return def;
}

// ─── Articles vendus ────────────────────────────────────────────────────────

function ticketArticlesVendus(): ReportDef {
  const { def, ctx } = nouveauTicket('Ticket « articles vendus » 80 mm', 'Libellés vendus sur une période avec quantité et chiffre d’affaires TTC.', 'ticketVentes', 'Ticket80');
  const { cw } = ctx;
  const titre: ObjDef[] = [
    centre(ctx, 0.5, 5, '[UPPER(Ticket.titre)]', { size: 10, bold: true }),
    centre(ctx, 6, 4, "Du [FORMAT(Ticket.debut, 'dd/MM/yyyy')] au [FORMAT(Ticket.fin, 'dd/MM/yyyy')]", { size: 7.5 }),
    tiret(ctx, 11),
  ];
  const ligne: ObjDef[] = [
    T(ctx, 0, 0, cw * 0.58, 4.4, '[Lignes.libelle]', { size: 8.3, color: NOIR, canGrow: true, name: 'Libellé' }),
    T(ctx, cw * 0.55, 0, cw * 0.15, 4.4, '[Lignes.qte]', { size: 8.3, color: NOIR, align: 'right', family: 'Consolas', format: FMT.qty, name: 'Quantité' }),
    T(ctx, cw * 0.68, 0, cw * 0.32, 4.4, '[Lignes.total_ttc]', { size: 8.5, bold: true, color: NOIR, align: 'right', family: 'Consolas', format: FMT.money, name: 'Total' }),
  ];
  const resume: ObjDef[] = [
    tiret(ctx, 0.5),
    T(ctx, 0, 2, cw * 0.6, 4.2, 'Quantité totale', { size: 8.3, bold: true, color: NOIR }),
    T(ctx, cw * 0.5, 2, cw * 0.5, 4.2, '[Ticket.qte_totale]', { size: 8.5, bold: true, align: 'right', family: 'Consolas', color: NOIR, format: FMT.qty }),
    T(ctx, 0, 6.6, cw * 0.5, 5.5, 'TOTAL TTC', { size: 11, bold: true, color: NOIR }),
    T(ctx, cw * 0.4, 6.6, cw * 0.6, 5.5, "[FORMAT(Ticket.total, '#,##0.00')] DA", { size: 11.5, bold: true, align: 'right', family: 'Consolas', color: NOIR }),
    tiret(ctx, 13),
    centre(ctx, 14.5, 4, '[Ticket.nb] ligne(s)', { size: 7.5 }),
  ];
  def.bands = [
    ...bandesSociete(ctx, 1),
    bandeDe('reportTitle', 'Titre', { objs: titre, h: 12 }),
    creerBande('data', { name: 'Lignes', dataSource: 'Lignes', height: 4.6, objects: ligne, canGrow: true }),
    bandeDe('reportSummary', 'Totaux', { objs: resume, h: 20 }),
  ];
  return def;
}

// ─── Reçu de transfert ──────────────────────────────────────────────────────

function recuTransfert(): ReportDef {
  const { def, ctx } = nouveauTicket('Reçu de transfert 80 mm', 'Reçu de transfert d’espèces entre caisses avec zone de signature.', 'recuTransfert', 'Ticket80');
  const { cw } = ctx;
  const ligne = (y: number, label: string, expr: string): ObjDef[] => [
    T(ctx, 0, y, cw * 0.4, 4.6, label, { size: 8.3, color: NOIR }),
    T(ctx, cw * 0.35, y, cw * 0.65, 4.6, `[${expr}]`, { size: 8.5, bold: true, align: 'right', color: NOIR, canGrow: true }),
  ];
  const objs: ObjDef[] = [
    centre(ctx, 0.5, 5.5, 'REÇU DE TRANSFERT', { size: 11, bold: true }),
    tiret(ctx, 7),
    ...ligne(8.5, 'Date', "FORMAT(Transfert.date, 'dd/MM/yyyy')"),
    ...ligne(13.5, 'De', 'Transfert.source'),
    ...ligne(18.5, 'Vers', 'Transfert.destination'),
    ...ligne(23.5, 'Caissier', 'Transfert.utilisateur'),
    tiret(ctx, 29),
    T(ctx, 0, 31, cw * 0.4, 6, 'MONTANT', { size: 11, bold: true, color: NOIR, valign: 'middle' }),
    T(ctx, cw * 0.3, 31, cw * 0.7, 6, "[FORMAT(Transfert.montant, '#,##0.00')] DA", { size: 12, bold: true, align: 'right', family: 'Consolas', color: NOIR, valign: 'middle' }),
    tiret(ctx, 38),
    T(ctx, 0, 39.5, cw, 8, "[IIF(Transfert.observation, Transfert.observation, '')]", { size: 8, color: NOIR, canGrow: true }),
    T(ctx, 0, 51, cw, 4.5, 'Signature :', { size: 8, color: NOIR, shift: true }),
    creerObjet('line', 0, 61, { w: cw, h: 0.3, direction: 'h', color: NOIR, lineWidth: 0.25, shift: true }),
  ];
  def.bands = [...bandesSociete(ctx, 1), bandeDe('reportTitle', 'Reçu', { objs, h: 64 })];
  return def;
}

export const MODELES_TICKETS: { id: string; build: () => ReportDef }[] = [
  { id: 'integre-ticket-80', build: () => ticketVente('Ticket80') },
  { id: 'integre-ticket-58', build: () => ticketVente('Ticket58') },
  { id: 'integre-ticket-articles-vendus', build: ticketArticlesVendus },
  { id: 'integre-recu-transfert', build: recuTransfert },
];
