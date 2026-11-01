import { declarerType, type DatasetDef, type FieldDef, type KindDef, type ReportData } from '@softly/report/core';
import { arreteLaSomme } from '../lib/enLettres';
import type { Achat, Article, LigneVente, Vente } from '../api/types';
import type { Societe } from '../print/templates/partials';
import type {
  ArreteCaisseData, BonStock, BordereauLigne, Etat104Ligne, Etat104Totaux, InventaireEntete, InventaireLigne, JournalLigne,
  RecouvrementLigne, RecouvrementTotaux, TicketVentesLigne,
} from './donnees';

/**
 * Types de documents imprimables par les états personnalisés (métier Gestion Commerciale). Pour chaque type :
 *  - les jeux de données (champs) exposés dans l'arbre « Données » du designer ;
 *  - un jeu d'exemple réaliste (aperçu dans le designer, sans accès à l'agent) ;
 *  - l'adaptateur `donnees*` qui transforme les données réelles de l'application en `ReportData`.
 * Les adaptateurs reçoivent les MÊMES arguments que les anciens gabarits `build*Print` (src/print/templates).
 */

const t = (name: string, label?: string): FieldDef => ({ name, label, type: 'text' });
const n = (name: string, label?: string): FieldDef => ({ name, label, type: 'number' });
const d = (name: string, label?: string): FieldDef => ({ name, label, type: 'date' });
const b = (name: string, label?: string): FieldDef => ({ name, label, type: 'boolean' });
const img = (name: string, label?: string): FieldDef => ({ name, label, type: 'image' });
const un = (name: string, label: string, fields: FieldDef[]): DatasetDef => ({ name, label, mode: 'single', fields });
const liste = (name: string, label: string, fields: FieldDef[]): DatasetDef => ({ name, label, mode: 'list', fields });

const SOCIETE = un('Societe', 'Société', [
  t('raison_sociale', 'Raison sociale'), t('adresse', 'Adresse'), t('telephone', 'Téléphone'), t('fax', 'Fax'),
  t('email', 'E-mail'), t('site_web', 'Site web'), t('rc', 'RC'), t('nif', 'NIF'), t('nis', 'NIS'), t('art', 'Article d’imposition'),
  t('capital', 'Capital'), t('rib', 'RIB'), t('banque', 'Banque'), t('slogan', 'Slogan'), img('logo', 'Logo'),
]);

const LIGNES_PIECE: FieldDef[] = [
  t('code_article', 'Code'), t('designation', 'Désignation'), n('qte', 'Quantité'), t('unite', 'Unité'),
  n('prix_ht', 'Prix HT'), n('prix_ttc', 'Prix TTC'), n('remise', 'Remise %'), n('tva', 'TVA %'),
  n('total_ht', 'Total HT'), n('total_ttc', 'Total TTC'), t('n_lot', 'N° lot'), d('date_peremption', 'Péremption'),
];

const TOTAUX_CHAMPS: FieldDef[] = [t('libelle', 'Libellé'), n('montant', 'Montant'), b('final', 'Ligne finale'), b('info', 'Ligne d’information'), t('ton', 'Ton (danger / ok)')];

const societeExemple = {
  raison_sociale: 'EURL BNK TECHNOLOGIE', adresse: '12 rue des Frères Bouadou, Alger', telephone: '023 45 67 89',
  fax: '023 45 67 90', email: 'contact@bnk.dz', site_web: 'www.bnk.dz', rc: '16/00-1234567B20', nif: '001916123456789',
  nis: '001916010012345', art: '16012345678', capital: 5000000, rib: '00200134 0123456789 12', banque: 'BNA Alger Centre',
  slogan: 'Qualité et service depuis 2010', logo: '',
};

const lignesExemple = [
  { code_article: 'AR001', designation: 'Réactif hormonal TSH 100 tests', qte: 2, unite: 'BTE', prix_ht: 18500, prix_ttc: 22015, remise: 0, tva: 19, total_ht: 37000, total_ttc: 44030, n_lot: '20250901', date_peremption: '2027-03-31' },
  { code_article: 'AR014', designation: 'Cône jetable 200 µl (sachet de 1000)', qte: 5, unite: 'SAC', prix_ht: 1200, prix_ttc: 1428, remise: 5, tva: 19, total_ht: 5700, total_ttc: 6783, n_lot: '', date_peremption: '' },
  { code_article: 'AR022', designation: 'Contrôle qualité niveau 2 — très longue désignation pour tester le retour à la ligne automatique', qte: 1, unite: 'KIT', prix_ht: 9800, prix_ttc: 11662, remise: 0, tva: 19, total_ht: 9800, total_ttc: 11662, n_lot: 'L-882', date_peremption: '2026-12-31' },
  { code_article: 'AR031', designation: 'Gants nitrile taille M', qte: 10, unite: 'BTE', prix_ht: 650, prix_ttc: 773.5, remise: 0, tva: 19, total_ht: 6500, total_ttc: 7735, n_lot: '', date_peremption: '' },
];

const venteExemple = {
  id: 12, numero: '0012/2026', type_doc: 'FA', titre: 'Facture', date: '2026-06-15', code_cli: 'C0042', raison: 'LABORATOIRE EL AMEL',
  tel: '0550 12 34 56', adresse: 'Cité 1er Novembre, Blida', rc: '09/00-0012345', nif: '000909012345678', nis: '000909010012345', art: '09012345678',
  total_ht: 58000, total_ttc: 69025, net_a_payer: 69025, regler: 20000, reste_a_payer: 49025, remise: 0, remise_p: 0,
  total_taxe: 11025, tva: 19, timbre: 0, mode_payement: 'Espèce', observation: 'Livraison sous 48 h', user_name: 'Admin',
  date_echeance: '2026-07-15', total_lettres: arreteLaSomme(69025), caissier: 'Admin', recu: 70000, rendu: 975,
};

type Totaux = { libelle: string; montant: number; final?: boolean; info?: boolean; ton?: string };

/** Lignes de totaux d'une pièce : seules les lignes applicables existent (remise, timbre, réglé / reste). */
function totauxPiece(p: Record<string, unknown>, avecTimbre = true): Totaux[] {
  const l: Totaux[] = [{ libelle: 'Total HT', montant: Number(p.total_ht) || 0 }];
  if (Number(p.remise) > 0) l.push({ libelle: 'Remise', montant: -Number(p.remise) });
  l.push({ libelle: 'TVA', montant: Number(p.total_taxe) || 0 });
  if (avecTimbre && Number(p.timbre) > 0) l.push({ libelle: 'Droit de timbre', montant: Number(p.timbre) });
  l.push({ libelle: 'Net à payer', montant: Number(p.net_a_payer) || 0, final: true });
  if (Number(p.regler) > 0) {
    l.push({ libelle: 'Réglé', montant: Number(p.regler), info: true, ton: 'ok' });
    l.push({ libelle: 'Reste à payer', montant: Number(p.reste_a_payer) || 0, info: true, ton: Number(p.reste_a_payer) > 0 ? 'danger' : 'ok' });
  }
  return l;
}

