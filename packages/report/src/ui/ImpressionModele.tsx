import { useEffect, useState } from 'react';
import type { ReportData, ReportDef } from '../model';
import { chargerModele } from '../store';
import { useToast } from './toast';
import ReportPreview from './ReportPreview';
import ReportDesigner from './ReportDesigner';
import { Racine } from './Racine';

/**
 * Imprime des données avec un modèle (intégré ou fichier .gcr) : aperçu → « Modifier le modèle »
 * ouvre le designer (avec les vraies données) → retour à l'aperçu à jour.
 * C'est le point d'entrée unique pour tout écran qui propose des modèles personnalisés.
 */
function ImpressionModeleInterne({ modeleRef, data, titre, onClose }: {
  /** `integre:<id>` ou `fichier:<nom.gcr>` (voir ModeleInfo.ref). */
  modeleRef: string;
  data: ReportData;
  titre?: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [ref, setRef] = useState(modeleRef);
  const [def, setDef] = useState<ReportDef | null>(null);
  const [edition, setEdition] = useState(false);

  useEffect(() => {
    let vivant = true;
    chargerModele(ref).then((d) => { if (vivant) setDef(d); }).catch((e) => { toast.error((e as Error).message); onClose(); });
    return () => { vivant = false; };
  }, [ref]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!def) return null;
  if (edition) {
    return (
      <ReportDesigner initial={def} fichier={ref.startsWith('fichier:') ? ref.slice('fichier:'.length) : undefined} donneesApercu={data}
                      onSaved={(f) => setRef(`fichier:${f}`)}
                      onClose={() => { setEdition(false); setDef(null); /* recharge le modèle enregistré */ void chargerModele(ref).then(setDef).catch(() => onClose()); }} />
    );
  }
  return <ReportPreview def={def} data={data} titre={titre} onClose={onClose} onEdit={() => setEdition(true)} />;
}

export default function ImpressionModele(props: Parameters<typeof ImpressionModeleInterne>[0]) {
  return <Racine><ImpressionModeleInterne {...props} /></Racine>;
}
