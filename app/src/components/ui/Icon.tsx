import type { CSSProperties, ReactNode } from 'react';

/**
 * Jeu d'icônes UNIQUE de l'application (charte v2 §2.5) : tracés 24 × 24 au trait arrondi,
 * couleur héritée du texte (`currentColor`), aucune dépendance externe.
 * Remplace les emoji et les glyphes typographiques (✕ ✓ ⚠ ✎ ⬇ 🔍 📁…).
 *
 * Noms : anglais pour le code nouveau ; les noms français historiques (navigation, comptoir)
 * restent valides comme alias.
 */
const fichier = <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></>;
const colis = <><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>;

const NAV = {
  accueil: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></>,
  tableau: <><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></>,
  comptoir: <><path d="m2 7 4.4-4.4A2 2 0 0 1 7.8 2h8.4a2 2 0 0 1 1.4.6L22 7" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" /><path d="M2 7h20v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-2-.8 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-4 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2Z" /></>,
  facture: <>{fichier}<path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></>,
  nouveau: <>{fichier}<path d="M12 18v-6" /><path d="M9 15h6" /></>,
  commande: <>{fichier}<path d="m9 15 2 2 4-4" /></>,
  avoir: <>{fichier}<path d="M9 15h6" /></>,
  devis: <>{fichier}<path d="M8 13h2" /><path d="M8 17h2" /><path d="M14 13h2" /><path d="M14 17h2" /></>,
  livraison: <><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></>,
  retour: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  ticket: <><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h5" /></>,
  panier: <><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></>,
  reception: <>{colis}<path d="m7.5 4.27 9 5.15" /></>,
  article: colis,
  entree: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" /></>,
  sortie: <><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M4 21h16" /></>,
  mouvements: <><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></>,
  inventaire: <><rect width="8" height="4" x="8" y="2" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></>,
  alerte: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  peremption: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2" /><path d="M5 3 2 6" /><path d="m22 6-3-3" /></>,
  etiquette: <><path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r="1" /></>,
  clients: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  fournisseurs: <><rect width="16" height="20" x="4" y="2" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" /></>,
  debiteurs: <><rect width="20" height="12" x="2" y="6" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></>,
  recouvrement: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
  releve: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></>,
  referentiels: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
  tresorerie: <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>,
  banque: <><path d="M3 22h18" /><path d="M6 18v-7" /><path d="M10 18v-7" /><path d="M14 18v-7" /><path d="M18 18v-7" /><path d="M12 2 20 7H4z" /></>,
  echeances: <><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h5" /><path d="M17.5 17.5 16 16.3V14" /><circle cx="16" cy="16" r="6" /></>,
  statistiques: <><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></>,
  camembert: <><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></>,
  tendance: <><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></>,
  journal: <><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /><path d="M8 7h8" /><path d="M8 11h6" /></>,
  parametres: <><path d="M21 4h-7" /><path d="M10 4H3" /><path d="M21 12h-9" /><path d="M8 12H3" /><path d="M21 20h-5" /><path d="M12 20H3" /><path d="M14 2v4" /><path d="M8 10v4" /><path d="M16 18v4" /></>,
  imprimante: <><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" /></>,
  modeles: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></>,
  droits: <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></>,
  grille: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M12 3v18" /></>,
  diagnostic: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  rechercher: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  dossier: <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />,
  serveur: <><rect width="20" height="8" x="2" y="2" rx="2" /><rect width="20" height="8" x="2" y="14" rx="2" /><path d="M6 6h.01" /><path d="M6 18h.01" /></>,
  utilisateur: <><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></>,
  deconnexion: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  lateral: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /></>,
  ruban: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  fermer: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  chevronHaut: <path d="m18 15-6-6-6 6" />,
  chevronBas: <path d="m6 9 6 6 6-6" />,
  chevronGauche: <path d="m15 18-6-6 6-6" />,
  info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
  epingle: <><path d="M12 17v5" /><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" /></>,
};

