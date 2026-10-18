import {
  type DatasetDef, type FieldDef, type ReportDef, type TextObj,
  creerBande, creerEtat, creerObjet, creerPage,
} from '../model';
import { declarerModeleIntegre, declarerType, type KindDef } from '../registre';

/**
 * Exemple complet et générique (aucune dépendance à une application) : un type de document « facture »
 * avec son jeu d'exemple et deux modèles livrés (A4 et ticket 80 mm continu).
 * `installerExemples()` les déclare ; copiez ce fichier comme point de départ pour vos propres documents.
 */

const t = (name: string, label: string): FieldDef => ({ name, label, type: 'text' });
const n = (name: string, label: string): FieldDef => ({ name, label, type: 'number' });
const d = (name: string, label: string): FieldDef => ({ name, label, type: 'date' });

const DATASETS: DatasetDef[] = [
  { name: 'Societe', label: 'Société', mode: 'single', fields: [t('nom', 'Nom'), t('adresse', 'Adresse'), t('telephone', 'Téléphone')] },
  {
    name: 'Facture', label: 'Facture', mode: 'single',
    fields: [t('numero', 'Numéro'), d('date', 'Date'), t('client', 'Client'), t('adresse_client', 'Adresse du client'), n('total_ht', 'Total HT'), n('tva', 'TVA'), n('total_ttc', 'Total TTC')],
  },
  { name: 'Lignes', label: 'Lignes', mode: 'list', fields: [t('code', 'Code'), t('designation', 'Désignation'), n('qte', 'Quantité'), n('prix', 'Prix unitaire'), n('total', 'Total')] },
];

export const TYPE_FACTURE: KindDef = {
  id: 'facture',
  label: 'Facture (exemple)',
  datasets: DATASETS,
  sample: {
    Societe: { nom: 'ACME SARL', adresse: '12 rue des Lilas, Lyon', telephone: '04 72 00 00 00' },
    Facture: { numero: '2026-0042', date: '2026-06-15', client: 'Société Durand', adresse_client: '8 avenue de la République, Paris', total_ht: 1250, tva: 250, total_ttc: 1500 },
    Lignes: [
      { code: 'A-001', designation: 'Prestation de conseil', qte: 2, prix: 400, total: 800 },
      { code: 'A-014', designation: 'Licence annuelle — formule avancée avec support prioritaire et mises à jour incluses', qte: 1, prix: 300, total: 300 },
      { code: 'A-022', designation: 'Déplacement', qte: 1, prix: 150, total: 150 },
    ],
  },
};

const INK = '#0F1A2E', MUTED = '#5B6A86', BRAND = '#2450E0';
const T = (x: number, y: number, w: number, h: number, text: string, o: Partial<TextObj> = {}): TextObj =>
  creerObjet('text', x, y, { w, h, text, ...o }) as TextObj;

