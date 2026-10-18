import { declarerType, type DatasetDef, type FieldDef, type KindDef, type ReportData } from '@softly/report';
import { arreteLaSomme } from '../lib/enLettres';
import type { Achat, Article, LigneVente, Vente } from '../api/types';
import type { Societe } from '../print/templates/partials';

/**
 * Types de documents imprimables par les états personnalisés (métier Gestion Commerciale). Pour chaque type :
 *  - les jeux de données (champs) exposés dans l'arbre « Données » du designer ;
 *  - un jeu d'exemple réaliste (aperçu dans le designer, sans accès à l'agent) ;
 *  - l'adaptateur qui transforme la vraie pièce de l'application en `ReportData`.
 */

const t = (name: string, label?: string): FieldDef => ({ name, label, type: 'text' });
const n = (name: string, label?: string): FieldDef => ({ name, label, type: 'number' });
const d = (name: string, label?: string): FieldDef => ({ name, label, type: 'date' });
const img = (name: string, label?: string): FieldDef => ({ name, label, type: 'image' });

const SOCIETE: DatasetDef = {
  name: 'Societe', label: 'Société', mode: 'single',
  fields: [
    t('raison_sociale', 'Raison sociale'), t('adresse', 'Adresse'), t('telephone', 'Téléphone'), t('fax', 'Fax'),
    t('email', 'E-mail'), t('site_web', 'Site web'), t('rc', 'RC'), t('nif', 'NIF'), t('nis', 'NIS'), t('art', 'Article d’imposition'),
    t('slogan', 'Slogan'), img('logo', 'Logo'),
  ],
};

const LIGNES_PIECE: FieldDef[] = [
  t('code_article', 'Code'), t('designation', 'Désignation'), n('qte', 'Quantité'), t('unite', 'Unité'),
  n('prix_ht', 'Prix HT'), n('prix_ttc', 'Prix TTC'), n('remise', 'Remise %'), n('tva', 'TVA %'),
  n('total_ht', 'Total HT'), n('total_ttc', 'Total TTC'), t('n_lot', 'N° lot'), d('date_peremption', 'Péremption'),
];

const societeExemple = {
  raison_sociale: 'EURL BNK TECHNOLOGIE', adresse: '12 rue des Frères Bouadou, Alger', telephone: '023 45 67 89',
  fax: '', email: 'contact@bnk.dz', site_web: 'www.bnk.dz', rc: '16/00-1234567B20', nif: '001916123456789',
  nis: '001916010012345', art: '16012345678', slogan: 'Qualité et service depuis 2010', logo: '',
};

const lignesExemple = [
  { code_article: 'AR001', designation: 'Réactif hormonal TSH 100 tests', qte: 2, unite: 'BTE', prix_ht: 18500, prix_ttc: 22015, remise: 0, tva: 19, total_ht: 37000, total_ttc: 44030, n_lot: '20250901', date_peremption: '2027-03-31' },
  { code_article: 'AR014', designation: 'Cône jetable 200 µl (sachet de 1000)', qte: 5, unite: 'SAC', prix_ht: 1200, prix_ttc: 1428, remise: 5, tva: 19, total_ht: 5700, total_ttc: 6783, n_lot: '', date_peremption: '' },
  { code_article: 'AR022', designation: 'Contrôle qualité niveau 2 — très longue désignation pour tester le retour à la ligne automatique', qte: 1, unite: 'KIT', prix_ht: 9800, prix_ttc: 11662, remise: 0, tva: 19, total_ht: 9800, total_ttc: 11662, n_lot: 'L-882', date_peremption: '2026-12-31' },
  { code_article: 'AR031', designation: 'Gants nitrile taille M', qte: 10, unite: 'BTE', prix_ht: 650, prix_ttc: 773.5, remise: 0, tva: 19, total_ht: 6500, total_ttc: 7735, n_lot: '', date_peremption: '' },
];

const venteExemple = {
  id: 12, numero: '0012/2026', type_doc: 'FA', titre: 'Facture', date: '2026-06-15', code_cli: 'C0042', raison: 'LABORATOIRE EL AMEL',
  tel: '0550 12 34 56', adresse: 'Cité 1er Novembre, Blida', rc: '09/00-0012345', nif: '000909012345678',
  total_ht: 58000, total_ttc: 69025, net_a_payer: 69025, regler: 20000, reste_a_payer: 49025, remise: 0, remise_p: 0,
  total_taxe: 11025, tva: 19, timbre: 0, mode_payement: 'Espèce', observation: 'Livraison sous 48 h', user_name: 'Admin',
  date_echeance: '2026-07-15', total_lettres: arreteLaSomme(69025),
};