/** Date « il y a n jours » au format AAAA-MM-JJ (jeux d'exemple relatifs au jour courant). */
const jours = (nb: number) => { const x = new Date(); x.setDate(x.getDate() - nb); return x.toISOString().slice(0, 10); };

const KINDS: Record<string, KindDef> = {
  vente: {
    id: 'vente', label: 'Pièce de vente (facture, BL, bon, avoir, ticket)',
    datasets: [
      SOCIETE,
      un('Vente', 'Pièce', [
        t('numero', 'Numéro'), t('type_doc', 'Type (FA, BL…)'), t('titre', 'Titre du document'), d('date', 'Date'),
        t('code_cli', 'Code client'), t('raison', 'Client'), t('tel', 'Téléphone client'), t('adresse', 'Adresse client'),
        t('rc', 'RC client'), t('nif', 'NIF client'), t('nis', 'NIS client'), t('art', 'Art. imp. client'),
        n('total_ht', 'Total HT'), n('total_taxe', 'Total TVA'), n('total_ttc', 'Total TTC'),
        n('remise', 'Remise (montant)'), n('remise_p', 'Remise %'), n('timbre', 'Droit de timbre'), n('net_a_payer', 'Net à payer'),
        n('regler', 'Réglé'), n('reste_a_payer', 'Reste à payer'), t('mode_payement', 'Mode de paiement'), d('date_echeance', 'Échéance'),
        t('observation', 'Observation'), t('user_name', 'Utilisateur'), t('total_lettres', 'Montant en lettres'),
        t('caissier', 'Caissier (ticket)'), n('recu', 'Espèces reçues (ticket)'), n('rendu', 'Rendu (ticket)'),
      ]),
      liste('Lignes', 'Lignes de la pièce', LIGNES_PIECE),
      liste('Totaux', 'Lignes de totaux', TOTAUX_CHAMPS),
      liste('Reglements', 'Règlements', [d('date', 'Date'), n('montant', 'Montant'), t('mode_payement', 'Mode'), t('banque', 'Banque'), t('num_cheque', 'N° chèque')]),
    ],
    sample: { Societe: societeExemple, Vente: venteExemple, Lignes: lignesExemple, Totaux: totauxPiece(venteExemple), Reglements: [{ date: '2026-06-15', montant: 20000, mode_payement: 'Espèce', banque: '', num_cheque: '' }] },
  },

  achat: {
    id: 'achat', label: 'Pièce d’achat (facture, BR, BC…)',
    datasets: [
      SOCIETE,
      un('Achat', 'Pièce', [
        t('numero', 'Numéro'), t('type_doc', 'Type'), t('titre', 'Titre du document'), d('date', 'Date'), t('code_four', 'Code fournisseur'),
        t('raison', 'Fournisseur'), t('tel', 'Téléphone fournisseur'), n('total_ht', 'Total HT'), n('total_taxe', 'Total TVA'), n('total_ttc', 'Total TTC'),
        n('remise', 'Remise'), n('net_a_payer', 'Net à payer'), n('regler', 'Réglé'), n('reste_a_payer', 'Reste à payer'),
        t('mode_payement', 'Mode de paiement'), t('total_lettres', 'Montant en lettres'),
      ]),
      liste('Lignes', 'Lignes de la pièce', LIGNES_PIECE),
      liste('Totaux', 'Lignes de totaux', TOTAUX_CHAMPS),
    ],
    sample: {
      Societe: societeExemple,
      Achat: { numero: '0007/2026', type_doc: 'BR', titre: 'Bon de réception', date: '2026-06-10', code_four: 'F005', raison: 'SARL MEDIPHARM', tel: '021 98 76 54', total_ht: 58000, total_taxe: 11025, total_ttc: 69025, remise: 0, net_a_payer: 69025, regler: 0, reste_a_payer: 69025, mode_payement: 'Virement', total_lettres: arreteLaSomme(69025) },
      Lignes: lignesExemple,
      Totaux: totauxPiece({ total_ht: 58000, total_taxe: 11025, net_a_payer: 69025, regler: 0, reste_a_payer: 69025 }, false),
    },
  },

  articles: {
    id: 'articles', label: 'Articles (état du stock, étiquettes de prix)',
    datasets: [
      SOCIETE,
      un('Etat', 'État', [t('filtre', 'Filtre / libellé'), n('nb_articles', 'Nombre d’articles'), n('valeur_pmp', 'Valeur du stock (PMP)'), n('en_alerte', 'Articles en alerte'), n('en_rupture', 'Articles en rupture')]),
      liste('Articles', 'Articles', [
        t('code', 'Code'), t('designation', 'Désignation'), t('famille', 'Famille'), t('unite_mesure', 'Unité'), t('code_bare', 'Code-barres'),
        n('prix_vente_ht', 'Prix de vente HT'), n('prix_vente_ttc', 'Prix de vente TTC'), n('prix_achat_ht', 'Prix d’achat HT'), n('pmp', 'PMP'), n('tva', 'TVA %'),
        n('qte_reale', 'Stock'), n('stock_min', 'Stock minimum'), n('valeur_pmp', 'Valeur (PMP)'), b('alerte', 'En alerte'), b('rupture', 'En rupture'),
      ]),
    ],
    sample: (() => {
      const articles = Array.from({ length: 24 }, (_, i) => {
        const pmp = 700 + i * 100, q = [20, 12, 0, 4, 35, 8][i % 6] + (i % 4);
        const stockMin = 5;
        return {
          code: `AR${String(i + 1).padStart(3, '0')}`, designation: ['Réactif TSH 100 tests', 'Cône jetable 200 µl', 'Gants nitrile M', 'Pipette 10-100 µl', 'Tubes EDTA 4 ml', 'Alcool 70° 1 L'][i % 6],
          famille: ['Réactifs', 'Consommables', 'Équipement'][i % 3], unite_mesure: 'BTE', code_bare: `600${String(100000000 + i * 137).padStart(9, '0')}`,
          prix_vente_ht: 1000 + i * 150, prix_vente_ttc: (1000 + i * 150) * 1.19, prix_achat_ht: pmp, pmp, tva: 19, qte_reale: q, stock_min: stockMin,
          valeur_pmp: q > 0 ? q * pmp : 0, alerte: q > 0 && q <= stockMin, rupture: q <= 0,
        };
      });
      return {
        Societe: societeExemple,
        Etat: { filtre: 'Tous les articles', nb_articles: articles.length, valeur_pmp: articles.reduce((s, a) => s + a.valeur_pmp, 0), en_alerte: articles.filter((a) => a.alerte).length, en_rupture: articles.filter((a) => a.rupture).length },
        Articles: articles,
      };
    })(),
  },

  etatClient: {
    id: 'etatClient', label: 'Relevé client',
    datasets: [
      SOCIETE,
      un('Client', 'Client', [
        t('code_cli', 'Code'), t('nom_client', 'Nom'), t('periode', 'Période'), n('ca', 'Chiffre d’affaires'), n('credit_initial', 'Crédit initial'), n('total_ventes', 'Total ventes'),
        n('total_avoirs', 'Total avoirs'), n('regler', 'Total réglé'), n('solde_avance', 'Avances'), n('credit', 'Solde dû'),
      ]),
      liste('Lignes', 'Mouvements', [d('date', 'Date'), t('type_doc', 'Opération'), t('numero', 'N°'), t('mode_payement', 'Mode'), n('montant', 'Montant'), n('total_cumul', 'Solde cumulé')]),
    ],
    sample: {
      Societe: societeExemple,
      Client: { code_cli: 'C0042', nom_client: 'LABORATOIRE EL AMEL', periode: 'Période : 01/01/2026 → 30/06/2026', ca: 149025, credit_initial: 12000, total_ventes: 149025, total_avoirs: 0, regler: 70000, solde_avance: 0, credit: 91025 },
      Lignes: [
        { date: '2026-01-12', type_doc: 'Facture', numero: 'FA 0003/2026', mode_payement: 'Chèque', montant: 80000, total_cumul: 92000 },
        { date: '2026-02-03', type_doc: 'Règlement', numero: 'RG 0007', mode_payement: 'Espèce', montant: -50000, total_cumul: 42000 },
        { date: '2026-04-20', type_doc: 'Facture', numero: 'FA 0009/2026', mode_payement: 'Virement', montant: 69025, total_cumul: 111025 },
        { date: '2026-06-15', type_doc: 'Règlement', numero: 'RG 0012', mode_payement: 'Espèce', montant: -20000, total_cumul: 91025 },
      ],
    },
  },

  etatFournisseur: {
    id: 'etatFournisseur', label: 'Relevé fournisseur',
    datasets: [
      SOCIETE,
      un('Fournisseur', 'Fournisseur', [
        t('code_four', 'Code'), t('nom', 'Nom'), t('periode', 'Période'), n('credit_initial', 'Crédit initial'), n('total_achats', 'Total achats'),
        n('total_retours', 'Total retours'), n('regler', 'Total réglé'), n('remboursements', 'Remboursements'), n('credit', 'Solde dû'),
      ]),
      liste('Lignes', 'Mouvements', [d('date', 'Date'), t('type_doc', 'Opération'), t('numero', 'N°'), t('mode_payement', 'Mode'), n('montant', 'Montant'), n('total_cumul', 'Solde cumulé')]),
    ],
    sample: {
      Societe: societeExemple,
      Fournisseur: { code_four: 'F005', nom: 'SARL MEDIPHARM', periode: 'Relevé complet', credit_initial: 0, total_achats: 258000, total_retours: 12000, regler: 150000, remboursements: 0, credit: 96000 },
      Lignes: [
        { date: '2026-02-02', type_doc: 'Bon de réception', numero: 'BR 0004/2026', mode_payement: 'Virement', montant: 140000, total_cumul: 140000 },
        { date: '2026-03-10', type_doc: 'Règlement', numero: 'RG 0021', mode_payement: 'Chèque', montant: -100000, total_cumul: 40000 },
        { date: '2026-06-10', type_doc: 'Bon de réception', numero: 'BR 0007/2026', mode_payement: 'Virement', montant: 118000, total_cumul: 158000 },
        { date: '2026-06-18', type_doc: 'Retour', numero: 'BRT 0001', mode_payement: '', montant: -12000, total_cumul: 146000 },
        { date: '2026-06-25', type_doc: 'Règlement', numero: 'RG 0030', mode_payement: 'Virement', montant: -50000, total_cumul: 96000 },
      ],
    },
  },

  impayes: {
    id: 'impayes', label: 'Situation des impayés d’un client',
    datasets: [
      SOCIETE,
      un('Client', 'Client', [t('code_cli', 'Code'), t('nom', 'Nom'), n('nb', 'Nombre de pièces'), n('total_facture', 'Total facturé'), n('total_regle', 'Total réglé'), n('total_du', 'Total dû')]),
      liste('Factures', 'Factures non réglées', [t('type_facture', 'Type'), t('numero', 'N°'), d('date', 'Date'), t('mode_payement', 'Mode'), n('net_a_payer', 'Montant'), n('regler', 'Réglé'), n('reste_a_payer', 'Reste'), n('jours', 'Jours de retard')]),
    ],
    sample: {
      Societe: societeExemple,
      Client: { code_cli: 'C0042', nom: 'LABORATOIRE EL AMEL', nb: 3, total_facture: 218050, total_regle: 90000, total_du: 128050 },
      Factures: [
        { type_facture: 'Facture', numero: 'FA 0003/2026', date: jours(120), mode_payement: 'Chèque', net_a_payer: 80000, regler: 50000, reste_a_payer: 30000, jours: 120 },
        { type_facture: 'Facture', numero: 'FA 0009/2026', date: jours(60), mode_payement: 'Virement', net_a_payer: 69025, regler: 40000, reste_a_payer: 29025, jours: 60 },
        { type_facture: 'Bon de livraison', numero: 'BL 0044/2026', date: jours(12), mode_payement: '', net_a_payer: 69025, regler: 0, reste_a_payer: 69025, jours: 12 },
      ],
    },
  },

  creances: {
    id: 'creances', label: 'État des créances (débiteurs)',
    datasets: [
      SOCIETE,
      un('Etat', 'Synthèse', [n('total_clients', 'Clients'), n('total_factures', 'Factures'), n('total_creances', 'Total des créances'), n('bucket_0_30', '0–30 jours'), n('bucket_30_60', '30–60 jours'), n('bucket_60_plus', '+60 jours')]),
      liste('Debiteurs', 'Débiteurs', [t('code_cli', 'Code'), t('raison', 'Client'), n('nb_factures', 'Factures'), n('jours_retard', 'Retard (jours)'), n('montant', 'Créance')]),
    ],
    sample: {
      Societe: societeExemple,
      Etat: { total_clients: 5, total_factures: 11, total_creances: 612300, bucket_0_30: 210000, bucket_30_60: 180300, bucket_60_plus: 222000 },
      Debiteurs: [
        { code_cli: 'C0042', raison: 'LABORATOIRE EL AMEL', nb_factures: 3, jours_retard: 78, montant: 222000 },
        { code_cli: 'C0017', raison: 'CLINIQUE AL SHIFA', nb_factures: 2, jours_retard: 41, montant: 180300 },
        { code_cli: 'C0003', raison: 'PHARMACIE CENTRALE', nb_factures: 4, jours_retard: 18, montant: 140000 },
        { code_cli: 'C0099', raison: 'CABINET DR BENALI', nb_factures: 1, jours_retard: 9, montant: 45000 },
        { code_cli: 'C0120', raison: 'SARL BIOLAB', nb_factures: 1, jours_retard: 4, montant: 25000 },
      ],
    },
  },

  recouvrement: {
    id: 'recouvrement', label: 'État de recouvrement',
    datasets: [
      SOCIETE,
      un('Etat', 'Synthèse', [t('critere', 'Critère'), n('nb_clients', 'Clients'), n('total_du', 'Total dû'), n('du_en_retard', 'En retard'), n('echu', 'Échu'), n('b_0_30', '0–30 j'), n('b_31_60', '31–60 j'), n('b_61_90', '61–90 j'), n('b_90_plus', '+90 j')]),
      liste('Clients', 'Clients', [t('code_cli', 'Code'), t('raison', 'Client'), t('tel', 'Téléphone'), n('nb_pieces', 'Pièces'), d('plus_ancienne', 'Plus ancienne'), n('jours_max', 'Jours max'), n('total_du', 'Dû total'), n('du_en_retard', 'En retard'), n('echu', 'Échu')]),
    ],
    sample: {
      Societe: societeExemple,
      Etat: { critere: 'Créances de plus de 30 jours', nb_clients: 3, total_du: 442300, du_en_retard: 402300, echu: 180300, b_0_30: 40000, b_31_60: 180300, b_61_90: 82000, b_90_plus: 140000 },
      Clients: [
        { code_cli: 'C0042', raison: 'LABORATOIRE EL AMEL', tel: '0550 12 34 56', nb_pieces: 3, plus_ancienne: jours(120), jours_max: 120, total_du: 222000, du_en_retard: 222000, echu: 140000 },
        { code_cli: 'C0017', raison: 'CLINIQUE AL SHIFA', tel: '0661 22 33 44', nb_pieces: 2, plus_ancienne: jours(61), jours_max: 61, total_du: 180300, du_en_retard: 180300, echu: 40300 },
        { code_cli: 'C0003', raison: 'PHARMACIE CENTRALE', tel: '021 45 67 89', nb_pieces: 1, plus_ancienne: jours(15), jours_max: 15, total_du: 40000, du_en_retard: 0, echu: 0 },
      ],
    },
  },

  tresorerie: {
    id: 'tresorerie', label: 'État de trésorerie',
    datasets: [
      SOCIETE,
      un('Compte', 'Compte', [t('nom', 'Compte'), t('periode', 'Période'), n('nb', 'Mouvements'), n('solde_initial', 'Solde initial'), n('total_credit', 'Total crédits'), n('total_debit', 'Total débits'), n('solde_final', 'Solde final')]),
      liste('Mouvements', 'Mouvements', [d('date', 'Date'), t('categorie', 'Catégorie'), t('libelle', 'Tiers / libellé'), t('mode_payement', 'Mode'), n('montant', 'Montant'), n('solde_cumul', 'Solde cumulé')]),
    ],
    sample: {
      Societe: societeExemple,
      Compte: { nom: 'Caisse principale', periode: '01/06/2026 → 30/06/2026', nb: 6, solde_initial: 120000, total_credit: 215000, total_debit: 62000, solde_final: 273000 },
      Mouvements: [
        { date: '2026-06-02', categorie: 'Vente', libelle: 'LABORATOIRE EL AMEL', mode_payement: 'Espèce', montant: 80000, solde_cumul: 200000 },
        { date: '2026-06-05', categorie: 'Dépense', libelle: 'Carburant', mode_payement: 'Espèce', montant: -12000, solde_cumul: 188000 },
        { date: '2026-06-09', categorie: 'Vente', libelle: 'CLINIQUE AL SHIFA', mode_payement: 'Chèque', montant: 95000, solde_cumul: 283000 },
        { date: '2026-06-15', categorie: 'Achat', libelle: 'SARL MEDIPHARM', mode_payement: 'Virement', montant: -50000, solde_cumul: 233000 },
        { date: '2026-06-21', categorie: 'Vente', libelle: 'PHARMACIE CENTRALE', mode_payement: 'Espèce', montant: 40000, solde_cumul: 273000 },
      ],
    },
  },

  arreteCaisse: {
    id: 'arreteCaisse', label: 'Arrêté de caisse',
    datasets: [
      SOCIETE,
      un('Arrete', 'Arrêté', [
        t('compte', 'Compte / caisse'), d('date', 'Date'), t('reference', 'Référence'), n('solde_ouverture', 'Ouverture espèces'), n('total_entrees', 'Entrées espèces'),
        n('total_sorties', 'Sorties espèces'), n('solde_theorique', 'Espèces théoriques'), b('compte_saisi', 'Comptage saisi'), n('montant_compte', 'Montant compté'), n('ecart', 'Écart'), t('utilisateur', 'Caissier'),
      ]),
      liste('Modes', 'Récapitulatif par mode', [t('mode', 'Mode'), n('entrees', 'Entrées'), n('sorties', 'Sorties'), n('net', 'Net')]),
      liste('Mouvements', 'Mouvements de la journée', [t('categorie', 'Catégorie'), t('libelle', 'Tiers / libellé'), t('mode_payement', 'Mode'), n('montant', 'Montant')]),
    ],
    sample: {
      Societe: societeExemple,
      Arrete: { compte: 'Caisse principale', date: jours(0), reference: '20260630-1', solde_ouverture: 50000, total_entrees: 133000, total_sorties: 18000, solde_theorique: 165000, compte_saisi: true, montant_compte: 164500, ecart: -500, utilisateur: 'Admin' },
      Modes: [{ mode: 'Espèce', entrees: 98000, sorties: 18000, net: 80000 }, { mode: 'Chèque', entrees: 25000, sorties: 0, net: 25000 }, { mode: 'Virement', entrees: 10000, sorties: 0, net: 10000 }],
      Mouvements: [
        { categorie: 'Vente', libelle: 'PHARMACIE CENTRALE', mode_payement: 'Espèce', montant: 60000 },
        { categorie: 'Vente', libelle: 'CABINET DR BENALI', mode_payement: 'Chèque', montant: 25000 },
        { categorie: 'Dépense', libelle: 'Fournitures de bureau', mode_payement: 'Espèce', montant: -18000 },
        { categorie: 'Vente', libelle: 'SARL BIOLAB', mode_payement: 'Espèce', montant: 38000 },
      ],
    },
  },

  bonStock: {
    id: 'bonStock', label: 'Bon d’entrée / de sortie de stock',
    datasets: [
      SOCIETE,
      un('Bon', 'Bon', [t('titre', 'Titre (entrée / sortie)'), t('numero', 'Numéro'), d('date', 'Date'), t('depot', 'Dépôt'), t('motif', 'Motif'), t('agent', 'Agent'), t('observation', 'Observation'), n('nb_lignes', 'Lignes'), n('total', 'Valeur totale'), b('entree', 'Bon d’entrée')]),
      liste('Lignes', 'Lignes', [t('code_article', 'Code'), t('designation', 'Désignation'), n('qte', 'Quantité'), t('unite', 'Unité'), n('prix_unitaire', 'Prix unitaire'), n('total', 'Total')]),
    ],
    sample: {
      Societe: societeExemple,
      Bon: { titre: 'Bon d’entrée', numero: 'BE-0021', date: '2026-06-12', depot: 'Dépôt principal', motif: 'Régularisation d’inventaire', agent: 'Admin', observation: 'Caisse retrouvée au rayon B', nb_lignes: 3, total: 51500, entree: true },
      Lignes: [
        { code_article: 'AR001', designation: 'Réactif hormonal TSH 100 tests', qte: 2, unite: 'BTE', prix_unitaire: 18500, total: 37000 },
        { code_article: 'AR014', designation: 'Cône jetable 200 µl (sachet de 1000)', qte: 5, unite: 'SAC', prix_unitaire: 1200, total: 6000 },
        { code_article: 'AR031', designation: 'Gants nitrile taille M', qte: 13, unite: 'BTE', prix_unitaire: 650, total: 8450 },
      ],
    },
  },

  bordereau: {
    id: 'bordereau', label: 'Bordereau de pièces (ventes / achats)',
    datasets: [
      SOCIETE,
      un('Bordereau', 'Bordereau', [t('titre', 'Titre'), t('tiers_label', 'Libellé du tiers'), t('periode', 'Période'), n('nb', 'Pièces'), n('total_net', 'Total net'), n('total_regle', 'Total réglé'), n('total_reste', 'Total reste')]),
      liste('Lignes', 'Pièces', [t('numero', 'N° pièce'), d('date', 'Date'), t('tiers', 'Tiers'), t('mode_payement', 'Mode'), n('net', 'Net à payer'), n('regler', 'Réglé'), n('reste', 'Reste')]),
    ],
    sample: {
      Societe: societeExemple,
      Bordereau: { titre: 'Bordereau des ventes', tiers_label: 'Client', periode: 'du 01/06/2026 au 30/06/2026', nb: 5, total_net: 372400, total_regle: 201000, total_reste: 171400 },
      Lignes: [
        { numero: 'FA 0012/2026', date: '2026-06-15', tiers: 'LABORATOIRE EL AMEL', mode_payement: 'Espèce', net: 69025, regler: 20000, reste: 49025 },
        { numero: 'FA 0013/2026', date: '2026-06-16', tiers: 'CLINIQUE AL SHIFA', mode_payement: 'Chèque', net: 120000, regler: 120000, reste: 0 },
        { numero: 'BL 0044/2026', date: '2026-06-18', tiers: 'PHARMACIE CENTRALE', mode_payement: '', net: 99375, regler: 0, reste: 99375 },
        { numero: 'FA 0014/2026', date: '2026-06-22', tiers: 'CABINET DR BENALI', mode_payement: 'Espèce', net: 45000, regler: 45000, reste: 0 },
        { numero: 'FA 0015/2026', date: '2026-06-28', tiers: 'SARL BIOLAB', mode_payement: 'Virement', net: 39000, regler: 16000, reste: 23000 },
      ],
    },
  },

  journal: {
    id: 'journal', label: 'Journal des ventes / achats (ligne à ligne)',
    datasets: [
      SOCIETE,
      un('Journal', 'Journal', [t('titre', 'Titre'), b('vente', 'Journal des ventes'), t('periode', 'Période'), n('nb', 'Lignes'), n('total_qte', 'Quantité totale'), n('total_ttc', 'Total TTC'), n('total_marge', 'Marge totale')]),
      liste('Lignes', 'Lignes', [d('date', 'Date'), t('numero', 'Pièce'), t('code_article', 'Code'), t('designation', 'Désignation'), t('n_lot', 'Lot'), n('qte', 'Quantité'), n('prix_ht', 'Prix HT'), n('total_ttc', 'Total TTC'), n('total_marge', 'Marge')]),
    ],
    sample: {
      Societe: societeExemple,
      Journal: { titre: 'Journal des ventes', vente: true, periode: 'du 01/06/2026 au 30/06/2026', nb: 5, total_qte: 33, total_ttc: 165482, total_marge: 31560 },
      Lignes: [
        { date: '2026-06-15', numero: 'FA 0012/2026', code_article: 'AR001', designation: 'Réactif hormonal TSH 100 tests', n_lot: '20250901', qte: 2, prix_ht: 18500, total_ttc: 44030, total_marge: 7000 },
        { date: '2026-06-15', numero: 'FA 0012/2026', code_article: 'AR014', designation: 'Cône jetable 200 µl', n_lot: '', qte: 5, prix_ht: 1200, total_ttc: 6783, total_marge: 1000 },
        { date: '2026-06-16', numero: 'FA 0013/2026', code_article: 'AR022', designation: 'Contrôle qualité niveau 2', n_lot: 'L-882', qte: 1, prix_ht: 9800, total_ttc: 11662, total_marge: -400 },
        { date: '2026-06-18', numero: 'BL 0044/2026', code_article: 'AR031', designation: 'Gants nitrile taille M', n_lot: '', qte: 10, prix_ht: 650, total_ttc: 7735, total_marge: 1500 },
        { date: '2026-06-22', numero: 'FA 0014/2026', code_article: 'AR005', designation: 'Tubes EDTA 4 ml', n_lot: '', qte: 15, prix_ht: 1750, total_ttc: 31237, total_marge: 22460 },
      ],
    },
  },

  inventaire: {
    id: 'inventaire', label: 'Inventaire (état chiffré, feuille de comptage)',
    datasets: [
      SOCIETE,
      un('Inventaire', 'Inventaire', [t('titre', 'Titre'), b('vierge', 'Feuille de comptage vierge'), t('designation', 'Désignation'), d('date', 'Date'), n('nb', 'Articles'), n('valeur_theorique', 'Valeur théorique'), n('valeur_reale', 'Valeur comptée'), n('ecart_valeur', 'Écart de valorisation')]),
      liste('Lignes', 'Articles inventoriés', [t('code_article', 'Code'), t('designation', 'Désignation'), t('depot', 'Dépôt'), n('qte_theorique', 'Théorique'), n('qte_reale', 'Compté'), n('ecart', 'Écart'), n('valeur_ecart', 'Valeur de l’écart')]),
    ],
    sample: {
      Societe: societeExemple,
      Inventaire: { titre: 'Inventaire — état', vierge: false, designation: 'Inventaire du 30/06/2026', date: '2026-06-30', nb: 5, valeur_theorique: 385000, valeur_reale: 368500, ecart_valeur: -16500 },
      Lignes: [
        { code_article: 'AR001', designation: 'Réactif hormonal TSH 100 tests', depot: 'Principal', qte_theorique: 12, qte_reale: 12, ecart: 0, valeur_ecart: 0 },
        { code_article: 'AR014', designation: 'Cône jetable 200 µl (sachet de 1000)', depot: 'Principal', qte_theorique: 40, qte_reale: 38, ecart: -2, valeur_ecart: -2400 },
        { code_article: 'AR022', designation: 'Contrôle qualité niveau 2', depot: 'Froid', qte_theorique: 6, qte_reale: 7, ecart: 1, valeur_ecart: 9800 },
        { code_article: 'AR031', designation: 'Gants nitrile taille M', depot: 'Principal', qte_theorique: 90, qte_reale: 70, ecart: -20, valeur_ecart: -13000 },
        { code_article: 'AR005', designation: 'Tubes EDTA 4 ml', depot: 'Principal', qte_theorique: 30, qte_reale: 29, ecart: -1, valeur_ecart: -1750 },
      ],
    },
  },

  etat104: {
    id: 'etat104', label: 'État 104 (chiffre d’affaires par client)',
    datasets: [
      SOCIETE,
      un('Etat', 'Synthèse', [t('periode', 'Période'), t('perimetre', 'Périmètre'), n('nb_clients', 'Clients'), n('montant_ht', 'Total HT'), n('tva', 'Total TVA'), n('montant_ttc', 'Total TTC'), n('incomplets', 'Identifiants manquants')]),
      liste('Clients', 'Clients', [t('raison', 'Client'), t('adresse', 'Adresse'), t('rc', 'RC'), t('nif', 'NIF'), t('nis', 'NIS'), t('art', 'Art. imp.'), n('nb_pieces', 'Pièces'), n('montant_ht', 'Montant HT'), n('tva', 'TVA'), n('montant_ttc', 'Montant TTC'), b('incomplet', 'Incomplet')]),
    ],
    sample: {
      Societe: societeExemple,
      Etat: { periode: '01/01/2026 → 31/12/2026', perimetre: 'Chiffre d’affaires par client — factures de vente, déduction faite des avoirs.', nb_clients: 3, montant_ht: 482000, tva: 91580, montant_ttc: 573580, incomplets: 1 },
      Clients: [
        { raison: 'LABORATOIRE EL AMEL', adresse: 'Cité 1er Novembre, Blida', rc: '09/00-0012345', nif: '000909012345678', nis: '000909010012345', art: '09012345678', nb_pieces: 6, montant_ht: 260000, tva: 49400, montant_ttc: 309400, incomplet: false },
        { raison: 'CLINIQUE AL SHIFA', adresse: 'Route de Médéa, Alger', rc: '16/00-7654321', nif: '001616765432100', nis: '001616010054321', art: '16000111222', nb_pieces: 4, montant_ht: 150000, tva: 28500, montant_ttc: 178500, incomplet: false },
        { raison: 'CABINET DR BENALI', adresse: 'Tipaza', rc: '', nif: '', nis: '', art: '', nb_pieces: 2, montant_ht: 72000, tva: 13680, montant_ttc: 85680, incomplet: true },
      ],
    },
  },

  ticketVentes: {
    id: 'ticketVentes', label: 'Ticket « articles / familles vendus »',
    datasets: [
      SOCIETE,
      un('Ticket', 'Ticket', [t('titre', 'Titre'), d('debut', 'Début'), d('fin', 'Fin'), n('nb', 'Lignes'), n('qte_totale', 'Quantité totale'), n('total', 'Total TTC')]),
      liste('Lignes', 'Lignes', [t('libelle', 'Libellé'), n('qte', 'Quantité'), n('total_ttc', 'Total TTC')]),
    ],
    sample: {
      Societe: societeExemple,
      Ticket: { titre: 'Articles vendus', debut: '2026-06-01', fin: '2026-06-30', nb: 4, qte_totale: 60, total: 96480 },
      Lignes: [
        { libelle: 'Gants nitrile taille M', qte: 30, total_ttc: 23205 },
        { libelle: 'Cône jetable 200 µl', qte: 18, total_ttc: 20570 },
        { libelle: 'Réactif TSH 100 tests', qte: 8, total_ttc: 35220 },
        { libelle: 'Tubes EDTA 4 ml', qte: 4, total_ttc: 17485 },
      ],
    },
  },

  recuTransfert: {
    id: 'recuTransfert', label: 'Reçu de transfert d’espèces',
    datasets: [
      SOCIETE,
      un('Transfert', 'Transfert', [d('date', 'Date'), t('source', 'De (caisse)'), t('destination', 'Vers (caisse)'), n('montant', 'Montant'), t('utilisateur', 'Caissier'), t('observation', 'Observation')]),
    ],
    sample: { Societe: societeExemple, Transfert: { date: '2026-06-30', source: 'Caisse comptoir', destination: 'Caisse principale', montant: 150000, utilisateur: 'Admin', observation: 'Versement de fin de journée' } },
  },
};

