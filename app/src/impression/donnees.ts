/**
 * Formes des données métier transmises aux états (arrêté de caisse, bons de stock, journaux, recouvrement…), telles
 * que renvoyées par l'agent ou assemblées par les écrans. Elles vivaient dans les anciens gabarits HTML de
 * `print/templates`, remplacés par le moteur `@softly/report` (voir `docs/05-IMPRESSION.md`).
 */

export type ArreteCaisseMouvement = {
  cle: string; date?: string | null; mode_payement?: string | null; montant: number;
  raison?: string | null; objet?: string | null; categorie?: string | null;
};

export type ArreteCaisseData = {
  date: string; compte_id?: number | null; compte?: string | null;
  solde_ouverture: number; total_entrees: number; total_sorties: number; solde_theorique: number;
  par_mode: { mode: string | null; entrees: number; sorties: number }[];
  mouvements: ArreteCaisseMouvement[];
  // Présents après clôture (cloturerCaisse)
  montant_compte?: number | null; ecart?: number | null; mouvement_ecart?: unknown;
};

export type BonStockLigne = {
  id?: number; id_article?: number; code_article?: string | null; designation?: string | null;
  qte: number; unite?: string | null; prix_unitaire?: number | null; total?: number | null;
};

export type BonStock = {
  id: number; numero?: string | null; date?: string | null; motif?: string | null;
  observation?: string | null; depot?: string | null; total_ht?: number | null;
  valeur_total?: number | null; agent?: string | null; lignes?: BonStockLigne[];
};

export type BordereauLigne = {
  numero?: string | null;
  date?: string | null;
  tiers?: string | null;
  mode_payement?: string | null;
  net?: number | null;
  regler?: number | null;
  reste?: number | null;
};

export type Etat104Ligne = {
  code_cli: string; raison: string; adresse?: string | null;
  rc?: string | null; nif?: string | null; nis?: string | null; art?: string | null;
  nb_pieces: number; montant_ht: number; tva: number; montant_ttc: number; incomplet: boolean;
};

export type Etat104Totaux = { nb_clients: number; montant_ht: number; tva: number; montant_ttc: number; incomplets: number };

export type EtatFournisseurSolde = {
  code_four: string; nom?: string | null; credit_initial?: number | null;
  total_achats?: number | null; total_retours?: number | null; solde_depart?: number | null;
  regler?: number | null; remboursements?: number | null; credit?: number | null;
};

export type EtatFournisseurLigne = {
  type_doc: string; numero?: string | null; date: string; montant: number;
  total_cumul: number; mode_payement?: string | null;
};

export type InventaireLigne = {
  code_article: string; designation: string; depot?: string | null;
  qte_theorique: number; qte_reale: number; ecart: number;
  prix_pmp?: number; valeur_theorique?: number; valeur_reale?: number;
};

export type InventaireEntete = {
  designation?: string | null; date?: string | null;
  valeur_theorique?: number; valeur_reale?: number; ecart_valeur?: number;
};

export type JournalLigne = Record<string, unknown> & {
  date?: string | null; numero?: string | null;
  code_article?: string | null; designation?: string | null; n_lot?: string | null;
  qte?: number | null; prix_ht?: number | null; total_ttc?: number | null; total_marge?: number | null;
  raison?: string | null; fournisseur?: string | null; code_cli?: string | null; code_four?: string | null;
};

export type RecouvrementLigne = {
  code_cli: string; raison: string; tel?: string | null; nb_pieces: number;
  total_du: number; du_en_retard: number; echu: number; b_0_30: number; b_31_60: number; b_61_90: number; b_90_plus: number;
  plus_ancienne?: string | null; derniere?: string | null; jours_max: number;
};

export type RecouvrementTotaux = {
  total_du: number; du_en_retard: number; echu: number; b_0_30: number; b_31_60: number; b_61_90: number; b_90_plus: number;
};

/** Informations d'encaissement connues au comptoir (non stockées sur la pièce). */
export type TicketExtras = { caissier?: string | null; recu?: number; rendu?: number };

export type TicketVentesLigne = { libelle: string; qte: number; total_ttc: number };
