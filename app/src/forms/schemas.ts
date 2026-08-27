import { Section } from '../components/ui/FormModal';

/** Schémas de formulaire — alignés sur les inputs GraphQL de l'agent
 *  (sos-agent/src/modules/<module>/<module>.schema.gql). */

export const CLIENT_SECTIONS: Section[] = [
  {
    title: 'Identité',
    fields: [
      { name: 'code', label: 'Code', span: 3, required: true, lockedOnEdit: true },
      { name: 'nom', label: 'Nom / Raison sociale', span: 6, required: true },
      { name: 'prenom', label: 'Prénom', span: 3 },
      { name: 'telephone', label: 'Téléphone', span: 4 },
      { name: 'telephone2', label: 'Téléphone 2', span: 4 },
      { name: 'email', label: 'Email', span: 4 },
      { name: 'adresse', label: 'Adresse', span: 8 },
      { name: 'ville', label: 'Ville', span: 4 },
    ],
  },
  {
    title: 'Conditions commerciales',
    fields: [
      { name: 'mode_payement', label: 'Mode de paiement', span: 4 },
      { name: 'delai_paiement', label: 'Délai (jours)', type: 'number', span: 4 },
      { name: 'remise', label: 'Remise %', type: 'number', step: '0.5', span: 4 },
      { name: 'plafond_credit', label: 'Plafond de crédit', type: 'number', step: '0.01', span: 6 },
      { name: 'credit_initial', label: 'Crédit initial', type: 'number', step: '0.01', span: 6 },
    ],
  },
  {
    title: 'Banque & divers',
    fields: [
      { name: 'banque', label: 'Banque', span: 6 },
      { name: 'rib', label: 'RIB', span: 6 },
      { name: 'note', label: 'Note', type: 'textarea', span: 12 },
    ],
  },
];

export const FOURNISSEUR_SECTIONS: Section[] = [
  {
    title: 'Identité',
    fields: [
      { name: 'code', label: 'Code', span: 3, required: true, lockedOnEdit: true },
      { name: 'nom', label: 'Nom / Raison sociale', span: 6, required: true },
      { name: 'contact', label: 'Contact', span: 3 },
      { name: 'telephone', label: 'Téléphone', span: 4 },
      { name: 'telephone2', label: 'Téléphone 2', span: 4 },
      { name: 'email', label: 'Email', span: 4 },
      { name: 'adresse', label: 'Adresse', span: 8 },
      { name: 'ville', label: 'Ville', span: 4 },
    ],
  },
  {
    title: 'Conditions & identifiants',
    fields: [
      { name: 'mode_payement', label: 'Mode de paiement', span: 4 },
      { name: 'delai_paiement', label: 'Délai (jours)', type: 'number', span: 4 },
      { name: 'remise', label: 'Remise %', type: 'number', step: '0.5', span: 4 },
      { name: 'rc', label: 'RC', span: 6 },
      { name: 'tva_num', label: 'N° TVA / NIF', span: 6 },
    ],
  },
  {
    title: 'Banque & divers',
    fields: [
      { name: 'banque', label: 'Banque', span: 6 },
      { name: 'rib', label: 'RIB', span: 6 },
      { name: 'note', label: 'Note', type: 'textarea', span: 12 },
    ],
  },
];

/** Les listes déroulantes (familles, dépôts, unités, TVA) sont injectées à
 *  l'ouverture du formulaire via `withArticleOptions`. */
export function buildArticleSections(opts: {
  familles?: string[]; depots?: string[]; unites?: string[]; tva?: string[];
}): Section[] {
  const toOpts = (list?: string[]) => (list ?? []).map((v) => ({ value: v, label: v }));
  return [
    {
      title: 'Identification',
      fields: [
        { name: 'code', label: 'Code', span: 3, required: true, lockedOnEdit: true },
        { name: 'designation', label: 'Désignation', span: 9, required: true },
        { name: 'reference', label: 'Référence', span: 4 },
        { name: 'code_bare', label: 'Code-barres', span: 4 },
        { name: 'unite_mesure', label: 'Unité', type: 'select', span: 4, options: toOpts(opts.unites) },
        { name: 'famille', label: 'Famille', type: 'select', span: 4, options: toOpts(opts.familles) },
        { name: 'sfamille', label: 'Sous-famille', span: 4 },
        { name: 'depot', label: 'Dépôt', type: 'select', span: 4, options: toOpts(opts.depots) },
      ],
    },
    {
      title: 'Prix & marges',
      fields: [
        { name: 'prix_achat_ht', label: "Prix d'achat HT", type: 'number', step: '0.01', span: 4 },
        { name: 'prix_vente_ht', label: 'Prix de vente HT', type: 'number', step: '0.01', span: 4 },
        { name: 'tva', label: 'TVA %', type: 'select', span: 4, options: toOpts(opts.tva) },
        { name: 'prix_vente_ht1', label: 'Prix vente 2 (HT)', type: 'number', step: '0.01', span: 4 },
        { name: 'prix_vente_ht2', label: 'Prix vente 3 (HT)', type: 'number', step: '0.01', span: 4 },
        { name: 'prix_vente_ht3', label: 'Prix vente 4 (HT)', type: 'number', step: '0.01', span: 4 },
      ],
    },
    {
      title: 'Stock',
      fields: [
        { name: 'qte_initial', label: 'Quantité initiale', type: 'number', step: '0.001', span: 4 },
        { name: 'stock_min', label: 'Stock minimum', type: 'number', step: '0.001', span: 4 },
        { name: 'stock_max', label: 'Stock maximum', type: 'number', step: '0.001', span: 4 },
        { name: 'colis', label: 'Colisage', type: 'number', step: '1', span: 4 },
        { name: 'points', label: 'Points fidélité', type: 'number', step: '1', span: 4 },
        { name: 'note', label: 'Note', type: 'textarea', span: 12 },
      ],
    },
  ];
}
