import { lazy, Suspense, type ComponentProps } from 'react';

/**
 * Aperçu d'impression (et designer de modèles) chargé à la première impression seulement : l'interface du
 * paquet d'états (aperçu, designer, inspecteur…) sort du script principal et le démarrage s'en trouve allégé.
 * Le moteur sans interface (`@softly/report/core` : modèles, rendu, stockage) reste chargé au démarrage.
 */
const ImpressionModele = lazy(() => import('@softly/report').then((m) => ({ default: m.ImpressionModele })));

export default function ImpressionModeleDiffere(props: ComponentProps<typeof ImpressionModele>) {
  return (
    <Suspense fallback={null}>
      <ImpressionModele {...props} />
    </Suspense>
  );
}
