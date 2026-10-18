import { declarerModeleIntegre, type ReportDef } from '@softly/report';
import { MODELES_PIECES } from './modelesPieces';
import { MODELES_ETATS } from './modelesEtats';
import { MODELES_TICKETS } from './modelesTickets';
import { MODELES_ETIQUETTES } from './modelesEtiquettes';

/**
 * Modèles livrés avec l'application (lecture seule). L'utilisateur les « Duplique » pour en faire un fichier .gcr
 * personnel modifiable dans le designer. Pour un même type de document, le PREMIER modèle est celui proposé par défaut.
 */
export const MODELES_INTEGRES: { id: string; build: () => ReportDef }[] = [
  ...MODELES_PIECES,
  ...MODELES_TICKETS,
  ...MODELES_ETATS,
  ...MODELES_ETIQUETTES,
];

/** Déclare les modèles livrés auprès du moteur d'états. */
export function declarerModelesIntegres(): void {
  for (const m of MODELES_INTEGRES) declarerModeleIntegre(m);
}
