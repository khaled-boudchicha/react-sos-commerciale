import { ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { OperateurFiltre } from './types';

/**
 * Fenêtres flottantes de la grille : positionnées sous l'élément déclencheur,
 * maintenues dans la fenêtre, fermées au clic extérieur et à Échap.
 */
export function Flottant({ ancre, onFermer, largeur = 240, children }: {
  ancre: DOMRect; onFermer: () => void; largeur?: number; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: ancre.left, top: ancre.bottom + 4 });
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 0;
    const left = Math.max(8, Math.min(ancre.left, window.innerWidth - largeur - 8));
    const top = ancre.bottom + 4 + h > window.innerHeight - 8 ? Math.max(8, ancre.top - h - 4) : ancre.bottom + 4;
    setPos({ left, top });
  }, [ancre, largeur]);
  useEffect(() => {
    const clic = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onFermer(); };
    const touche = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onFermer(); } };
    const t = setTimeout(() => document.addEventListener('mousedown', clic), 0);
    document.addEventListener('keydown', touche, true);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', clic); document.removeEventListener('keydown', touche, true); };
  }, [onFermer]);
  return (
    <div ref={ref} className="fixed z-[60] bg-surface border border-line-soft rounded-md shadow-lifted text-[12px]"
         style={{ left: pos.left, top: pos.top, width: largeur }}>
      {children}
    </div>
  );
}

/** Filtre d'en-tête : cases à cocher sur les valeurs distinctes (avec effectifs), recherche. */
export function FiltreEntete({ ancre, valeurs, retenues, onAppliquer, onFermer }: {
  ancre: DOMRect;
  /** `cle` : valeur transmise au filtre (mode distant) ; défaut : le texte affiché */
  valeurs: { cle?: string; texte: string; nombre: number }[];
  retenues: string[] | undefined;
  onAppliquer: (valeurs: string[] | null) => void;
  onFermer: () => void;
}) {
  const [coches, setCoches] = useState<Set<string>>(() => new Set(retenues ?? valeurs.map((v) => v.cle ?? v.texte)));
  const [q, setQ] = useState('');
  const visibles = useMemo(() => valeurs.filter((v) => v.texte.toLowerCase().includes(q.toLowerCase())), [valeurs, q]);
  const tout = visibles.every((v) => coches.has(v.cle ?? v.texte));
  return (
    <Flottant ancre={ancre} onFermer={onFermer} largeur={260}>
      <div className="p-2 border-b border-line-soft">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
               className="w-full border border-line rounded-sm px-2 py-1.5 bg-surface text-ink" />
      </div>
      <div className="max-h-64 overflow-auto py-1">
        <label className="flex items-center gap-2 px-3 py-1 font-bold text-ink-label hover:bg-line-soft">
          <input type="checkbox" checked={tout} onChange={() => setCoches((s) => {
            const n = new Set(s);
            visibles.forEach((v) => (tout ? n.delete(v.cle ?? v.texte) : n.add(v.cle ?? v.texte)));
            return n;
          })} />
          (Tout sélectionner)
        </label>
        {visibles.map((v) => (
          <label key={v.cle ?? v.texte} className="flex items-center gap-2 px-3 py-1 hover:bg-line-soft">
            <input type="checkbox" checked={coches.has(v.cle ?? v.texte)} onChange={() => setCoches((s) => {
              const k = v.cle ?? v.texte;
              const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n;
            })} />
            <span className="flex-1 truncate">{v.texte || '(vide)'}</span>
            <span className="text-ink-muted money text-[10.5px]">{v.nombre}</span>
          </label>
        ))}
        {visibles.length === 0 && <div className="px-3 py-2 text-ink-muted">Aucune valeur.</div>}
      </div>
      <div className="flex gap-2 p-2 border-t border-line-soft">
        <button onClick={() => { onAppliquer(null); onFermer(); }} className="flex-1 border border-line rounded-sm py-1.5 font-bold text-ink-label">Effacer</button>
        <button onClick={() => {
          onAppliquer(coches.size === valeurs.length ? null : [...coches]);
          onFermer();
        }} className="flex-1 rounded-sm py-1.5 font-bold text-white bg-brand-700">OK</button>
      </div>
    </Flottant>
  );
}

