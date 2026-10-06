import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Vente } from '../../api/types';
import Dialog, { DialogButton } from '../ui/Dialog';
import { PrintDocument } from '../../print/engine/types';
import { getCachet } from '../../print/engine/cachet';
import { buildVenteModelePrint, buildVentePrint, modelesPour, ModeleVenteId, Societe } from '../../print/templates';

const GENERIQUE = 'generique';
const cleModele = (code: string) => `gc.impression.modele.${code}`;

/**
 * Choix du modèle d'impression d'une pièce de vente (équivalent du sélecteur de modèles
 * `printmodels` du desktop) + option « avec cachet ». Le dernier modèle choisi par type de
 * pièce est retenu sur le poste.
 */
export default function ImprimerPieceDialog({ vente, code, societe, onApercu, onClose }: {
  vente: Vente;
  code: string;
  societe: Societe;
  onApercu: (doc: PrintDocument) => void;
  onClose: () => void;
}) {
  const modeles = modelesPour(code);
  const [choix, setChoix] = useState<string>(() => {
    try {
      const m = localStorage.getItem(cleModele(code));
      if (m && (m === GENERIQUE || modeles.some((x) => x.id === m))) return m;
    } catch { /* stockage indisponible */ }
    return modeles[0]?.id ?? GENERIQUE;
  });
  const [cachet, setCachet] = useState<string | null>(null);
  const [avecCachet, setAvecCachet] = useState(false);
  useEffect(() => { void getCachet().then(setCachet); }, []);

  function apercu() {
    try { localStorage.setItem(cleModele(code), choix); } catch { /* ignore */ }
    const doc = choix === GENERIQUE
      ? buildVentePrint(vente, societe)
      : buildVenteModelePrint(vente, societe, choix as ModeleVenteId, { cachet: avecCachet ? cachet : null });
    onApercu(doc);
  }

  const options = [...modeles.map((m) => ({ id: m.id as string, titre: m.titre, sous: 'Modèle du desktop' })),
    { id: GENERIQUE, titre: 'Modèle moderne A4', sous: 'Mise en page Gestion Commerciale' }];

  return (
    <Dialog title="Imprimer la pièce" subtitle={`${vente.type_doc} ${vente.numero}`} onClose={onClose} width={480}
            footer={<>
              <DialogButton onClick={onClose} kbd="Échap">Annuler</DialogButton>
              <DialogButton kind="primary" onClick={apercu} kbd="Entrée">Aperçu</DialogButton>
            </>}>
      <div className="flex flex-col gap-3" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apercu(); } }}>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-[12px] font-bold text-ink-label mb-1.5">Modèle</legend>
          {options.map((o) => (
            <label key={o.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] border cursor-pointer ${choix === o.id ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-brand-300'}`}>
              <input type="radio" name="modele" value={o.id} checked={choix === o.id} onChange={() => setChoix(o.id)}
                     style={{ accentColor: 'var(--brand-700)' }} />
              <span className="flex flex-col">
                <span className="text-[13px] font-bold">{o.titre}</span>
                <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{o.sous}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {choix !== GENERIQUE && (
          <label className="flex items-center gap-2.5 text-[13px] font-semibold" style={cachet ? undefined : { color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={avecCachet} disabled={!cachet} onChange={(e) => setAvecCachet(e.target.checked)}
                   className="w-[18px] h-[18px]" style={{ accentColor: 'var(--brand-700)' }} />
            Avec cachet
            {!cachet && <span className="font-normal">— ajoutez l’image du cachet dans <Link to="/parametres" className="font-bold text-brand-700" onClick={onClose}>Paramètres</Link></span>}
          </label>
        )}
      </div>
    </Dialog>
  );
}
