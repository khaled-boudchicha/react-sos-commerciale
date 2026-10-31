import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, Kbd, type IconName } from '../components/ui/Icon';
import { cn } from '../components/ui/cn';

/**
 * Menu flottant du ruban (menu contextuel, personnalisation de l'accès rapide, options d'affichage, compte).
 * Même rendu et même clavier que `components/ui/Menu` (↑ ↓ Début Fin, Entrée, Échap, clic extérieur, focus rendu),
 * mais positionné sur un point ou un rectangle quelconque : un clic droit n'a pas de bouton déclencheur.
 * Cases à cocher (`coche`) et boutons radio (`radio`) annoncés comme tels (menuitemcheckbox / menuitemradio).
 */

export type ElementMenu =
  | {
    libelle: ReactNode;
    icone?: IconName;
    kbd?: string;
    ton?: 'default' | 'danger';
    desactive?: boolean;
    /** Case cochée (true / false) ; absent = simple commande. */
    coche?: boolean;
    /** Avec `coche` : choix exclusif (bouton radio). */
    radio?: boolean;
    /** Le menu reste ouvert après le choix (cases à cocher multiples). */
    garderOuvert?: boolean;
    onSelect: () => void;
  }
  | 'separateur'
  | { titre: ReactNode };

/** Point (clic droit) ou rectangle d'un bouton (menu déroulant sous le bouton). */
export type Ancre = { x: number; y: number } | DOMRect;

export default function MenuFlottant({ ancre, elements, onClose, label, largeur = 260, aligner = 'start', declencheur }: {
  ancre: Ancre;
  elements: ElementMenu[];
  onClose: () => void;
  label: string;
  largeur?: number;
  /** Sous un bouton : aligné sur son bord gauche (start) ou droit (end). */
  aligner?: 'start' | 'end';
  /** Bouton qui ouvre le menu : un clic dessus le referme (bascule) au lieu de le rouvrir. */
  declencheur?: HTMLElement | null;
}) {
  const liste = useRef<HTMLDivElement>(null);
  const precedent = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const actifs = () => [...(liste.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not([disabled])') ?? [])];

  // Position : sous le bouton ou au point du clic, ramenée dans la fenêtre (retournée vers le haut si besoin)
  useLayoutEffect(() => {
    const el = liste.current;
    if (!el) return;
    const rect = 'width' in ancre ? ancre : null;
    const h = el.offsetHeight;
    let left = rect ? (aligner === 'end' ? rect.right - largeur : rect.left) : ancre.x;
    let top = rect ? rect.bottom + 4 : ancre.y;
    left = Math.max(8, Math.min(left, window.innerWidth - largeur - 8));
    if (top + h > window.innerHeight - 8) top = Math.max(8, (rect ? rect.top - 4 : top) - h);
    setPos({ left, top });
  }, [ancre, aligner, largeur]);

  useEffect(() => {
    actifs()[0]?.focus();
    const dehors = (e: MouseEvent) => {
      const cible = e.target as Node;
      if (!liste.current?.contains(cible) && !declencheur?.contains(cible)) onClose();
    };
    const fermer = () => onClose();
    window.addEventListener('mousedown', dehors, true);
    window.addEventListener('resize', fermer);
    window.addEventListener('blur', fermer);
    return () => {
      window.removeEventListener('mousedown', dehors, true);
      window.removeEventListener('resize', fermer);
      window.removeEventListener('blur', fermer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fermerEtRendre() {
    onClose();
    (precedent.current as HTMLElement | null)?.focus?.();
  }

  function onKey(e: React.KeyboardEvent) {
    const els = actifs();
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermerEtRendre(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
    else if (e.key === 'Tab') { e.preventDefault(); fermerEtRendre(); }
  }

  return (
    <div ref={liste} role="menu" aria-label={label} onKeyDown={onKey} onContextMenu={(e) => e.preventDefault()}
         className="fixed z-popover bg-raised border border-line-soft rounded-md shadow-lifted py-1 animate-pop-in"
         style={{ width: largeur, left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}>
      {elements.map((it, i) => {
        if (it === 'separateur') return <div key={i} role="separator" className="my-1 border-t border-line-soft" />;
        if ('titre' in it) return <div key={i} role="presentation" className="px-3 pt-2 pb-1 text-2xs font-bold uppercase tracking-wider text-ink-muted">{it.titre}</div>;
        const role = it.coche === undefined ? 'menuitem' : it.radio ? 'menuitemradio' : 'menuitemcheckbox';
        return (
          <button key={i} type="button" role={role} aria-checked={it.coche} disabled={it.desactive}
                  onClick={() => { if (!it.garderOuvert) fermerEtRendre(); it.onSelect(); }}
                  className={cn('w-full flex items-center gap-2.5 px-3 h-8 text-base text-left outline-none',
                    'hover:bg-hover focus:bg-hover disabled:opacity-50 disabled:cursor-not-allowed',
                    it.ton === 'danger' ? 'text-danger-text' : 'text-ink')}>
            {it.coche !== undefined
              ? <span className={cn('w-4 h-4 inline-flex items-center justify-center flex-none rounded-xs border',
                  it.radio && 'rounded-full',
                  it.coche ? 'bg-brand-700 border-transparent text-ink-inverse' : 'border-line-strong')}>
                  {it.coche && (it.radio ? <span className="w-1.5 h-1.5 rounded-full bg-ink-inverse" /> : <Icon name="check" size={12} strokeWidth={3} />)}
                </span>
              : it.icone ? <Icon name={it.icone} size={16} className={it.ton === 'danger' ? '' : 'text-ink-muted'} /> : <span className="w-4 flex-none" />}
            <span className="flex-1 truncate">{it.libelle}</span>
            {it.kbd && <Kbd>{it.kbd}</Kbd>}
          </button>
        );
      })}
    </div>
  );
}
