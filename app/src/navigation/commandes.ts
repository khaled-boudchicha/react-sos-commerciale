import { D, useDroits } from '../lib/droits';
import type { NomIcone } from './icones';

/**
 * Registre unique des commandes de navigation : le ruban, la barre latérale et le menu Fichier y puisent.
 * Chaque commande porte son droit d'accès (`si`) : une commande non autorisée n'apparaît nulle part.
 */

export type Droits = ReturnType<typeof useDroits>;

/** Famille de couleur de l'icône (lecture rapide du ruban, comme les couleurs d'Office). */
export type Ton = 'ventes' | 'achats' | 'stock' | 'tiers' | 'finances' | 'analyse' | 'config';

export const COULEUR_TON: Record<Ton, string> = {
  ventes: 'var(--ruban-accent)',
  achats: 'var(--orange)',
  stock: 'var(--teal)',
  tiers: 'var(--violet)',
  finances: 'var(--success)',
  analyse: 'var(--info)',
  config: 'var(--text-label)',
};

/** Actions qui ne sont pas des routes (ouvertes par la coquille de l'application). */
export type Action = 'palette' | 'dossier' | 'agent' | 'deconnexion' | 'disposition' | 'replier';

export type Commande = {
  id: string;
  libelle: string;
  /** Libellé du ruban (deux lignes au plus) quand le libellé complet est trop long. */
  court?: string;
  icone: NomIcone;
  ton: Ton;
  to?: string;
  action?: Action;
  si?: (d: Droits) => boolean;
  /** Info-bulle détaillée (« ScreenTip » d'Office). */
  aide?: string;
  raccourci?: string;
  /** Activité : `true` = chemin identique et sans filtre ; `'chemin'` = chemin identique, filtres libres ; absent = préfixe. */
  exact?: boolean | 'chemin';
};

const doc = (sens: 'vente' | 'achat', code: string, action: 'voir' | 'creer') => (d: Droits) => d.aModule(sens) && d.peutDoc(sens, code, action);
const comptoir = (d: Droits) => d.peutDoc('vente', 'BCT', 'creer') || d.peutDoc('vente', 'BRT', 'creer');
const parametres = (d: Droits) => d.peut('autre', D.autre.parametres);

