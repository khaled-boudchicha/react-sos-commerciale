import { useEffect, useState } from 'react';
import type { ReportData, ReportDef } from '../model';
import { ModeleInfo, chargerModele, definirModeleParDefaut, definirVersionPersonnelle, listerModeles } from '../store';
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
  const [modeles, setModeles] = useState<ModeleInfo[]>([]);

  useEffect(() => {
    let vivant = true;
    chargerModele(ref).then((d) => { if (vivant) setDef(d); }).catch((e) => { toast.error((e as Error).message); onClose(); });
    return () => { vivant = false; };
  }, [ref]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (def) void listerModeles(def.kind).then(setModeles); }, [def?.kind, edition]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!def) return null;
  if (edition) {
    return (
      <ReportDesigner initial={def} fichier={ref.startsWith('fichier:') ? ref.slice('fichier:'.length) : undefined} donneesApercu={data}
                      onSaved={(f) => {
                        // Modèle livré personnalisé depuis l'impression : sa version personnelle le remplace désormais
                        const nouveau = `fichier:${f}`;
                        if (ref.startsWith('integre:')) definirVersionPersonnelle(ref, nouveau);
                        setRef(nouveau);
                      }}
                      onClose={() => { setEdition(false); setDef(null); /* recharge le modèle enregistré */ void chargerModele(ref).then(setDef).catch(() => onClose()); }} />
    );
  }
  const selecteur = modeles.length > 1 ? (
    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
      Modèle
      <select value={modeles.some((m) => m.ref === ref) ? ref : ''} aria-label="Modèle d’impression"
              onChange={(e) => { const r = e.target.value; if (!r) return; definirModeleParDefaut(def.kind, r); setRef(r); }}
              className="h-8 max-w-[260px] rounded-md border border-line bg-surface text-ink text-[12px] font-bold px-2">
        {!modeles.some((m) => m.ref === ref) && <option value="">{def.name}</option>}
        {modeles.map((m) => <option key={m.ref} value={m.ref}>{m.name}{m.source === 'integre' ? '' : ' (perso)'}</option>)}
      </select>
    </label>
  ) : null;
  return <ReportPreview def={def} data={data} titre={titre} onClose={onClose} onEdit={() => setEdition(true)} extra={selecteur} />;
}

export default function ImpressionModele(props: Parameters<typeof ImpressionModeleInterne>[0]) {
  return <Racine><ImpressionModeleInterne {...props} /></Racine>;
}