/** Sélecteur de colonnes : afficher / masquer (glisser un en-tête ici le masque aussi). */
export function SelecteurColonnes({ ancre, colonnes, masquees, onBasculer, onReinitialiser, onFermer }: {
  ancre: DOMRect;
  colonnes: { champ: string; titre: string; masquable: boolean }[];
  masquees: string[];
  onBasculer: (champ: string) => void;
  onReinitialiser: () => void;
  onFermer: () => void;
}) {
  return (
    <Flottant ancre={ancre} onFermer={onFermer} largeur={240}>
      <div className="px-3 py-2 font-bold border-b border-line-soft">Colonnes</div>
      <div className="max-h-72 overflow-auto py-1">
        {colonnes.map((c) => (
          <label key={c.champ} className={`flex items-center gap-2 px-3 py-1 hover:bg-line-soft ${c.masquable ? '' : 'opacity-50'}`}>
            <input type="checkbox" disabled={!c.masquable} checked={!masquees.includes(c.champ)} onChange={() => onBasculer(c.champ)} />
            {c.titre}
          </label>
        ))}
      </div>
      <div className="p-2 border-t border-line-soft">
        <button onClick={() => { onReinitialiser(); onFermer(); }} className="w-full border border-line rounded-sm py-1.5 font-bold text-ink-label">
          Rétablir la disposition par défaut
        </button>
      </div>
    </Flottant>
  );
}

export type EntreeMenu = { libelle: string; action: () => void; actif?: boolean; desactive?: boolean; separateur?: boolean };

/** Menu contextuel (clic droit sur un en-tête, une ligne). */
export function MenuContextuel({ ancre, entrees, onFermer }: { ancre: DOMRect; entrees: EntreeMenu[]; onFermer: () => void }) {
  return (
    <Flottant ancre={ancre} onFermer={onFermer} largeur={220}>
      <div className="py-1">
        {entrees.map((e, i) => (
          <div key={i}>
            {e.separateur && <div className="my-1 border-t border-line-soft" />}
            <button disabled={e.desactive} onClick={() => { e.action(); onFermer(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-line-soft disabled:opacity-40 flex items-center gap-2">
              <span className="w-3 text-brand-700">{e.actif ? '✓' : ''}</span>{e.libelle}
            </button>
          </div>
        ))}
      </div>
    </Flottant>
  );
}

export const LIBELLES_OPERATEURS: Record<OperateurFiltre, string> = {
  contient: 'Contient', ne_contient_pas: 'Ne contient pas', commence: 'Commence par', finit: 'Finit par',
  '=': 'Égal à', '<>': 'Différent de', '<': 'Inférieur à', '<=': 'Inférieur ou égal', '>': 'Supérieur à',
  '>=': 'Supérieur ou égal', entre: 'Entre', vide: 'Vide', non_vide: 'Non vide',
};

export const SYMBOLES_OPERATEURS: Record<OperateurFiltre, string> = {
  contient: '∋', ne_contient_pas: '∌', commence: 'a…', finit: '…a', '=': '=', '<>': '≠', '<': '<', '<=': '≤',
  '>': '>', '>=': '≥', entre: '↔', vide: '∅', non_vide: '≠∅',
};

export function operateursPour(type: string | undefined): OperateurFiltre[] {
  if (type === 'number' || type === 'money' || type === 'date')
    return ['=', '<>', '<', '<=', '>', '>=', 'entre', 'vide', 'non_vide'];
  if (type === 'boolean') return ['=', 'vide', 'non_vide'];
  return ['contient', 'ne_contient_pas', 'commence', 'finit', '=', '<>', 'vide', 'non_vide'];
}
