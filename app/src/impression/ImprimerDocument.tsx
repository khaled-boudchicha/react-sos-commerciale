import { useEffect, useState } from 'react';
import { listerModeles, modeleParDefaut } from '@softly/report/core';
import ImpressionModele from './ImpressionModeleDiffere';
import type { DemandeImpression } from './demandes';

/**
 * Imprime un document avec le moteur d'états. Modèle retenu : celui imposé par la demande (variantes : journal des
 * ventes / achats…), sinon le modèle par défaut de l'utilisateur pour ce type de document, sinon le premier modèle livré.
 * L'aperçu propose un sélecteur de modèle, « Modifier le modèle » (designer), PDF, HTML et impression.
 */
export default function ImprimerDocument({ demande, onClose }: { demande: DemandeImpression; onClose: () => void }) {
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    void listerModeles(demande.kind).then((liste) => {
      if (!vivant) return;
      const refs = new Set(liste.map((m) => m.ref));
      const impose = demande.modele ? (demande.modele.includes(':') ? demande.modele : `integre:${demande.modele}`) : null;
      const defaut = modeleParDefaut(demande.kind);
      setRef(impose && refs.has(impose) ? impose : defaut && refs.has(defaut) ? defaut : liste[0]?.ref ?? null);
    });
    return () => { vivant = false; };
  }, [demande]);

  if (!ref) return null;
  return <ImpressionModele modeleRef={ref} data={demande.data} titre={demande.titre} onClose={onClose} />;
}