/** Déclare les types métier auprès du moteur d'états (ordre = ordre d'affichage). */
export function declarerTypesMetier(): void {
  for (const k of Object.values(KINDS)) declarerType(k);
}

// ─── Adaptateurs : données réelles → données d'état ─────────────────────────

const TITRES_VENTE: Record<string, string> = {
  FA: 'Facture', BL: 'Bon de livraison', BC: 'Bon de commande', BCT: 'Bon de comptoir', FP: 'Facture proforma', FAV: 'Facture d’avoir', BRT: 'Bon de retour',
};
const TITRES_ACHAT: Record<string, string> = {
  FA: 'Facture d’achat', BR: 'Bon de réception', BC: 'Bon de commande', DO: 'Demande d’offre', FAV: 'Avoir fournisseur', BRT: 'Bon de retour',
};

function societeDonnees(s: Societe | null | undefined) {
  const x = (s ?? {}) as Record<string, unknown>;
  return Object.fromEntries(Object.keys(societeExemple).map((k) => [k, x[k] ?? '']));
}

const num = (v: unknown) => Number(v ?? 0) || 0;
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const periodeTexte = (debut?: string, fin?: string) => (debut || fin ? `du ${debut ? new Date(debut).toLocaleDateString('fr-DZ') : '…'} au ${fin ? new Date(fin).toLocaleDateString('fr-DZ') : '…'}` : '');
const intervalle = (debut?: string, fin?: string) => `${debut ? new Date(debut).toLocaleDateString('fr-DZ') : '…'} → ${fin ? new Date(fin).toLocaleDateString('fr-DZ') : '…'}`;

