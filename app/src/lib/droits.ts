import { useSession } from '../store/session';

/**
 * Droits d'accès des utilisateurs dossier — même modèle que le desktop Delphi
 * (commercecommun.users, colonnes Previlege*) : par module, `'*'` = tout, sinon
 * la liste exacte des libellés accordés. `admin` = tous les droits.
 *
 * ⚠ Les libellés sont ceux écrits par le desktop, fautes comprises (« Accés »,
 * « Bénifice », « Trésorie »…) : ils doivent rester identiques pour que les deux
 * applications partagent les mêmes droits.
 */
export type ModuleDroit = 'vente' | 'achat' | 'stock' | 'tiers' | 'bank' | 'autre' | 'dossier';
export type Droits = { admin: boolean } & Record<ModuleDroit, '*' | string[]>;

export const TOUS_DROITS: Droits = {
  admin: true, vente: '*', achat: '*', stock: '*', tiers: '*', bank: '*', autre: '*', dossier: '*',
};

export const MODULES_DROITS: { module: ModuleDroit; label: string }[] = [
  { module: 'vente', label: 'Ventes' },
  { module: 'achat', label: 'Achats' },
  { module: 'stock', label: 'Stock' },
  { module: 'tiers', label: 'Tiers & référentiels' },
  { module: 'bank', label: 'Comptes de trésorerie' },
  { module: 'autre', label: 'Trésorerie, statistiques & paramètres' },
  { module: 'dossier', label: 'Dossiers' },
];

// ─── Documents : libellés par type et par action ────────────────────────────

type ActionDoc = 'voir' | 'creer' | 'modifier' | 'supprimer' | 'parUtilisateur';
type LibellesDoc = Record<ActionDoc, string>;

function doc(nom: string, nouveau: string): LibellesDoc {
  return {
    voir: nom,
    creer: `${nouveau} ${nom}`,
    modifier: `Modification ${nom}`,
    supprimer: `Suppression ${nom}`,
    parUtilisateur: `${nom} par utilisateur`,
  };
}

export const DROITS_DOC_VENTE: Record<string, LibellesDoc> = {
  FP: doc('Facture Proforma', 'Nouvelle'),
  BC: doc('Bon de Commande', 'Nouveau'),
  FA: doc('Facture de Vente', 'Nouvelle'),
  BL: doc('Bon de Livraison', 'Nouveau'),
  BCT: doc('Bon de Comptoir', 'Nouveau'),
  BRT: doc('Bon de Retour', 'Nouveau'),
  FAV: {
    voir: 'Avoir client', creer: 'Nouvel avoir client', modifier: 'Modification avoir client',
    supprimer: 'Suppression avoir client', parUtilisateur: 'Avoir client par utilisateur',
  },
};

export const DROITS_DOC_ACHAT: Record<string, LibellesDoc> = {
  DO: doc("Demande d'offre", 'Nouvelle'),
  BC: doc('Bon de Commande', 'Nouveau'),
  FA: doc("Facture d'achat", 'Nouvelle'),
  BR: doc('Bon de Réception', 'Nouveau'),
  BRT: doc('Bon de Retour', 'Nouveau'),
  FAV: {
    voir: 'Avoir Fournisseur', creer: 'Nouvel avoir Fournisseur', modifier: 'Modification avoir Fournisseur',
    // Faute d'origine du desktop conservée (« Founisseur »)
    supprimer: 'Suppression avoir Fournisseur', parUtilisateur: 'Avoir Founisseur par utilisateur',
  },
};