export const C = {
  // Général
  tableau: { id: 'tableau', libelle: 'Tableau de bord', court: 'Tableau de bord', icone: 'tableau', ton: 'analyse', to: '/', exact: true, aide: 'Indicateurs du jour : chiffre d’affaires, encaissements, alertes de stock.' },
  comptoir: { id: 'comptoir', libelle: 'Vente au comptoir', court: 'Comptoir', icone: 'comptoir', ton: 'ventes', to: '/comptoir', si: comptoir, aide: 'Caisse plein écran : tickets, retours, encaissement et rendu monnaie.' },
  rechercher: { id: 'rechercher', libelle: 'Rechercher', icone: 'rechercher', ton: 'config', action: 'palette', raccourci: 'Ctrl+K', aide: 'Recherche globale : clients, fournisseurs, articles, pièces et commandes.' },

  // Ventes
  ventes: { id: 'ventes', libelle: 'Pièces de vente', court: 'Pièces de vente', icone: 'facture', ton: 'ventes', to: '/ventes', exact: true, si: (d) => d.aModule('vente'), aide: 'Liste des factures, bons de livraison, devis, avoirs et retours.' },
  ventesFA: { id: 'ventesFA', libelle: 'Factures', icone: 'facture', ton: 'ventes', to: '/ventes?type=FA', si: doc('vente', 'FA', 'voir') },
  ventesBL: { id: 'ventesBL', libelle: 'Bons de livraison', icone: 'livraison', ton: 'ventes', to: '/ventes?type=BL', si: doc('vente', 'BL', 'voir') },
  ventesBCT: { id: 'ventesBCT', libelle: 'Bons de comptoir', icone: 'ticket', ton: 'ventes', to: '/ventes?type=BCT', si: doc('vente', 'BCT', 'voir') },
  ventesBC: { id: 'ventesBC', libelle: 'Commandes', icone: 'commande', ton: 'ventes', to: '/ventes?type=BC', si: doc('vente', 'BC', 'voir') },
  ventesFP: { id: 'ventesFP', libelle: 'Proforma', icone: 'devis', ton: 'ventes', to: '/ventes?type=FP', si: doc('vente', 'FP', 'voir') },
  ventesFAV: { id: 'ventesFAV', libelle: 'Avoirs', icone: 'avoir', ton: 'ventes', to: '/ventes?type=FAV', si: doc('vente', 'FAV', 'voir') },
  ventesBRT: { id: 'ventesBRT', libelle: 'Retours', icone: 'retour', ton: 'ventes', to: '/ventes?type=BRT', si: doc('vente', 'BRT', 'voir') },
  ventesJournal: { id: 'ventesJournal', libelle: 'Journal des ventes', court: 'Journal', icone: 'journal', ton: 'ventes', to: '/ventes?vue=journal', si: (d) => d.peut('vente', D.vente.journal), aide: 'Toutes les lignes vendues sur la période, avec la marge.' },
  nouvelleFA: { id: 'nouvelleFA', libelle: 'Nouvelle facture', court: 'Nouvelle facture', icone: 'nouveau', ton: 'ventes', to: '/ventes/nouvelle?type=FA', si: doc('vente', 'FA', 'creer'), aide: 'Créer une facture de vente.' },
  nouveauBL: { id: 'nouveauBL', libelle: 'Bon de livraison', icone: 'livraison', ton: 'ventes', to: '/ventes/nouvelle?type=BL', si: doc('vente', 'BL', 'creer'), aide: 'Créer un bon de livraison.' },
  nouveauBC: { id: 'nouveauBC', libelle: 'Bon de commande', icone: 'commande', ton: 'ventes', to: '/ventes/nouvelle?type=BC', si: doc('vente', 'BC', 'creer') },
  nouveauFP: { id: 'nouveauFP', libelle: 'Devis / proforma', icone: 'devis', ton: 'ventes', to: '/ventes/nouvelle?type=FP', si: doc('vente', 'FP', 'creer') },
  echeances: { id: 'echeances', libelle: 'Échéances', icone: 'echeances', ton: 'finances', to: '/echeances', si: (d) => d.aModule('vente'), aide: 'Pièces à encaisser par date d’échéance, retards en évidence.' },

  // Achats
  achats: { id: 'achats', libelle: 'Pièces d’achat', court: 'Pièces d’achat', icone: 'panier', ton: 'achats', to: '/achats', exact: true, si: (d) => d.aModule('achat'), aide: 'Factures d’achat, bons de réception, commandes, demandes d’offre.' },
  achatsFA: { id: 'achatsFA', libelle: 'Factures d’achat', icone: 'facture', ton: 'achats', to: '/achats?type=FA', si: doc('achat', 'FA', 'voir') },
  achatsBR: { id: 'achatsBR', libelle: 'Bons de réception', icone: 'reception', ton: 'achats', to: '/achats?type=BR', si: doc('achat', 'BR', 'voir') },
  achatsBC: { id: 'achatsBC', libelle: 'Commandes', icone: 'commande', ton: 'achats', to: '/achats?type=BC', si: doc('achat', 'BC', 'voir') },
  achatsDO: { id: 'achatsDO', libelle: 'Demandes d’offre', icone: 'devis', ton: 'achats', to: '/achats?type=DO', si: doc('achat', 'DO', 'voir') },
  achatsFAV: { id: 'achatsFAV', libelle: 'Avoirs fournisseurs', icone: 'avoir', ton: 'achats', to: '/achats?type=FAV', si: doc('achat', 'FAV', 'voir') },
  achatsBRT: { id: 'achatsBRT', libelle: 'Retours fournisseurs', icone: 'retour', ton: 'achats', to: '/achats?type=BRT', si: doc('achat', 'BRT', 'voir') },
  achatsJournal: { id: 'achatsJournal', libelle: 'Journal des achats', court: 'Journal', icone: 'journal', ton: 'achats', to: '/achats?vue=journal', si: (d) => d.peut('achat', D.achat.journal) },
  nouveauBR: { id: 'nouveauBR', libelle: 'Bon de réception', court: 'Bon de réception', icone: 'reception', ton: 'achats', to: '/achats/nouvelle?type=BR', si: doc('achat', 'BR', 'creer'), aide: 'Réceptionner une livraison fournisseur (entrée en stock).' },
  nouvelleFAachat: { id: 'nouvelleFAachat', libelle: 'Facture d’achat', icone: 'nouveau', ton: 'achats', to: '/achats/nouvelle?type=FA', si: doc('achat', 'FA', 'creer') },
  nouveauBCachat: { id: 'nouveauBCachat', libelle: 'Commande fournisseur', icone: 'commande', ton: 'achats', to: '/achats/nouvelle?type=BC', si: doc('achat', 'BC', 'creer') },
  nouvelleDO: { id: 'nouvelleDO', libelle: 'Demande d’offre', icone: 'devis', ton: 'achats', to: '/achats/nouvelle?type=DO', si: doc('achat', 'DO', 'creer') },

  // Stock
  articles: { id: 'articles', libelle: 'Articles', icone: 'article', ton: 'stock', to: '/stock', exact: true, si: (d) => d.peut('stock', D.stock.article), aide: 'Catalogue, prix, stock et valorisation au PMP.' },
  stockAlerte: { id: 'stockAlerte', libelle: 'Stock en alerte', icone: 'alerte', ton: 'stock', to: '/stock?vue=alerte', si: (d) => d.peut('stock', D.stock.article) },
  peremption: { id: 'peremption', libelle: 'Péremption', icone: 'peremption', ton: 'stock', to: '/stock?vue=peremption', si: (d) => d.peut('stock', D.stock.article) },
  margeNegative: { id: 'margeNegative', libelle: 'Marge négative', icone: 'tendance', ton: 'stock', to: '/stock?vue=marge', si: (d) => d.peut('stock', D.stock.article) },
  mouvements: { id: 'mouvements', libelle: 'Mouvements de stock', court: 'Mouvements', icone: 'mouvements', ton: 'stock', to: '/stock/mouvements', si: (d) => d.peutUn('stock', [D.stock.bonEntree, D.stock.bonSortie]), aide: 'Bons d’entrée, de sortie et transferts entre dépôts.' },
  inventaires: { id: 'inventaires', libelle: 'Inventaires', icone: 'inventaire', ton: 'stock', to: '/stock/inventaires', si: (d) => d.peut('stock', D.stock.inventaire), aide: 'Comptages, écarts et valorisation.' },

  // Tiers
  clients: { id: 'clients', libelle: 'Clients', icone: 'clients', ton: 'tiers', to: '/tiers?vue=clients', si: (d) => d.peut('tiers', D.tiers.clients), aide: 'Fiches clients, crédit, relevés et impayés.' },
  fournisseurs: { id: 'fournisseurs', libelle: 'Fournisseurs', icone: 'fournisseurs', ton: 'tiers', to: '/tiers?vue=fournisseurs', si: (d) => d.peut('tiers', D.tiers.fournisseurs), aide: 'Fiches fournisseurs et relevés.' },
  debiteurs: { id: 'debiteurs', libelle: 'Débiteurs', icone: 'debiteurs', ton: 'finances', to: '/tiers?vue=debiteurs', si: (d) => d.peut('tiers', D.tiers.clients), aide: 'Créances clients par ancienneté.' },
  recouvrement: { id: 'recouvrement', libelle: 'Recouvrement', icone: 'recouvrement', ton: 'finances', to: '/tiers?vue=recouvrement', si: (d) => d.peut('tiers', D.tiers.clients) },
  etatsClients: { id: 'etatsClients', libelle: 'États clients', icone: 'releve', ton: 'tiers', to: '/tiers?vue=etat_clients', si: (d) => d.peut('tiers', D.tiers.clients) },
  etatsFournisseurs: { id: 'etatsFournisseurs', libelle: 'États fournisseurs', icone: 'releve', ton: 'tiers', to: '/tiers?vue=etat_fournisseurs', si: (d) => d.peut('tiers', D.tiers.fournisseurs) },
  referentiels: { id: 'referentiels', libelle: 'Référentiels', icone: 'referentiels', ton: 'config', to: '/referentiels', si: (d) => d.peutUn('tiers', LIBELLES_REFERENTIELS), aide: 'Familles, unités, dépôts, banques, modes de paiement…' },

  // Finances et analyse
  tresorerie: { id: 'tresorerie', libelle: 'Trésorerie', icone: 'tresorerie', ton: 'finances', to: '/tresorerie', si: (d) => d.peut('autre', D.autre.tresorerie), aide: 'Caisses et banques, mouvements, transferts et arrêté de caisse.' },
  statistiques: { id: 'statistiques', libelle: 'Statistiques', icone: 'statistiques', ton: 'analyse', to: '/statistiques', si: (d) => d.peut('autre', D.autre.statistiques), aide: 'Ventes par article, famille, client ; marges ; état 104.' },

  // Configuration
  parametres: { id: 'parametres', libelle: 'Paramètres', icone: 'parametres', ton: 'config', to: '/parametres', exact: true, si: parametres, aide: 'Société, numérotation, impression, apparence et disposition du menu.' },
  modeles: { id: 'modeles', libelle: 'Modèles d’impression', court: 'Modèles d’impression', icone: 'modeles', ton: 'config', to: '/modeles', si: parametres, aide: 'Factures, tickets, relevés, étiquettes : bibliothèque et designer.' },
  utilisateurs: { id: 'utilisateurs', libelle: 'Utilisateurs & droits', court: 'Utilisateurs & droits', icone: 'droits', ton: 'config', to: '/parametres/utilisateurs', si: (d) => d.peut('autre', D.autre.droitsAcces) },
  diagnostic: { id: 'diagnostic', libelle: 'Diagnostic', icone: 'diagnostic', ton: 'config', to: '/diagnostic' },
  // Écran de démonstration (5 000 articles, données factices) : en développement seulement
  grille: { id: 'grille', libelle: 'Grille (démo)', icone: 'grille', ton: 'config', to: '/outils/grille', si: (d) => import.meta.env.DEV && d.peut('stock', D.stock.article) },
  ui: { id: 'ui', libelle: 'Charte & composants', court: 'Charte graphique', icone: 'layers', ton: 'config', to: '/outils/ui', aide: 'Vitrine de la charte graphique : couleurs, typographie, boutons, champs, états et modales.' },

  // Session et affichage
  disposition: { id: 'disposition', libelle: 'Menu latéral', court: 'Menu latéral', icone: 'lateral', ton: 'config', action: 'disposition', aide: 'Revenir à la barre de navigation latérale (modifiable aussi dans Paramètres).' },
  replier: { id: 'replier', libelle: 'Réduire le ruban', icone: 'chevronHaut', ton: 'config', action: 'replier', raccourci: 'Ctrl+F1' },
  dossier: { id: 'dossier', libelle: 'Changer de dossier', icone: 'dossier', ton: 'config', action: 'dossier' },
  agent: { id: 'agent', libelle: 'Changer d’agent', icone: 'serveur', ton: 'config', action: 'agent' },
  deconnexion: { id: 'deconnexion', libelle: 'Changer d’utilisateur', icone: 'deconnexion', ton: 'config', action: 'deconnexion' },
} satisfies Record<string, Commande>;