export type TicketExtras = { caissier?: string | null; recu?: number; rendu?: number };

export function donneesVente(vente: Vente, societe?: Societe | null, extras: TicketExtras = {}): ReportData {
  const v = vente as Vente & Record<string, unknown>;
  return {
    Societe: societeDonnees(societe),
    Vente: {
      ...v, titre: TITRES_VENTE[vente.type_doc] ?? vente.type_doc, total_lettres: arreteLaSomme(num(vente.net_a_payer)),
      caissier: extras.caissier || vente.user_name || '', recu: num(extras.recu), rendu: num(extras.rendu),
    },
    Lignes: (vente.lignes ?? []) as LigneVente[],
    Totaux: totauxPiece(v),
    Reglements: vente.reglements ?? [],
  };
}

export function donneesAchat(achat: Achat, societe?: Societe | null): ReportData {
  const a = achat as Achat & Record<string, unknown>;
  const lignes = ((a.lignes as Record<string, unknown>[]) ?? []);
  // TVA : Total_Taxe de la pièce, sinon somme des TVA des lignes (la colonne « TVA » de l'entête Delphi vaut 0)
  const tva = num(a.total_taxe) || lignes.reduce((s, l) => s + (num(l.total_ttc) - num(l.total_ht)), 0);
  return {
    Societe: societeDonnees(societe),
    Achat: {
      ...a, raison: achat.raison ?? achat.fournisseur ?? '', code_four: achat.code_four ?? achat.code_cli ?? '', titre: TITRES_ACHAT[achat.type_doc] ?? achat.type_doc,
      total_taxe: tva, total_lettres: arreteLaSomme(num(achat.net_a_payer)),
    },
    Lignes: lignes,
    Totaux: totauxPiece({ ...a, total_taxe: tva }, false),
  };
}