const KINDS: Record<string, KindDef> = {
  vente: {
    id: 'vente', label: 'Pièce de vente (facture, BL, BC…)',
    datasets: [
      SOCIETE,
      {
        name: 'Vente', label: 'Pièce', mode: 'single',
        fields: [
          t('numero', 'Numéro'), t('type_doc', 'Type (FA, BL…)'), t('titre', 'Titre du document'), d('date', 'Date'),
          t('code_cli', 'Code client'), t('raison', 'Client'), t('tel', 'Téléphone client'), t('adresse', 'Adresse client'),
          t('rc', 'RC client'), t('nif', 'NIF client'), n('total_ht', 'Total HT'), n('total_taxe', 'Total TVA'), n('total_ttc', 'Total TTC'),
          n('remise', 'Remise (montant)'), n('remise_p', 'Remise %'), n('timbre', 'Droit de timbre'), n('net_a_payer', 'Net à payer'),
          n('regler', 'Réglé'), n('reste_a_payer', 'Reste à payer'), t('mode_payement', 'Mode de paiement'), d('date_echeance', 'Échéance'),
          t('observation', 'Observation'), t('user_name', 'Utilisateur'), t('total_lettres', 'Montant en lettres'),
        ],
      },
      { name: 'Lignes', label: 'Lignes de la pièce', mode: 'list', fields: LIGNES_PIECE },
      {
        name: 'Reglements', label: 'Règlements', mode: 'list',
        fields: [d('date', 'Date'), n('montant', 'Montant'), t('mode_payement', 'Mode'), t('banque', 'Banque'), t('num_cheque', 'N° chèque')],
      },
    ],
    sample: { Societe: societeExemple, Vente: venteExemple, Lignes: lignesExemple, Reglements: [{ date: '2026-06-15', montant: 20000, mode_payement: 'Espèce', banque: '', num_cheque: '' }] },
  },

  achat: {
    id: 'achat', label: 'Pièce d’achat (facture, BR, BC…)',
    datasets: [
      SOCIETE,
      {
        name: 'Achat', label: 'Pièce', mode: 'single',
        fields: [
          t('numero', 'Numéro'), t('type_doc', 'Type'), t('titre', 'Titre du document'), d('date', 'Date'), t('code_four', 'Code fournisseur'),
          t('raison', 'Fournisseur'), n('total_ht', 'Total HT'), n('total_ttc', 'Total TTC'), n('net_a_payer', 'Net à payer'),
          n('regler', 'Réglé'), n('reste_a_payer', 'Reste à payer'), t('mode_payement', 'Mode de paiement'), t('total_lettres', 'Montant en lettres'),
        ],
      },
      { name: 'Lignes', label: 'Lignes de la pièce', mode: 'list', fields: LIGNES_PIECE },
    ],
    sample: {
      Societe: societeExemple,
      Achat: { numero: '0007/2026', type_doc: 'BR', titre: 'Bon de réception', date: '2026-06-10', code_four: 'F005', raison: 'SARL MEDIPHARM', total_ht: 58000, total_ttc: 69025, net_a_payer: 69025, regler: 0, reste_a_payer: 69025, mode_payement: 'Virement', total_lettres: arreteLaSomme(69025) },
      Lignes: lignesExemple,
    },
  },

  articles: {
    id: 'articles', label: 'Articles (liste, étiquettes de prix)',
    datasets: [
      SOCIETE,
      {
        name: 'Articles', label: 'Articles', mode: 'list',
        fields: [
          t('code', 'Code'), t('designation', 'Désignation'), t('famille', 'Famille'), t('unite_mesure', 'Unité'), t('code_bare', 'Code-barres'),
          n('prix_vente_ht', 'Prix de vente HT'), n('prix_vente_ttc', 'Prix de vente TTC'), n('prix_achat_ht', 'Prix d’achat HT'), n('tva', 'TVA %'),
          n('qte_reale', 'Stock'), n('stock_min', 'Stock minimum'),
        ],
      },
    ],
    sample: {
      Societe: societeExemple,
      Articles: Array.from({ length: 12 }, (_, i) => ({
        code: `AR${String(i + 1).padStart(3, '0')}`, designation: ['Réactif TSH 100 tests', 'Cône jetable 200 µl', 'Gants nitrile M', 'Pipette 10-100 µl', 'Tubes EDTA 4 ml', 'Alcool 70° 1 L'][i % 6],
        famille: 'Consommables', unite_mesure: 'BTE', code_bare: `600${String(100000000 + i * 137).padStart(9, '0')}`, prix_vente_ht: 1000 + i * 150, prix_vente_ttc: (1000 + i * 150) * 1.19,
        prix_achat_ht: 700 + i * 100, tva: 19, qte_reale: 20 - i, stock_min: 5,
      })),
    },
  },

  etatClient: {
    id: 'etatClient', label: 'Relevé client',
    datasets: [
      SOCIETE,
      { name: 'Client', label: 'Client', mode: 'single', fields: [t('code', 'Code'), t('raison', 'Raison'), t('telephone', 'Téléphone'), t('adresse', 'Adresse'), n('solde', 'Solde'), d('date_debut', 'Début'), d('date_fin', 'Fin')] },
      { name: 'Lignes', label: 'Mouvements', mode: 'list', fields: [d('date', 'Date'), t('piece', 'Pièce'), t('libelle', 'Libellé'), n('debit', 'Débit'), n('credit', 'Crédit'), n('solde', 'Solde cumulé')] },
    ],
    sample: {
      Societe: societeExemple,
      Client: { code: 'C0042', raison: 'LABORATOIRE EL AMEL', telephone: '0550 12 34 56', adresse: 'Blida', solde: 49025, date_debut: '2026-01-01', date_fin: '2026-06-30' },
      Lignes: [
        { date: '2026-01-12', piece: 'FA 0003/2026', libelle: 'Facture', debit: 80000, credit: 0, solde: 80000 },
        { date: '2026-02-03', piece: 'RG 0007', libelle: 'Règlement espèces', debit: 0, credit: 50000, solde: 30000 },
        { date: '2026-06-15', piece: 'FA 0012/2026', libelle: 'Facture', debit: 69025, credit: 20000, solde: 79025 },
      ],
    },
  },
};