export function modeleFactureExemple(): ReportDef {
  const e = creerEtat('facture', 'Facture A4');
  e.description = 'Facture A4 : en-tête société, tableau de lignes avec pagination, totaux, pied de page numéroté.';
  e.bands = [
    creerBande('pageHeader', { name: 'En-tête de page', height: 22, objects: [
      T(0, 0, 110, 7, '[UPPER(Societe.nom)]', { font: { size: 14, bold: true, color: INK } }),
      T(0, 7.5, 110, 4, '[Societe.adresse]', { font: { size: 8.5, color: MUTED } }),
      T(0, 11.5, 110, 4, '[Societe.telephone]', { font: { size: 8.5, color: MUTED } }),
      creerObjet('line', 0, 19, { w: 190, h: 0.4, direction: 'h', color: BRAND, lineWidth: 0.6 }),
    ] }),
    creerBande('reportTitle', { name: 'Titre', height: 26, objects: [
      T(0, 2, 100, 9, 'FACTURE N° [Facture.numero]', { font: { size: 16, bold: true, color: BRAND } }),
      T(0, 12, 100, 5, "Date : [FORMAT(Facture.date, 'dd/MM/yyyy')]", { font: { size: 9.5 } }),
      T(110, 2, 80, 5, 'Client : [Facture.client]', { font: { size: 10, bold: true } }),
      T(110, 8, 80, 10, '[Facture.adresse_client]', { font: { size: 9, color: MUTED }, canGrow: true }),
    ] }),
    creerBande('dataHeader', { name: 'En-tête du tableau', dataSource: 'Lignes', height: 7, objects: [
      T(0, 0, 25, 7, 'Code', { font: { size: 8.5, bold: true, color: '#FFFFFF' }, fill: BRAND, padding: 1.5, valign: 'middle' }),
      T(25, 0, 85, 7, 'Désignation', { font: { size: 8.5, bold: true, color: '#FFFFFF' }, fill: BRAND, padding: 1.5, valign: 'middle' }),
      T(110, 0, 20, 7, 'Qté', { font: { size: 8.5, bold: true, color: '#FFFFFF' }, fill: BRAND, align: 'right', padding: 1.5, valign: 'middle' }),
      T(130, 0, 30, 7, 'Prix', { font: { size: 8.5, bold: true, color: '#FFFFFF' }, fill: BRAND, align: 'right', padding: 1.5, valign: 'middle' }),
      T(160, 0, 30, 7, 'Total', { font: { size: 8.5, bold: true, color: '#FFFFFF' }, fill: BRAND, align: 'right', padding: 1.5, valign: 'middle' }),
    ] }),
    creerBande('data', { name: 'Lignes', dataSource: 'Lignes', height: 6.5, objects: [
      T(0, 0, 25, 6.5, '[Lignes.code]', { font: { size: 9, color: MUTED }, padding: 1.5 }),
      T(25, 0, 85, 6.5, '[Lignes.designation]', { font: { size: 9 }, padding: 1.5, canGrow: true }),
      T(110, 0, 20, 6.5, '[Lignes.qte]', { font: { size: 9 }, align: 'right', padding: 1.5, format: { kind: 'number', pattern: '#,##0.##' } }),
      T(130, 0, 30, 6.5, '[Lignes.prix]', { font: { size: 9 }, align: 'right', padding: 1.5, format: { kind: 'number', pattern: '#,##0.00' } }),
      T(160, 0, 30, 6.5, '[Lignes.total]', { font: { size: 9, bold: true }, align: 'right', padding: 1.5, format: { kind: 'number', pattern: '#,##0.00' } }),
      creerObjet('line', 0, 6.5, { w: 190, h: 0.2, direction: 'h', color: '#D5DDEC', lineWidth: 0.2, shift: true }),
    ] }),
    creerBande('reportSummary', { name: 'Totaux', height: 24, objects: [
      T(110, 3, 50, 5, 'Total HT', { align: 'right', font: { size: 9.5 } }),
      T(160, 3, 30, 5, '[Facture.total_ht]', { align: 'right', font: { size: 9.5 }, format: { kind: 'number', pattern: '#,##0.00' } }),
      T(110, 8.5, 50, 5, 'TVA', { align: 'right', font: { size: 9.5 } }),
      T(160, 8.5, 30, 5, '[Facture.tva]', { align: 'right', font: { size: 9.5 }, format: { kind: 'number', pattern: '#,##0.00' } }),
      T(110, 15, 50, 6, 'Total TTC', { align: 'right', font: { size: 11, bold: true, color: BRAND } }),
      T(160, 15, 30, 6, '[Facture.total_ttc]', { align: 'right', font: { size: 11, bold: true, color: BRAND }, format: { kind: 'number', pattern: '#,##0.00' } }),
    ] }),
    creerBande('pageFooter', { name: 'Pied de page', height: 8, objects: [
      T(0, 2, 120, 4, '[Societe.nom] — [Societe.telephone]', { font: { size: 8, color: MUTED } }),
      T(120, 2, 70, 4, 'Page [Page] / [TotalPages]', { align: 'right', font: { size: 8, color: MUTED } }),
    ] }),
  ];
  return e;
}

export function modeleTicketExemple(): ReportDef {
  const e = creerEtat('facture', 'Ticket 80 mm');
  e.description = 'Ticket thermique à hauteur automatique.';
  e.page = { ...creerPage('Ticket80'), margins: { top: 3, right: 3, bottom: 3, left: 3 }, continuous: true };
  e.bands = [
    creerBande('reportTitle', { height: 16, objects: [
      T(0, 0, 74, 6, '[UPPER(Societe.nom)]', { align: 'center', font: { size: 11, bold: true }, canGrow: true }),
      T(0, 6.5, 74, 5, 'Facture [Facture.numero]', { align: 'center', font: { size: 9 } }),
    ] }),
    creerBande('data', { dataSource: 'Lignes', height: 10, objects: [
      T(0, 0, 74, 5, '[Lignes.designation]', { font: { size: 8.5 }, canGrow: true }),
      T(0, 5, 40, 4.5, '[Lignes.qte] × [FORMAT(Lignes.prix, \'#,##0.00\')]', { font: { size: 8 }, shift: true }),
      T(40, 5, 34, 4.5, '[FORMAT(Lignes.total, \'#,##0.00\')]', { align: 'right', font: { size: 8.5, bold: true }, shift: true }),
    ] }),
    creerBande('reportSummary', { height: 10, objects: [
      T(0, 2, 40, 6, 'TOTAL TTC', { font: { size: 10, bold: true } }),
      T(40, 2, 34, 6, '[FORMAT(Facture.total_ttc, \'#,##0.00\')]', { align: 'right', font: { size: 10, bold: true } }),
    ] }),
  ];
  return e;
}

/** Déclare le type « facture » et les deux modèles d'exemple. */
export function installerExemples(): void {
  declarerType(TYPE_FACTURE);
  declarerModeleIntegre({ id: 'exemple-facture-a4', build: modeleFactureExemple });
  declarerModeleIntegre({ id: 'exemple-ticket-80', build: modeleTicketExemple });
}