/** Libellés « Référentiels » du module tiers (hors Clients / Fournisseurs). */
export const LIBELLES_REFERENTIELS = Object.entries(D.tiers)
  .filter(([k]) => k !== 'clients' && k !== 'fournisseurs').map(([, v]) => v as string);

// ─── Ruban ──────────────────────────────────────────────────────────────────

export type ElementRuban = { cmd: Commande; taille: 'grand' | 'petit' };
export type Groupe = { titre: string; elements: ElementRuban[] };
export type Onglet = {
  id: string;
  libelle: string;
  /** Touche d'accès (Alt puis la lettre), comme les KeyTips d'Office. */
  touche: string;
  /** L'onglet devient actif quand on navigue vers ces routes. */
  routes: RegExp;
  groupes: Groupe[];
};

const G = (c: Commande): ElementRuban => ({ cmd: c, taille: 'grand' });
const P = (c: Commande): ElementRuban => ({ cmd: c, taille: 'petit' });

export const ONGLETS: Onglet[] = [
  {
    id: 'accueil', libelle: 'Accueil', touche: 'A', routes: /^\/$/,
    groupes: [
      { titre: 'Activité', elements: [G(C.tableau), G(C.comptoir)] },
      { titre: 'Créer', elements: [G(C.nouvelleFA), P(C.nouveauBL), P(C.nouveauFP), P(C.nouveauBR)] },
      { titre: 'Consulter', elements: [G(C.ventes), G(C.articles), P(C.clients), P(C.fournisseurs), P(C.echeances)] },
      { titre: 'Rechercher', elements: [G(C.rechercher)] },
    ],
  },
  {
    id: 'ventes', libelle: 'Ventes', touche: 'V', routes: /^\/(ventes|comptoir|echeances)/,
    groupes: [
      { titre: 'Caisse', elements: [G(C.comptoir)] },
      { titre: 'Nouveau', elements: [G(C.nouvelleFA), P(C.nouveauBL), P(C.nouveauBC), P(C.nouveauFP)] },
      { titre: 'Documents', elements: [G(C.ventes), P(C.ventesFA), P(C.ventesBL), P(C.ventesBCT), P(C.ventesBC), P(C.ventesFP), P(C.ventesFAV), P(C.ventesBRT)] },
      { titre: 'Suivi', elements: [G(C.echeances), G(C.ventesJournal)] },
    ],
  },
  {
    id: 'achats', libelle: 'Achats', touche: 'H', routes: /^\/achats/,
    groupes: [
      { titre: 'Nouveau', elements: [G(C.nouveauBR), P(C.nouvelleFAachat), P(C.nouveauBCachat), P(C.nouvelleDO)] },
      { titre: 'Documents', elements: [G(C.achats), P(C.achatsFA), P(C.achatsBR), P(C.achatsBC), P(C.achatsDO), P(C.achatsFAV), P(C.achatsBRT)] },
      { titre: 'Suivi', elements: [G(C.achatsJournal), G(C.fournisseurs)] },
    ],
  },
  {
    id: 'stock', libelle: 'Stock', touche: 'S', routes: /^\/stock/,
    groupes: [
      { titre: 'Catalogue', elements: [G(C.articles), P(C.stockAlerte), P(C.peremption), P(C.margeNegative)] },
      { titre: 'Opérations', elements: [G(C.mouvements), G(C.inventaires)] },
      { titre: 'Approvisionnement', elements: [G(C.nouveauBR), P(C.nouveauBCachat)] },
    ],
  },
  {
    id: 'tiers', libelle: 'Tiers', touche: 'T', routes: /^\/(tiers|referentiels)/,
    groupes: [
      { titre: 'Fiches', elements: [G(C.clients), G(C.fournisseurs)] },
      { titre: 'Situation', elements: [G(C.debiteurs), P(C.recouvrement), P(C.etatsClients), P(C.etatsFournisseurs)] },
      { titre: 'Données de base', elements: [G(C.referentiels)] },
    ],
  },
  {
    id: 'finances', libelle: 'Finances', touche: 'R', routes: /^\/tresorerie/,
    groupes: [
      { titre: 'Trésorerie', elements: [G(C.tresorerie)] },
      { titre: 'Encaissements', elements: [G(C.echeances), G(C.debiteurs), P(C.recouvrement), P(C.etatsClients)] },
    ],
  },
  {
    id: 'analyse', libelle: 'Analyse', touche: 'N', routes: /^\/statistiques/,
    groupes: [
      { titre: 'Pilotage', elements: [G(C.tableau), G(C.statistiques)] },
      { titre: 'Journaux', elements: [G({ ...C.ventesJournal, court: 'Journal des ventes' }), G({ ...C.achatsJournal, court: 'Journal des achats' })] },
    ],
  },
  {
    id: 'configuration', libelle: 'Configuration', touche: 'C', routes: /^\/(parametres|modeles|diagnostic|outils)/,
    groupes: [
      { titre: 'Application', elements: [G(C.parametres), G(C.modeles), G(C.utilisateurs)] },
      { titre: 'Données', elements: [G(C.referentiels)] },
      { titre: 'Outils', elements: [P(C.diagnostic), P(C.grille), P(C.ui)] },
      { titre: 'Affichage', elements: [G(C.disposition), P(C.replier)] },
    ],
  },
];

