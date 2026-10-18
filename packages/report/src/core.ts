/**
 * Entrée « sans interface » (aucune dépendance à React) : modèle .gcr, langage d'expressions, moteur de mise en
 * page et de pagination, sortie HTML / impression / PDF, stockage et registres.
 * Utilisable côté serveur (Node) pour générer des documents, avec une estimation de mesure de texte.
 */
export * from './config';
export * from './model';
export * from './format';
export * from './registre';
export * from './store';
export * from './validate';
export * from './lang/enLettres';
export * from './expr/parser';
export * from './expr/eval';
export * from './data/functions';
export * from './engine/render';
export * from './engine/output';
export * from './engine/barcode';
export * from './engine/measure';
export { installerExemples, TYPE_FACTURE, modeleFactureExemple, modeleTicketExemple } from './exemples';
