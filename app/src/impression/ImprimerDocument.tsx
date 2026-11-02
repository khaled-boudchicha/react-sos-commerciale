import { useEffect, useState } from 'react';
import { listerModeles } from '@softly/report/core';
import { choisirModele } from './choixModele';
import ImpressionModele from './ImpressionModeleDiffere';
import type { DemandeImpression } from './demandes';

/**
 * Imprime un document avec le moteur d'états. Modèle retenu : celui imposé par la demande (variantes : journal des
 * ventes / achats…), sinon le modèle par défaut de l'utilisateur pour ce type de document, sinon le premier modèle livré ;
 * un modèle livré personnalisé est remplacé par sa version personnelle (voir `choixModele.ts`).
 * L'aperçu propose un sélecteur de modèle, « Modifier le modèle » (designer), PDF, HTML et impression.
 */
export default function ImprimerDocument({ demande, onClose }: { demande: DemandeImpression; onClose: () => void }) {
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    void listerModeles(demande.kind).then((liste) => {
      if (!vivant) return;
      setRef(choisirModele(demande, liste));
    });
    return () => { vivant = false; };
  }, [demande]);

  if (!ref) return null;
  return <ImpressionModele modeleRef={ref} data={demande.data} titre={demande.titre} onClose={onClose} />;
}