/** Onglet correspondant à la route courante (celui de l'écran ouvert). */
export const ongletDeRoute = (chemin: string): string => ONGLETS.find((o) => o.routes.test(chemin))?.id ?? 'accueil';

/** Filtre les commandes selon les droits ; supprime les groupes et onglets devenus vides. */
export function ongletsVisibles(d: Droits): Onglet[] {
  return ONGLETS
    .map((o) => ({ ...o, groupes: o.groupes.map((g) => ({ ...g, elements: g.elements.filter((e) => !e.cmd.si || e.cmd.si(d)) })).filter((g) => g.elements.length) }))
    .filter((o) => o.groupes.length);
}

/** La commande correspond-elle à l'écran affiché ? (chemin + paramètres de requête de la commande). */
export function estActive(cmd: Commande, chemin: string, recherche: string): boolean {
  if (!cmd.to) return false;
  const [p, q] = cmd.to.split('?');
  if (!q) {
    if (cmd.exact === 'chemin') return chemin === p;
    // la liste « générale » n'est plus active quand un filtre de vue / de type est appliqué
    if (cmd.exact) return chemin === p && !/[?&](type|vue)=/.test(recherche);
    return chemin === p || chemin.startsWith(`${p}/`);
  }
  if (chemin !== p) return false;
  const courant = new URLSearchParams(recherche);
  for (const [k, v] of new URLSearchParams(q)) if (courant.get(k) !== v) return false;
  return true;
}