/** Libellés isolés utilisés par l'app. */
export const D = {
  vente: {
    journal: 'Journal des ventes',
    benefice: 'Affichier le Bénifice dans les bons et les Factures',
    blLivresFiges: 'Les bons de livraison livrés ne doivent pas être modifiés',
    changerProprietaire: 'Changer le proprietaire (utilisateur) de Bon',
    impression: 'Impression des Document',
  },
  achat: { journal: "Journal d'achat" },
  stock: {
    article: 'Accés Article',
    inventaire: 'Accés Inventaire',
    bonEntree: "Accés Bon d'entrer",
    bonSortie: 'Accés Bon de sortie',
    cacherTarifs: "Cacher l'onglet Tarifs",
    creerArticle: 'Création un Article',
    modifierArticle: 'Modifier un Article',
    supprimerArticle: 'Supprimer un Article',
    alerte: 'Alert Stock',
    lots: 'accés Lot',
  },
  tiers: {
    clients: 'Clients', fournisseurs: 'Fournisseurs', banques: 'Banques', tva: 'Tva',
    modes: 'Modes De Payement', unites: 'Unite de mesure', familles: 'Famille', sousFamilles: 'Sous Famille',
    depots: 'Depot', rayons: 'Rayon', commerciaux: 'Commerciaux', centresCout: 'centre du cout',
  },
  autre: {
    statistiques: 'Statistiques',
    beneficeStat: 'Bénéfice Statistique',
    parametres: 'Paramètres',
    tresorerie: 'Trésorie',
    nouveauTresorerie: 'Nouveau Trésorie',
    suppressionTresorerie: 'Suppression Trésorie',
    arreterCaisse: 'Arréter la Caisse',
    arreterCaisseAlt: 'Arrete la caisse',
    alimenterCaisse: 'Alimenter la caisse',
    transfertComptes: 'Transfer entre Comptes',
    coordonnees: 'Coordonnées',
    formatNumerotation: 'Format des numérotations',
    numerotation: 'Numérotation',
    droitsAcces: "Droits d'accés",
  },
} as const;

/** Catalogue affiché dans l'éditeur de droits (groupé), par module. */
export const CATALOGUE_DROITS: Record<Exclude<ModuleDroit, 'bank'>, { groupe: string; libelles: string[] }[]> = {
  vente: [
    ...Object.entries(DROITS_DOC_VENTE).map(([code, l]) => ({
      groupe: { FP: 'Proforma', BC: 'Bons de commande', FA: 'Factures', BL: 'Bons de livraison', BCT: 'Bons de comptoir', BRT: 'Bons de retour', FAV: 'Avoirs' }[code] ?? code,
      libelles: [l.voir, l.creer, l.modifier, l.supprimer, l.parUtilisateur],
    })),
    { groupe: 'Divers', libelles: Object.values(D.vente) },
  ],
  achat: [
    ...Object.entries(DROITS_DOC_ACHAT).map(([code, l]) => ({
      groupe: { DO: "Demandes d'offre", BC: 'Bons de commande', FA: "Factures d'achat", BR: 'Bons de réception', BRT: 'Bons de retour', FAV: 'Avoirs' }[code] ?? code,
      libelles: [l.voir, l.creer, l.modifier, l.supprimer, l.parUtilisateur],
    })),
    { groupe: "Bons d'achat", libelles: ["Bon d'achat", "Nouveau Bon d'achat", "Modification Bon d'achat", "Suppression Bon d'achat", "Bon d'achat par utilisateur"] },
    { groupe: 'Divers', libelles: [D.achat.journal] },
  ],
  stock: [
    { groupe: 'Articles', libelles: [D.stock.article, D.stock.creerArticle, D.stock.modifierArticle, D.stock.supprimerArticle, D.stock.cacherTarifs, D.stock.alerte] },
    { groupe: 'Lots', libelles: [D.stock.lots, 'accés prix par lot et fournisseur', "afficher les prix d'achat et fournisseur par lot "] },
    { groupe: 'Mouvements', libelles: [D.stock.inventaire, D.stock.bonEntree, D.stock.bonSortie] },
  ],
  tiers: [
    { groupe: 'Tiers', libelles: [D.tiers.clients, D.tiers.fournisseurs] },
    { groupe: 'Référentiels', libelles: [D.tiers.banques, D.tiers.tva, D.tiers.modes, D.tiers.unites, D.tiers.familles, D.tiers.sousFamilles, D.tiers.depots, D.tiers.rayons, D.tiers.commerciaux, D.tiers.centresCout] },
  ],
  autre: [
    { groupe: 'Trésorerie', libelles: [D.autre.tresorerie, D.autre.nouveauTresorerie, D.autre.suppressionTresorerie, D.autre.arreterCaisse, D.autre.alimenterCaisse, D.autre.transfertComptes] },
    { groupe: 'Statistiques', libelles: [D.autre.statistiques, D.autre.beneficeStat, 'Statistique par utilisateur', 'liste des vente par utilisateur'] },
    { groupe: 'Paramètres', libelles: [D.autre.parametres, D.autre.coordonnees, D.autre.formatNumerotation, D.autre.numerotation, D.autre.droitsAcces, 'Configuration BD'] },
    { groupe: 'Production', libelles: ['Bon de Production', 'Journal de Production', 'Journal de Consommation', 'Rendez-vous'] },
  ],
  dossier: [
    { groupe: 'Dossiers', libelles: ['Ouvrir de Dossier', 'Fermeture de Dossier', 'Nouveau Dossier', 'Synchronisation entre Dossier', 'Suppression de Dossier', "Fermeture d'exercice", 'Changement de Dossier par defaut', 'Sauvegarde et Réstauration'] },
  ],
};