export function donneesArticles(articles: Article[], societe?: Societe | null, filtre?: string): ReportData {
  const lignes = articles.map((a) => {
    const q = num(a.qte_reale), pmp = num((a as Record<string, unknown>).pmp), min = num(a.stock_min);
    return { ...a, pmp, valeur_pmp: q > 0 ? q * pmp : 0, alerte: min > 0 && q > 0 && q <= min, rupture: q <= 0 };
  });
  return {
    Societe: societeDonnees(societe),
    Etat: {
      filtre: filtre || 'Tous les articles', nb_articles: lignes.length, valeur_pmp: lignes.reduce((s, l) => s + l.valeur_pmp, 0),
      en_alerte: lignes.filter((l) => l.alerte).length, en_rupture: lignes.filter((l) => l.rupture).length,
    },
    Articles: lignes,
  };
}

type CreditClient = {
  code_cli: string; nom_client: string; credit_initial: number; total_ventes: number; total_avoirs: number; regler: number; credit: number; solde_avance: number; ca: number;
};
type LigneReleve = { type_doc: string; numero?: string | null; date: string; montant: number; total_cumul: number; mode_payement?: string | null };

export function donneesEtatClient({ client, lignes, debut, fin }: { client: CreditClient; lignes: LigneReleve[]; debut?: string; fin?: string }, societe?: Societe | null): ReportData {
  return {
    Societe: societeDonnees(societe),
    Client: { ...client, periode: debut || fin ? `Période : ${intervalle(debut, fin)}` : 'Relevé complet' },
    Lignes: lignes,
  };
}