// ─── Barre latérale ─────────────────────────────────────────────────────────

/** Entrée de la barre latérale : libellé court, actif sur toute la section (filtres compris). */
const L = (c: Commande, libelle: string, plus: Partial<Commande> = {}): Commande => ({ ...c, libelle, exact: c.to === '/', ...plus });

export const MENU_LATERAL: { groupe: string | null; commandes: Commande[] }[] = [
  { groupe: null, commandes: [C.tableau] },
  {
    groupe: 'Activité',
    commandes: [
      C.comptoir, L(C.ventes, 'Ventes'), L(C.achats, 'Achats'), C.echeances, L(C.articles, 'Stock', { exact: 'chemin' }), C.mouvements,
      L(C.clients, 'Tiers', { id: 'tiers', to: '/tiers', si: (d) => d.peutUn('tiers', [D.tiers.clients, D.tiers.fournisseurs]) }), C.tresorerie,
    ],
  },
  { groupe: 'Analyse', commandes: [C.statistiques] },
  { groupe: 'Configuration', commandes: [C.referentiels, C.modeles, L(C.parametres, 'Paramètres', { exact: 'chemin' }), C.utilisateurs, C.grille] },
];

// ─── Ajouts : teintes charte v2, index des commandes, barre d'accès rapide ──