// ─── Évaluation ─────────────────────────────────────────────────────────────

export function aDroit(droits: Droits | null | undefined, module: ModuleDroit, libelle: string): boolean {
  if (!droits) return true; // droits non encore chargés / agent ancien : pas de blocage
  if (droits.admin) return true;
  const m = droits[module];
  if (m === '*') return true;
  return Array.isArray(m) && m.includes(libelle);
}

export function aUnDroit(droits: Droits | null | undefined, module: ModuleDroit, libelles: string[]): boolean {
  return libelles.some((l) => aDroit(droits, module, l));
}

/** Au moins un droit dans le module (pour afficher une entrée de menu). */
export function aModule(droits: Droits | null | undefined, module: ModuleDroit): boolean {
  if (!droits || droits.admin) return true;
  const m = droits[module];
  return m === '*' || (Array.isArray(m) && m.length > 0);
}

/**
 * Droit restrictif « <type> par utilisateur » : l'utilisateur ne voit que ses
 * propres pièces de ce type. Ne s'applique que s'il est explicitement coché
 * (ni administrateur ni module « tout »).
 */
export function restreintAuxSiennes(droits: Droits | null | undefined, sens: 'vente' | 'achat', code: string): boolean {
  if (!droits || droits.admin) return false;
  const m = droits[sens];
  const l = (sens === 'vente' ? DROITS_DOC_VENTE : DROITS_DOC_ACHAT)[code];
  return Array.isArray(m) && !!l && m.includes(l.parUtilisateur);
}

/**
 * Comptes de trésorerie accessibles (colonne Delphi PrevilegeBank = noms de
 * comptes). Liste vide ou « tout » → aucun filtrage.
 */
export function comptesAutorises<T>(droits: Droits | null | undefined, comptes: T[], nom: (c: T) => string | null | undefined): T[] {
  if (!droits || droits.admin || droits.bank === '*' || droits.bank.length === 0) return comptes;
  const ok = new Set(droits.bank.map((n) => n.trim().toLowerCase()));
  return comptes.filter((c) => ok.has(String(nom(c) ?? '').trim().toLowerCase()));
}

/**
 * Hook d'accès aux droits de l'utilisateur dossier connecté.
 *   const { peut, peutDoc } = useDroits();
 *   peut('stock', D.stock.creerArticle)
 *   peutDoc('vente', 'FA', 'modifier')
 */
export function useDroits() {
  const droits = useSession((s) => s.dossierUser?.droits as Droits | undefined);
  return {
    droits,
    admin: !droits || droits.admin,
    peut: (module: ModuleDroit, libelle: string) => aDroit(droits, module, libelle),
    peutUn: (module: ModuleDroit, libelles: string[]) => aUnDroit(droits, module, libelles),
    aModule: (module: ModuleDroit) => aModule(droits, module),
    restreintAuxSiennes: (sens: 'vente' | 'achat', code: string) => restreintAuxSiennes(droits, sens, code),
    comptesAutorises: <T,>(comptes: T[], nom: (c: T) => string | null | undefined) => comptesAutorises(droits, comptes, nom),
    /** Droit sur un type de pièce (code FA/BL/… de l'app). Type inconnu → autorisé. */
    peutDoc: (sens: 'vente' | 'achat', code: string, action: ActionDoc) => {
      const l = (sens === 'vente' ? DROITS_DOC_VENTE : DROITS_DOC_ACHAT)[code];
      return l ? aDroit(droits, sens, l[action]) : true;
    },
  };
}