/** Tracés propres au comptoir (maquette « Vente au comptoir »). */
const POS = {
  scan: <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M11 8v8M15 8v8" />,
  corbeille: <><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><path d="M10 11v6" /><path d="M14 11v6" /></>,
  especes: <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2M14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M6 12h.01M18 12h.01" />,
  pourcent: <path d="M19 5 5 19M7.5 6.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0M18.5 17.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0" />,
  liste: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  cadenas: <path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />,
  croix: <path d="M18 6 6 18M6 6l12 12" />,
};

/** Icônes génériques de l'interface (noms anglais). */
const UI = {
  check: <path d="M20 6 9 17l-5-5" />,
  checkCircle: <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
  alertCircle: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></>,
  xCircle: <><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></>,
  edit: <><path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z" /><path d="m15 5 4 4" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" /></>,
  minus: <path d="M5 12h14" />,
  arrowLeft: <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>,
  arrowRight: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  arrowUp: <><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></>,
  arrowDown: <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronsLeft: <><path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" /></>,
  chevronsRight: <><path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></>,
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  columns: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /><path d="M15 3v18" /></>,
  filter: <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />,
  refresh: <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></>,
  externalLink: <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
  eye: <><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M10.73 5.08a10.74 10.74 0 0 1 11.2 6.57 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49" /><path d="M14.08 14.16a3 3 0 0 1-4.24-4.24" /><path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14" /><path d="m2 2 20 20" /></>,
  calendar: <><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  copy: <><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>,
  save: <><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /><path d="M7 3v4a1 1 0 0 0 1 1h7" /></>,
  keyboard: <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="M6 8h.01" /><path d="M10 8h.01" /><path d="M14 8h.01" /><path d="M18 8h.01" /><path d="M8 12h.01" /><path d="M12 12h.01" /><path d="M16 12h.01" /><path d="M7 16h10" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  trendDown: <><path d="m22 17-8.5-8.5-5 5L2 7" /><path d="M16 17h6v-6" /></>,
  wifiOff: <><path d="M12 20h.01" /><path d="M8.5 16.43a5 5 0 0 1 7 0" /><path d="M2 8.82a15 15 0 0 1 4.17-2.65" /><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" /><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" /><path d="M5 13a10 10 0 0 1 5.24-2.76" /><path d="m2 2 20 20" /></>,
  sparkles: <><path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.13a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0z" /></>,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>,
  layers: <><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" /><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" /><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" /></>,
};

/** Alias anglais des tracés existants. */
const ALIAS = {
  home: NAV.accueil, dashboard: NAV.tableau, counter: NAV.comptoir, invoice: NAV.facture, newDoc: NAV.nouveau,
  order: NAV.commande, creditNote: NAV.avoir, quote: NAV.devis, delivery: NAV.livraison, return: NAV.retour,
  receipt: NAV.ticket, cart: NAV.panier, package: NAV.article, stockIn: NAV.entree, stockOut: NAV.sortie,
  movements: NAV.mouvements, inventory: NAV.inventaire, alert: NAV.alerte, expiry: NAV.peremption, tag: NAV.etiquette,
  users: NAV.clients, building: NAV.fournisseurs, debtors: NAV.debiteurs, history: NAV.recouvrement, statement: NAV.releve,
  book: NAV.referentiels, wallet: NAV.tresorerie, bank: NAV.banque, dueDates: NAV.echeances, stats: NAV.statistiques,
  pie: NAV.camembert, trend: NAV.tendance, journal: NAV.journal, settings: NAV.parametres, printer: NAV.imprimante,
  templates: NAV.modeles, shield: NAV.droits, grid: NAV.grille, activity: NAV.diagnostic, search: NAV.rechercher,
  folder: NAV.dossier, server: NAV.serveur, user: NAV.utilisateur, logout: NAV.deconnexion,
  layoutSidebar: NAV.lateral, layoutRibbon: NAV.ruban, close: NAV.fermer, chevronUp: NAV.chevronHaut,
  chevronDown: NAV.chevronBas, chevronLeft: NAV.chevronGauche, pin: NAV.epingle,
  scanBarcode: POS.scan, trash: POS.corbeille, cash: POS.especes, percent: POS.pourcent, list: POS.liste, lock: POS.cadenas,
};

