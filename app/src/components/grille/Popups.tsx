import { ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { Icon } from '../ui/Icon';
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
    <div ref={ref} className="fixed z-popover bg-raised text-ink border border-line-soft rounded-md shadow-lifted text-sm overflow-hidden animate-fade-in"
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
        <TextInput size="sm" leading="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
                   aria-label="Rechercher une valeur" />
      </div>
      <div className="max-h-64 overflow-auto py-1">
        <label className="flex items-center gap-2 px-3 py-1 font-semibold text-ink-label hover:bg-hover cursor-pointer">
          <input type="checkbox" className="accent-[var(--brand-700)]" checked={tout} onChange={() => setCoches((s) => {
            const n = new Set(s);
            visibles.forEach((v) => (tout ? n.delete(v.cle ?? v.texte) : n.add(v.cle ?? v.texte)));
            return n;
          })} />
          (Tout sélectionner)
        </label>
        {visibles.map((v) => (
          <label key={v.cle ?? v.texte} className="flex items-center gap-2 px-3 py-1 hover:bg-hover cursor-pointer">
            <input type="checkbox" className="accent-[var(--brand-700)]" checked={coches.has(v.cle ?? v.texte)} onChange={() => setCoches((s) => {
              const k = v.cle ?? v.texte;
              const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n;
            })} />
            <span className={`flex-1 truncate ${v.texte ? '' : 'italic text-ink-muted'}`}>{v.texte || '(vide)'}</span>
            <span className="text-ink-muted money text-xs">{v.nombre}</span>
          </label>
        ))}
        {visibles.length === 0 && <div className="px-3 py-2 text-ink-muted">Aucune valeur.</div>}
      </div>
      <div className="flex gap-2 p-2 border-t border-line-soft bg-sunken">
        <Button size="sm" className="flex-1" onClick={() => { onAppliquer(null); onFermer(); }}>Effacer</Button>
        <Button size="sm" variant="primary" className="flex-1" onClick={() => {
          onAppliquer(coches.size === valeurs.length ? null : [...coches]);
          onFermer();
        }}>OK</Button>
      </div>
    </Flottant>
  );
}

/** Sélecteur de colonnes : afficher / masquer (glisser un en-tête ici le masque aussi). */
export function SelecteurColonnes({ ancre, colonnes, masquees, onBasculer, onReinitialiser, onFermer, figees, onFiger }: {
  ancre: DOMRect;
  colonnes: { champ: string; titre: string; masquable: boolean }[];
  masquees: string[];
  onBasculer: (champ: string) => void;
  onReinitialiser: () => void;
  onFermer: () => void;
  /** Côté figé effectif par colonne (épingle) */
  figees?: Record<string, 'gauche' | 'droite' | undefined>;
  onFiger?: (champ: string, cote: 'gauche' | 'aucune') => void;
}) {
  // État local : le panneau est rendu une fois à l'ouverture, il suit ici les bascules
  const [cachees, setCachees] = useState(masquees);
  const [fig, setFig] = useState(figees ?? {});
  const [q, setQ] = useState('');
  const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const liste = colonnes.filter((c) => c.titre && (!q || norm(c.titre).includes(norm(q))));
  const nbVisibles = colonnes.filter((c) => c.titre && !cachees.includes(c.champ)).length;
  const basculer = (champ: string) => {
    setCachees((m) => (m.includes(champ) ? m.filter((x) => x !== champ) : [...m, champ]));
    onBasculer(champ);
  };
  const toutAfficher = () => {
    for (const c of colonnes) if (c.masquable && cachees.includes(c.champ)) onBasculer(c.champ);
    setCachees((m) => m.filter((x) => !colonnes.some((c) => c.champ === x && c.masquable)));
  };
  return (
    <Flottant ancre={ancre} onFermer={onFermer} largeur={280}>
      <div className="flex items-center gap-2 px-3 py-2 font-bold text-ink border-b border-line-soft">
        <Icon name="columns" size={16} className="text-ink-muted" />Colonnes
        <span className="ms-auto text-xs font-semibold text-ink-muted">{nbVisibles} / {colonnes.filter((c) => c.titre).length}</span>
      </div>
      <div className="p-2 border-b border-line-soft">
        <TextInput size="sm" leading="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une colonne…" autoFocus
                   aria-label="Chercher une colonne" />
      </div>
      <div className="max-h-72 overflow-auto py-1">
        {liste.length === 0 && <div className="px-3 py-3 text-sm text-ink-muted">Aucune colonne ne correspond.</div>}
        {liste.map((c) => {
          const cote = fig[c.champ];
          return (
            <div key={c.champ} className="group flex items-center gap-2 px-3 h-8 hover:bg-hover">
              <label className={`flex flex-1 min-w-0 items-center gap-2 ${c.masquable ? 'cursor-pointer' : 'opacity-50'}`}>
                <input type="checkbox" className="accent-[var(--brand-700)]" disabled={!c.masquable} checked={!cachees.includes(c.champ)} onChange={() => basculer(c.champ)} />
                <span className="truncate">{c.titre}</span>
              </label>
              {onFiger && (
                <button type="button" title={cote ? 'Libérer la colonne' : 'Figer à gauche (reste visible au défilement)'}
                        aria-label={cote ? `Libérer ${c.titre}` : `Figer ${c.titre} à gauche`} aria-pressed={!!cote}
                        onClick={() => { const n = cote ? 'aucune' : 'gauche'; setFig((f) => ({ ...f, [c.champ]: n === 'aucune' ? undefined : 'gauche' })); onFiger(c.champ, n); }}
                        className={`inline-flex h-6 w-6 flex-none items-center justify-center rounded-xs hover:bg-surface ${cote ? 'text-brand-text' : 'text-ink-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}>
                  <Icon name="pin" size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="p-2 border-t border-line-soft bg-sunken flex gap-2">
        <Button size="sm" icon="eye" onClick={toutAfficher} className="flex-1">Tout afficher</Button>
        <Button size="sm" icon="refresh" onClick={() => { onReinitialiser(); onFermer(); }} className="flex-1" title="Rétablir la disposition par défaut">
          Par défaut
        </Button>
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
                    className="w-full text-left px-3 py-1.5 hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 text-ink">
              <span className="w-4 inline-flex justify-center text-brand-text">{e.actif ? <Icon name="check" size={14} /> : null}</span>{e.libelle}
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
