/**
 * Anciens modèles HTML encore utilisés : modèles « du desktop (Delphi) » des pièces de vente (dialogue « Imprimer la
 * pièce ») et blocs partagés (export PDF des grilles). Tous les autres états passent par le moteur `@softly/report`
 * (`src/impression`, voir docs/05-IMPRESSION.md).
 */
export type { Societe } from './partials';
export { buildVenteModelePrint, MODELES_VENTE, modelesPour } from './venteModeles';
export type { ModeleVenteId, ModeleVente, OptionsImpression } from './venteModeles';