export function donneesEtatFournisseur(
  { fournisseur, lignes, debut, fin }: { fournisseur: Record<string, unknown> & { code_four: string; nom?: string | null }; lignes: LigneReleve[]; debut?: string; fin?: string },
  societe?: Societe | null,
): ReportData {
  return {
    Societe: societeDonnees(societe),
    Fournisseur: { ...fournisseur, nom: fournisseur.nom || fournisseur.code_four, periode: debut || fin ? `Période : ${intervalle(debut, fin)}` : 'Relevé complet' },
    Lignes: lignes,
  };
}

type FactureNR = { id: number; numero: string; type_facture: string; date: string; net_a_payer: number; regler: number; reste_a_payer: number; mode_payement?: string | null };

export function donneesImpayes({ codeCli, nom, factures }: { codeCli: string; nom: string; factures: FactureNR[] }, societe?: Societe | null): ReportData {
  const maintenant = Date.now();
  return {
    Societe: societeDonnees(societe),
    Client: {
      code_cli: codeCli, nom: nom || codeCli, nb: factures.length, total_facture: factures.reduce((s, f) => s + num(f.net_a_payer), 0),
      total_regle: factures.reduce((s, f) => s + num(f.regler), 0), total_du: factures.reduce((s, f) => s + num(f.reste_a_payer), 0),
    },
    Factures: factures.map((f) => ({ ...f, jours: Math.max(0, Math.floor((maintenant - new Date(f.date).getTime()) / 86400000)) })),
  };
}

