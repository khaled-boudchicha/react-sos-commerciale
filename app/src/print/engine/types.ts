/**
 * Un document imprimable, produit par un modèle (src/print/templates/*).
 *
 * Le moteur (PrintPreview) l'injecte dans une iframe isolée : le HTML et le CSS
 * du modèle ne rencontrent JAMAIS les styles de l'application (et inversement).
 * La pagination (@page, sauts, compteurs de pages, en-têtes de tableau répétés)
 * est assurée par Paged.js à l'intérieur de l'iframe.
 */
export type PrintDocument = {
  /** Titre du document — onglet du dialogue d'impression et nom de fichier PDF par défaut. */
  title: string;
  /** Corps HTML complet (généré par renderToStaticMarkup d'un composant React). */
  html: string;
  /** CSS du modèle, incluant les règles `@page` (taille, marges, marges tournantes Paged.js). */
  css: string;
};