/**
 * Teinte charte v2 de chaque famille (`TONE_VARS` de components/ui) : le ruban lit `*-text` pour les icônes
 * et `*-soft` pour leurs pastilles (contraste AA en clair et en sombre), là où `COULEUR_TON` donne des aplats.
 */
export const TEINTE_TON: Record<Ton, 'brand' | 'orange' | 'teal' | 'violet' | 'success' | 'info' | 'neutral'> = {
  ventes: 'brand',
  achats: 'orange',
  stock: 'teal',
  tiers: 'violet',
  finances: 'success',
  analyse: 'info',
  config: 'neutral',
};

/** Toutes les commandes du registre, par identifiant. */
export const COMMANDES_PAR_ID: Readonly<Record<string, Commande>> = Object.fromEntries((Object.values(C) as Commande[]).map((c) => [c.id, c]));

/** Barre d'accès rapide par défaut (identifiants de commandes). */
export const ACCES_RAPIDE_DEFAUT: readonly string[] = ['tableau', 'nouvelleFA', 'comptoir'];

/** Commandes proposées dans le menu « Personnaliser la barre d'accès rapide » (cases à cocher). */
export const ACCES_RAPIDE_PROPOSES: readonly string[] = [
  'tableau', 'comptoir', 'nouvelleFA', 'nouveauBL', 'nouveauFP', 'nouveauBR', 'ventes', 'achats',
  'articles', 'clients', 'fournisseurs', 'echeances', 'tresorerie', 'statistiques', 'rechercher',
];

/** Commandes de la barre d'accès rapide : identifiants inconnus ignorés, doublons retirés, droits appliqués. */
export function commandesAccesRapide(ids: readonly string[], d: Droits): Commande[] {
  const vus = new Set<string>();
  const sortie: Commande[] = [];
  for (const id of ids) {
    const c = COMMANDES_PAR_ID[id];
    if (!c || vus.has(id) || (c.si && !c.si(d))) continue;
    vus.add(id);
    sortie.push(c);
  }
  return sortie;
}

/** Commande la plus proche d'un écran (icône et libellé de secours des écrans récents). */
export function commandeDeChemin(chemin: string, recherche = ''): Commande | undefined {
  const avecRoute = (Object.values(C) as Commande[]).filter((c) => c.to);
  return avecRoute.find((c) => estActive(c, chemin, recherche))
    // à défaut : la commande dont la route est le plus long préfixe (fiche, édition…)
    ?? avecRoute
      .filter((c) => { const p = c.to!.split('?')[0]; return p !== '/' && (chemin === p || chemin.startsWith(`${p}/`)); })
      .sort((a, b) => b.to!.split('?')[0].length - a.to!.split('?')[0].length)[0];
}