type Debiteur = Record<string, unknown> & { code_cli?: string; raison?: string; montant?: number; nb_factures?: number; jours_retard?: number };
type DebiteursTotaux = { total_clients: number; total_factures: number; total_creances: number; bucket_0_30: number; bucket_30_60: number; bucket_60_plus: number };

export function donneesCreances({ rows, totaux }: { rows: Debiteur[]; totaux: DebiteursTotaux }, societe?: Societe | null): ReportData {
  return { Societe: societeDonnees(societe), Etat: totaux, Debiteurs: rows };
}

export function donneesRecouvrement({ rows, totaux, nbrjour, inactifs }: { rows: RecouvrementLigne[]; totaux: RecouvrementTotaux; nbrjour: number; inactifs: boolean }, societe?: Societe | null): ReportData {
  return {
    Societe: societeDonnees(societe),
    Etat: { ...totaux, nb_clients: rows.length, critere: inactifs ? `Clients sans pièce depuis plus de ${nbrjour} jours` : `Créances de plus de ${nbrjour} jours` },
    Clients: rows,
  };
}

type Mouvement = Record<string, unknown> & { cle?: string; date?: string; categorie?: string | null; tier?: string | null; objet?: string | null; code_tier?: string | null; observation?: string | null; mode_payement?: string | null; montant?: number; solde_cumul?: number };

export function donneesTresorerie(
  { res, compte, debut, fin }: { res: { data?: Mouvement[]; solde_initial?: number; total_credit?: number; total_debit?: number; solde_final?: number; total?: number }; compte: string; debut?: string; fin?: string },
  societe?: Societe | null,
): ReportData {
  const rows = res.data ?? [];
  return {
    Societe: societeDonnees(societe),
    Compte: { nom: compte, periode: intervalle(debut, fin), nb: res.total ?? rows.length, solde_initial: num(res.solde_initial), total_credit: num(res.total_credit), total_debit: num(res.total_debit), solde_final: num(res.solde_final) },
    Mouvements: rows.map((m) => ({ ...m, categorie: m.categorie ?? String(m.cle ?? '').replace(/\d+$/, '') ?? '', libelle: m.tier || m.objet || m.code_tier || m.observation || '' })),
  };
}