/** Déclare les types métier auprès du moteur d'états (ordre = ordre d'affichage). */
export function declarerTypesMetier(): void {
  for (const k of Object.values(KINDS)) declarerType(k);
}

// ─── Adaptateurs : pièces réelles → données d'état ──────────────────────────

const TITRES_VENTE: Record<string, string> = {
  FA: 'Facture', BL: 'Bon de livraison', BC: 'Bon de commande', BCT: 'Bon de comptoir', FP: 'Facture proforma', FAV: 'Facture d’avoir', BRT: 'Bon de retour',
};
const TITRES_ACHAT: Record<string, string> = {
  FA: 'Facture d’achat', BR: 'Bon de réception', BC: 'Bon de commande', DO: 'Demande d’offre', FAV: 'Avoir fournisseur', BRT: 'Bon de retour',
};

function societeDonnees(s: Societe | null | undefined) {
  return { ...societeExemple, ...Object.fromEntries(Object.keys(societeExemple).map((k) => [k, (s as Record<string, unknown> | null | undefined)?.[k] ?? ''])) };
}

export function donneesVente(vente: Vente, societe?: Societe | null): ReportData {
  const v = vente as Vente & Record<string, unknown>;
  return {
    Societe: societeDonnees(societe),
    Vente: { ...v, titre: TITRES_VENTE[vente.type_doc] ?? vente.type_doc, total_lettres: arreteLaSomme(Number(vente.net_a_payer) || 0) },
    Lignes: (vente.lignes ?? []) as LigneVente[],
    Reglements: vente.reglements ?? [],
  };
}

export function donneesAchat(achat: Achat, societe?: Societe | null): ReportData {
  const a = achat as Achat & Record<string, unknown>;
  return {
    Societe: societeDonnees(societe),
    Achat: { ...a, raison: achat.raison ?? achat.fournisseur ?? '', code_four: achat.code_four ?? achat.code_cli ?? '', titre: TITRES_ACHAT[achat.type_doc] ?? achat.type_doc, total_lettres: arreteLaSomme(Number(achat.net_a_payer) || 0) },
    Lignes: ((a.lignes as unknown[]) ?? []),
  };
}

export function donneesArticles(articles: Article[], societe?: Societe | null): ReportData {
  return { Societe: societeDonnees(societe), Articles: articles };
}
