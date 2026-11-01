import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Vente } from '../../api/types';
import Dialog, { KeyHints } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';
import { PrintDocument } from '../../print/engine/types';
import { getCachet } from '../../print/engine/cachet';
import { buildVenteModelePrint, modelesPour, ModeleVenteId, Societe } from '../../print/templates';
import { type ModeleInfo, listerModeles, modeleParDefaut } from '@softly/report/core';

/** Modèle professionnel proposé par défaut selon le type de pièce (premier modèle livré sinon). */
const PRO_PAR_TYPE: Record<string, string> = { BL: 'integre-bl-a4', BCT: 'integre-bon-comptoir-a5' };
const proDefaut = (code: string) => `perso:integre:${PRO_PAR_TYPE[code] ?? 'integre-facture-a4'}`;
const cleModele = (code: string) => `gc.impression.modele.${code}`;

/**
 * Choix du modèle d'impression d'une pièce de vente (équivalent du sélecteur de modèles
 * `printmodels` du desktop) + option « avec cachet ». Le dernier modèle choisi par type de
 * pièce est retenu sur le poste.
 */
export default function ImprimerPieceDialog({ vente, code, societe, onApercu, onModele, onClose }: {
  vente: Vente;
  code: string;
  societe: Societe;
  onApercu: (doc: PrintDocument) => void;
  /** Modèle personnalisé (.gcr ou intégré du designer) choisi : `integre:<id>` / `fichier:<nom>`. */
  onModele?: (ref: string) => void;
  onClose: () => void;
}) {
  const [perso, setPerso] = useState<ModeleInfo[]>([]);
  useEffect(() => { void listerModeles('vente').then(setPerso).catch(() => setPerso([])); }, []);
  const modeles = modelesPour(code);
  const [choix, setChoix] = useState<string>(() => {
    try {
      const m = localStorage.getItem(cleModele(code));
      if (m && m !== 'generique' && (m.startsWith('perso:') || modeles.some((x) => x.id === m))) return m;
    } catch { /* stockage indisponible */ }
    return proDefaut(code);
  });
  const [cachet, setCachet] = useState<string | null>(null);
  const [avecCachet, setAvecCachet] = useState(false);
  useEffect(() => { void getCachet().then(setCachet); }, []);

  function apercu() {
    try { localStorage.setItem(cleModele(code), choix); } catch { /* ignore */ }
    if (choix.startsWith('perso:')) { onModele?.(choix.slice('perso:'.length)); return; }
    onApercu(buildVenteModelePrint(vente, societe, choix as ModeleVenteId, { cachet: avecCachet ? cachet : null }));
  }

  const defautPerso = modeleParDefaut('vente');
  const options = [
    ...perso.filter((m) => m.source === 'integre').map((m) => ({ id: `perso:${m.ref}`, titre: m.name, sous: `${m.description ?? 'Modèle professionnel'}${defautPerso === m.ref ? ' · par défaut' : ''}` })),
    ...perso.filter((m) => m.source === 'fichier').map((m) => ({ id: `perso:${m.ref}`, titre: m.name, sous: `Mon modèle${defautPerso === m.ref ? ' · par défaut' : ''}` })),
    ...modeles.map((m) => ({ id: m.id as string, titre: m.titre, sous: 'Modèle du desktop (Delphi)' })),
  ];

  return (
    <Dialog title="Imprimer la pièce" subtitle={`${vente.type_doc} ${vente.numero}`} onClose={onClose} width={480}
            icon="printer"
            footerStart={<KeyHints items={[['Entrée', 'aperçu'], ['Échap', 'annuler']]} />}
            footer={<>
              <Button onClick={onClose}>Annuler</Button>
              <Button variant="primary" icon="eye" onClick={apercu}>Aperçu</Button>
            </>}>
      <div className="flex flex-col gap-3" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apercu(); } }}>
        <fieldset className="flex flex-col gap-1.5 max-h-[58vh] overflow-y-auto pr-1">
          <legend className="text-xs font-semibold text-ink-label mb-1.5">Modèle</legend>
          {options.map((o) => (
            <label key={o.id} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors duration-fast',
              choix === o.id ? 'border-brand-line bg-brand-soft' : 'border-line hover:border-line-strong hover:bg-hover')}>
              <input type="radio" name="modele" value={o.id} checked={choix === o.id} onChange={() => setChoix(o.id)}
                     style={{ accentColor: 'var(--brand-700)' }} />
              <span className="flex flex-col">
                <span className="text-base font-bold text-ink">{o.titre}</span>
                <span className="text-xs text-ink-muted line-clamp-2">{o.sous}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {!choix.startsWith('perso:') && (
          <label className={cn('flex items-center gap-2.5 text-base font-semibold', cachet ? 'text-ink' : 'text-ink-muted')}>
            <input type="checkbox" checked={avecCachet} disabled={!cachet} onChange={(e) => setAvecCachet(e.target.checked)}
                   className="w-4 h-4" style={{ accentColor: 'var(--brand-700)' }} />
            Avec cachet
            {!cachet && <span className="font-normal">— ajoutez l’image du cachet dans <Link to="/parametres" className="font-bold text-brand-text hover:underline underline-offset-2" onClick={onClose}>Paramètres</Link></span>}
          </label>
        )}
      </div>
    </Dialog>
  );
}