const ICONS = { ...NAV, ...POS, ...UI, ...ALIAS } satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;
/** Ancien nom du type (comptoir, navigation) — conservé. */
export type NomIcone = IconName;

export function hasIcon(name: string): name is IconName {
  return name in ICONS;
}

export type IconProps = {
  name: IconName;
  size?: number;
  /** Épaisseur du trait ; par défaut 2 en ≤ 16 px, 1,75 au-delà (charte §2.5). */
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  /** Libellé accessible ; absent = icône décorative (aria-hidden). */
  label?: string;
};

export function Icon({ name, size = 18, strokeWidth, className, style, label }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={strokeWidth ?? (size <= 16 ? 2 : 1.75)} strokeLinecap="round" strokeLinejoin="round"
         className={`flex-none ${className ?? ''}`} style={style}
         role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      {ICONS[name]}
    </svg>
  );
}

export default Icon;

/** Pastille tonale (fond *-soft, icône *-text) — vignettes KPI, états vides, en-têtes. */
export type Tone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'teal' | 'violet' | 'orange';

export const TONE_VARS: Record<Tone, { text: string; soft: string; line: string; solid: string }> = {
  brand: { text: 'var(--brand-text)', soft: 'var(--brand-soft)', line: 'var(--brand-line)', solid: 'var(--brand-700)' },
  neutral: { text: 'var(--neutral-text)', soft: 'var(--neutral-soft)', line: 'var(--neutral-line)', solid: 'var(--neutral-solid)' },
  success: { text: 'var(--success-text)', soft: 'var(--success-soft)', line: 'var(--success-line)', solid: 'var(--success-solid)' },
  warning: { text: 'var(--warning-text)', soft: 'var(--warning-soft)', line: 'var(--warning-line)', solid: 'var(--warning-solid)' },
  danger: { text: 'var(--danger-text)', soft: 'var(--danger-soft)', line: 'var(--danger-line)', solid: 'var(--danger-solid)' },
  info: { text: 'var(--info-text)', soft: 'var(--info-soft)', line: 'var(--info-line)', solid: 'var(--info-solid)' },
  teal: { text: 'var(--teal-text)', soft: 'var(--teal-soft)', line: 'var(--teal-line)', solid: 'var(--teal-solid)' },
  violet: { text: 'var(--violet-text)', soft: 'var(--violet-soft)', line: 'var(--violet-line)', solid: 'var(--violet-solid)' },
  orange: { text: 'var(--orange-text)', soft: 'var(--orange-soft)', line: 'var(--orange-line)', solid: 'var(--orange-solid)' },
};

export function IconBadge({ name, tone = 'brand', size = 'md', className }: {
  name: IconName; tone?: Tone; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string;
}) {
  const dim = { sm: [28, 16], md: [36, 18], lg: [44, 22], xl: [56, 28] }[size];
  const t = TONE_VARS[tone];
  return (
    <span className={`inline-flex flex-none items-center justify-center rounded-md ${className ?? ''}`}
          style={{ width: dim[0], height: dim[0], background: t.soft, color: t.text }} aria-hidden="true">
      <Icon name={name} size={dim[1]} />
    </span>
  );
}

/** Touche clavier affichée sur un bouton (keycap). */
export function Kbd({ children, tone = 'line', size = 'sm' }: {
  children: ReactNode;
  /** line = bordure grise ; brand = bordure bleue ; inverse = sur fond plein coloré. */
  tone?: 'line' | 'brand' | 'inverse';
  size?: 'sm' | 'md';
}) {
  const style: CSSProperties = tone === 'inverse'
    ? { background: 'rgb(255 255 255 / .2)' }
    : { border: `1px solid ${tone === 'brand' ? 'var(--brand-300)' : 'var(--line)'}`, color: tone === 'brand' ? 'inherit' : 'var(--text-label)', background: 'var(--surface)' };
  return (
    <kbd className={`money font-bold not-italic leading-none ${size === 'md' ? 'text-xs px-[7px] py-[4px] rounded-[6px]' : 'text-2xs px-[5px] py-[2px] rounded-xs'}`}
         style={style}>{children}</kbd>
  );
}
