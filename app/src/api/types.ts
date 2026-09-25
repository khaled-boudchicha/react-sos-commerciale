// Types dérivés des schémas typés de l'agent (sos-agent/src/modules/<module>/<module>.schema.gql).
// Le cloud renvoie ces formes en JSON opaque — on les type ici côté client.

export type Vente = {
  /** Échéance de paiement (date_reglement) et délai en jours (nbr_jour_reglement) */
  date_echeance?: string | null; delai_reglement?: number | null;
  id: number; numero: string; type_doc: string; type: number; date: string;
  code_cli?: string | null; raison?: string | null; tel?: string | null;
  total_ht: number; total_ttc: number; net_a_payer: number;
  regler: number; reste_a_payer: number; remise?: number | null;
  tva?: number | null; total_taxe?: number | null;
  mode_payement?: string | null; grouped?: number | null; observation?: string | null;
  lignes?: LigneVente[];
  // ── Détail enrichi (vente(id)) : cycle de vie de la pièce ──
  /** Remise globale en % (`remise` = son montant HT). */
  remise_p?: number | null;
  user_name?: string | null;
  reglements?: ReglementPiece[];
  bls_groupes?: { id: number; numero: string; date: string; net_a_payer: number }[];
  facture_groupee?: { id: number; numero: string } | null;
  retours?: { id: number; type: number; numero: string; date: string; net_a_payer: number }[];
  piece_origine?: { id: number; type: number; type_doc: string; numero: string } | null;
  /** Codes cibles encore possibles (ex. ['BL','FA']). */
  transformations_possibles?: string[];
  /** false si BL groupé ou facture issue d'un regroupement. */
  modifiable?: boolean;
};

/** Règlement rattaché à une pièce (vente ou achat). */
export type ReglementPiece = {
  id: number; montant: number; date: string; mode_payement?: string | null;
  banque?: string | null; num_cheque?: string | null; compte?: string | null;
  observation?: string | null; depuis_avance?: number | boolean | null; type_reglement?: string | number | null;
};

export type LigneVente = {
  id: number; code_article: string; designation: string; qte: number;
  prix_ht: number; prix_ttc: number; total_ht: number; total_ttc: number;
  tva: number; remise?: number | null; n_lot?: string | null;
  id_article?: number | null; unite?: string | null; remise_montant?: number | null;
  total_marge?: number | null; date_peremption?: string | null; colis?: number | null;
  invoice_retour_id?: number | null; invoice_retour_line_id?: number | null;
  /** Quantité déjà retournée (avoirs / bons de retour). */
  qte_retournee?: number | null;
};

export type VentesResult = {
  data: Vente[]; total: number; total_ht: number; total_ttc: number; total_reste: number;
};

export type Achat = {
  id: number; numero: string; type_doc: string; date: string;
  code_four?: string | null; code_cli?: string | null; raison?: string | null;
  total_ht: number; total_ttc: number; net_a_payer: number;
  regler: number; reste_a_payer: number; mode_payement?: string | null;
  // ── Détail enrichi (achat(id)) ──
  type?: number; fournisseur?: string | null;
  /** Remise globale en % (`remise_montant` = son montant). */
  remise?: number | null; remise_montant?: number | null;
  observation?: string | null; user_name?: string | null;
  code_type?: string;
  lignes?: LigneAchat[];
  reglements?: ReglementPiece[];
  transformations_possibles?: string[];
  modifiable?: boolean;
};

export type LigneAchat = {
  id: number; id_article?: number | null; code_article: string; designation: string;
  qte: number; unite?: string | null; prix_ht: number; prix_ttc?: number | null;
  total_ht?: number | null; total_ttc: number; tva: number;
  remise?: number | null; remise_montant?: number | null;
  n_lot?: string | null; date_peremption?: string | null; colis?: number | null;
  /** Quantité déjà retournée au fournisseur (retours liés à cette ligne) */
  qte_retournee?: number | null;
};

export type AchatsResult = {
  data: Achat[]; total: number; total_ht: number; total_ttc: number; total_reste: number;
};

export type Article = {
  id: number; code: string; designation: string; famille?: string | null;
  type?: string | null; unite_mesure?: string | null; depot?: string | null;
  pmp?: number | null; prix_achat_ht?: number | null;
  prix_vente_ht?: number | null; prix_vente_ttc?: number | null;
  // Tiers de prix 2 à 4 (le tier 1 = prix_vente_ht). Renvoyés par l'agent.
  prix_vente_ht1?: number | null; prix_vente_ht2?: number | null; prix_vente_ht3?: number | null;
  prix_vente_ttc1?: number | null; prix_vente_ttc2?: number | null; prix_vente_ttc3?: number | null;
  marge?: number | null; margep?: number | null; tva?: number | null;
  marge1?: number | null; marge2?: number | null; marge3?: number | null;
  margep1?: number | null; margep2?: number | null; margep3?: number | null;
  qte_reale?: number | null; qte_theorique?: number | null;
  stock_min?: number | null; code_bare?: string | null; actif?: boolean | null;
};

export type ArticlesResult = { data: Article[]; total: number };

export type Client = {
  id: number; code: string; nom: string; prenom?: string | null;
  telephone?: string | null; ville?: string | null; email?: string | null;
  ancien_credit?: number | null; plafond_credit?: number | null;
  remise?: number | null; actif?: boolean | null;
};