export function donneesArreteCaisse({ arrete, montantCompte, utilisateur }: { arrete: ArreteCaisseData; montantCompte?: number | null; utilisateur?: string | null }, societe?: Societe | null): ReportData {
  const compte = arrete.compte || (arrete.compte_id != null ? `Compte ${arrete.compte_id}` : 'Caisse');
  const compte_ = montantCompte ?? arrete.montant_compte ?? null;
  return {
    Societe: societeDonnees(societe),
    Arrete: {
      compte, date: arrete.date, reference: `${String(arrete.date).slice(0, 10).replace(/-/g, '')}-${arrete.compte_id ?? 0}`,
      solde_ouverture: num(arrete.solde_ouverture), total_entrees: num(arrete.total_entrees), total_sorties: num(arrete.total_sorties), solde_theorique: num(arrete.solde_theorique),
      compte_saisi: compte_ != null, montant_compte: compte_ != null ? num(compte_) : 0, ecart: compte_ != null ? num(compte_) - num(arrete.solde_theorique) : 0, utilisateur: utilisateur ?? '',
    },
    Modes: arrete.par_mode.map((p) => ({ mode: p.mode || '—', entrees: num(p.entrees), sorties: num(p.sorties), net: num(p.entrees) - num(p.sorties) })),
    Mouvements: arrete.mouvements.map((m) => ({ ...m, categorie: m.categorie ?? m.cle.replace(/\d+$/, ''), libelle: m.raison || m.objet || '', montant: num(m.montant) })),
  };
}

export function donneesBonStock({ bon, sens }: { bon: BonStock; sens: 'entree' | 'sortie' }, societe?: Societe | null): ReportData {
  const lignes = bon.lignes ?? [];
  return {
    Societe: societeDonnees(societe),
    Bon: {
      titre: sens === 'entree' ? 'Bon d’entrée' : 'Bon de sortie', numero: bon.numero || String(bon.id), date: bon.date ?? '', depot: bon.depot ?? '', motif: bon.motif ?? '', agent: bon.agent ?? '',
      observation: bon.observation ?? '', nb_lignes: lignes.length, entree: sens === 'entree',
      total: num(bon.total_ht ?? bon.valeur_total ?? lignes.reduce((s, l) => s + num(l.total), 0)),
    },
    Lignes: lignes.map((l) => ({ ...l, total: l.total ?? num(l.qte) * num(l.prix_unitaire) })),
  };
}

export function donneesBordereau({ titre, tiersLabel, lignes, debut, fin }: { titre: string; tiersLabel: string; lignes: BordereauLigne[]; debut?: string; fin?: string }, societe?: Societe | null): ReportData {
  return {
    Societe: societeDonnees(societe),
    Bordereau: {
      titre, tiers_label: tiersLabel, periode: periodeTexte(debut, fin) || new Date().toLocaleDateString('fr-DZ'), nb: lignes.length,
      total_net: lignes.reduce((s, l) => s + num(l.net), 0), total_regle: lignes.reduce((s, l) => s + num(l.regler), 0), total_reste: lignes.reduce((s, l) => s + num(l.reste), 0),
    },
    Lignes: lignes,
  };
}

export function donneesJournal({ sens, lignes, debut, fin }: { sens: 'vente' | 'achat'; lignes: JournalLigne[]; debut?: string; fin?: string }, societe?: Societe | null): ReportData {
  return {
    Societe: societeDonnees(societe),
    Journal: {
      titre: sens === 'vente' ? 'Journal des ventes' : 'Journal des achats', vente: sens === 'vente', periode: periodeTexte(debut, fin) || new Date().toLocaleDateString('fr-DZ'),
      nb: lignes.length, total_qte: lignes.reduce((s, l) => s + num(l.qte), 0), total_ttc: lignes.reduce((s, l) => s + num(l.total_ttc), 0), total_marge: lignes.reduce((s, l) => s + num(l.total_marge), 0),
    },
    Lignes: lignes,
  };
}

export function donneesInventaire({ inv, lignes, vierge = false }: { inv: InventaireEntete; lignes: InventaireLigne[]; vierge?: boolean }, societe?: Societe | null): ReportData {
  return {
    Societe: societeDonnees(societe),
    Inventaire: {
      titre: vierge ? 'Feuille de comptage' : 'Inventaire — état', vierge, designation: inv.designation || `${lignes.length} article(s)`, date: inv.date ?? aujourdhui(), nb: lignes.length,
      valeur_theorique: num(inv.valeur_theorique), valeur_reale: num(inv.valeur_reale), ecart_valeur: num(inv.ecart_valeur),
    },
    Lignes: lignes.map((l) => ({ ...l, valeur_ecart: num(l.valeur_reale) - num(l.valeur_theorique) })),
  };
}

export function donneesEtat104({ rows, totaux, debut, fin, inclureBl }: { rows: Etat104Ligne[]; totaux: Etat104Totaux; debut: string; fin: string; inclureBl: boolean }, societe?: Societe | null): ReportData {
  return {
    Societe: societeDonnees(societe),
    Etat: {
      periode: intervalle(debut, fin), nb_clients: totaux.nb_clients, montant_ht: totaux.montant_ht, tva: totaux.tva, montant_ttc: totaux.montant_ttc, incomplets: totaux.incomplets,
      perimetre: `Chiffre d’affaires par client — factures de vente${inclureBl ? ' et bons de livraison non facturés' : ''}, déduction faite des avoirs.`,
    },
    Clients: rows,
  };
}

export function donneesTicketVentes({ titre, debut, fin, lignes }: { titre: string; debut: string; fin: string; lignes: TicketVentesLigne[] }, societe?: Societe | null): ReportData {
  return {
    Societe: societeDonnees(societe),
    Ticket: { titre, debut, fin, nb: lignes.length, qte_totale: lignes.reduce((s, l) => s + num(l.qte), 0), total: lignes.reduce((s, l) => s + num(l.total_ttc), 0) },
    Lignes: lignes,
  };
}

export function donneesRecuTransfert(
  { source, destination, montant, date, utilisateur, observation }: { source: string; destination: string; montant: number; date: string; utilisateur?: string | null; observation?: string | null },
  societe?: Societe | null,
): ReportData {
  return { Societe: societeDonnees(societe), Transfert: { source, destination, montant: num(montant), date, utilisateur: utilisateur ?? '', observation: observation ?? '' } };
}