export type ClientsResult = { data: Client[]; total: number };

export type Fournisseur = {
  id: number; code: string; nom: string; telephone?: string | null;
  ville?: string | null; ancien_credit?: number | null;
};

export type FournisseursResult = { data: Fournisseur[]; total: number };

export type MouvementTresorie = {
  cle: string; id: number; date: string; montant: number; debit: number; credit: number;
  solde_cumul: number; compte?: string | null; compte_id?: number | null;
  mode_payement?: string | null; banque?: string | null; code_tier?: string | null;
  tier?: string | null; categorie?: string | null; user?: string | null;
  objet?: string | null; observation?: string | null;
};

export type TresorieCompleteResult = {
  data: MouvementTresorie[]; total: number;
  total_debit: number; total_credit: number; solde_final: number; solde_initial: number;
};

export type SoldeCompte = {
  compte_id?: number | null; compte: string; solde: number;
  total_entrees: number; total_sorties: number;
};

export type StatVenteLigne = {
  periode: string; total_ht: number; total_ttc: number; total_marge: number;
  total_taxe: number; remise: number;
};

export type StatVentesResult = {
  lignes: StatVenteLigne[]; total_ht: number; total_ttc: number; total_marge: number;
  total_charges: number; marge_nette_total: number; pct_marge_global: number;
};

export type StatParFamille = {
  famille: string;
  total_ht: number; total_ttc: number; total_marge: number; qte: number;
  /** Retours (avoirs / bons de retour) déjà isolés par l'agent. */
  r_total_ht: number; r_total_ttc: number; r_qte: number;
  remise: number; nb_lignes: number;
};

export type Debiteur = Record<string, unknown> & {
  code_cli?: string; raison?: string; total_reste?: number; nb_factures?: number;
};

export type DebiteursResult = {
  data: Debiteur[]; total_clients: number; total_factures: number; total_creances: number;
  bucket_0_30: number; bucket_30_60: number; bucket_60_plus: number;
};

/** Codes de types de documents (constantes Delphi, cf. ventes/achats.service.ts agent) */
export const TYPES_VENTE = [
  { code: 'FA', label: 'Factures' },
  { code: 'BL', label: 'Bons de livraison' },
  { code: 'BCT', label: 'Bons de comptoir' },
  { code: 'BC', label: 'Commandes' },
  { code: 'FP', label: 'Proforma' },
  { code: 'BRT', label: 'Retours' },
  { code: 'FAV', label: 'Avoirs' },
] as const;

/** Type numérique (colonne `Type`) → code d'onglet, pour dupliquer une pièce. */
export const VENTE_TYPE_CODE: Record<number, string> = { 1: 'FA', 2: 'BL', 4: 'BCT', 0: 'BC', 3: 'FP', 6: 'BRT', 7: 'FAV' };
export const ACHAT_TYPE_CODE: Record<number, string> = { 1: 'FA', 2: 'BR', 0: 'BC', 3: 'DO', 4: 'BRT', 5: 'FAV' };

export const TYPES_ACHAT = [
  { code: 'FA', label: "Factures d'achat" },
  { code: 'BR', label: 'Bons de réception' },
  { code: 'BC', label: 'Commandes' },
  { code: 'DO', label: "Demandes d'offre" },
  { code: 'BRT', label: 'Retours' },
  { code: 'FAV', label: 'Avoirs' },
] as const;

// ── Statistiques étendues ────────────────────────────────────────────────────
export type StatArticleVente = {
  code_article: string; designation: string; famille: string | null;
  total_ht: number; total_ttc: number; total_marge: number; qte: number; pct_marge: number;
};
export type StatClient = {
  code_cli: string; raison: string;
  total_ht: number; total_ttc: number; total_marge: number; nb_factures: number; pct_marge: number;
};
export type BeneficeLigne = {
  periode: string; total_ht: number; total_revien: number;
  benefice_brut: number; benefice_avec_remise: number; remise: number;
};
export type BeneficesResult = {
  lignes: BeneficeLigne[]; total_ht: number; total_revien: number; total_benefice: number;
};
export type StatAchatLigne = {
  periode: string; total_ht: number; total_ttc: number; qte: number;
  nb_factures: number; remise: number; r_total_ht: number; r_qte: number;
};
export type StatAchatsResult = {
  lignes: StatAchatLigne[]; total_ht: number; total_ttc: number; nb_factures: number;
};
export type StatFournisseur = {
  code_four: string; fournisseur: string;
  total_ht: number; total_ttc: number; nb_factures: number; reste_a_payer: number;
};
export type StatArticleAchat = {
  code_article: string; designation: string; famille: string | null;
  total_ht: number; total_ttc: number; qte: number; pmp_moyen: number;
};
export type StatStockLigne = {
  id: number; code_article: string; designation: string; famille: string | null;
  pmp: number; prix_vente_ttc: number; qte_reale: number; qte_initial: number;
  stock_value: number; sales_value: number; initial_value: number; marge_potentielle: number;
};
export type StatStockResult = {
  articles: StatStockLigne[]; nb_articles: number;
  total_stock_value: number; total_sales_value: number;
  total_initial_value: number; marge_potentielle_totale: number;
};
