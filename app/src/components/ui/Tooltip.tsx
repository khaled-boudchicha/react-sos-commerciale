import {
  Fragment, cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type FocusEvent, type MouseEvent as ReactMouseEvent, type ReactElement, type ReactNode, type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { Kbd } from './Icon';
import { cn } from './cn';

/**
 * Info-bulle accessible (charte v2 §6) : apparaît au survol après un court délai (~450 ms) et immédiatement au
 * focus clavier, disparaît à la sortie, au clic, au défilement ou à Échap. `role="tooltip"` relié à l'élément par
 * `aria-describedby`, position haut / bas choisie automatiquement et maintenue dans la fenêtre, portail sur
 * `document.body`, couche `z-tooltip`. Contenu riche : titre, description, raccourci (`kbd`).
 *
 * `<Tooltip content="Imprimer" kbd="Ctrl+P"><button …/></Tooltip>` — l'enfant unique est cloné pour brancher
 * les gestionnaires et la ref (un composant enfant doit transmettre sa ref, comme `Button`).
 *
 * `TooltipBubble` est le rendu seul (positionné sur un rectangle), pour les déclencheurs qui gèrent eux-mêmes
 * l'apparition (info-bulles détaillées du ruban).
 */

export type TooltipSide = 'top' | 'bottom';
type Box = { left: number; top: number; right: number; bottom: number };

// ─── Logique pure (testée dans __tests__/menus.test.ts) ─────────────────────

/**
 * Position d'une info-bulle : du côté demandé s'il y a la place, sinon de l'autre ; centrée sur l'élément
 * (`center`) ou alignée sur son bord gauche (`start`), toujours maintenue dans la fenêtre.
 */
export function placeTooltip(
  anchor: Box,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  side: TooltipSide = 'top',
  align: 'center' | 'start' = 'center',
  gap = 6,
  margin = 8,
): { left: number; top: number; side: TooltipSide } {
  const enHaut = anchor.top - gap - size.height;
  const enBas = anchor.bottom + gap;
  const tientHaut = enHaut >= margin;
  const tientBas = enBas + size.height <= viewport.height - margin;
  let cote: TooltipSide = side;
  if (side === 'top' && !tientHaut && tientBas) cote = 'bottom';
  else if (side === 'bottom' && !tientBas && tientHaut) cote = 'top';
  let top = cote === 'top' ? enHaut : enBas;
  top = Math.max(margin, Math.min(top, viewport.height - size.height - margin));
  const brut = align === 'start' ? anchor.left : anchor.left + (anchor.right - anchor.left) / 2 - size.width / 2;
  const left = Math.max(margin, Math.min(brut, viewport.width - size.width - margin));
  return { left, top, side: cote };
}

/** « Ctrl+Maj+S » → ['Ctrl', 'Maj', 'S'] ; « Ctrl++ » → ['Ctrl', '+']. */
export const touchesRaccourci = (kbd: string) => kbd.split(/\+(?=.)/).filter(Boolean);

// ─── Rendu ──────────────────────────────────────────────────────────────────

export type TooltipContentProps = {
  /** Titre (ou texte unique) de l'info-bulle. */
  content: ReactNode;
  /** Texte d'aide sous le titre (info-bulle riche). */
  description?: ReactNode;
  /** Raccourci clavier affiché à droite du titre (« Ctrl+K »). */
  kbd?: string;
  /** Élément devant le titre (pastille d'icône des info-bulles du ruban). */
  leading?: ReactNode;
  /** Largeur fixe (info-bulle riche) ; sinon ajustée au contenu (max 280 px). */
  width?: number;
};

export function TooltipBubble({ anchor, side = 'top', align = 'center', id, content, description, kbd, leading, width }: TooltipContentProps & {
  /** Rectangle de l'élément décrit (getBoundingClientRect). */
  anchor: Box;
  side?: TooltipSide;
  align?: 'center' | 'start';
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const riche = !!(description || leading || width);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos(placeTooltip(anchor, { width: el.offsetWidth, height: el.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight }, side, align));
  }, [anchor, side, align]);

  const bulle = (
    <div ref={ref} id={id} role="tooltip"
         className={cn('fixed z-tooltip bg-raised border border-line-soft shadow-lifted pointer-events-none animate-fade-in',
           riche ? 'rounded-md p-3' : 'rounded-sm px-2 py-1 max-w-[280px]')}
         style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width }}>
      <div className="flex items-center gap-2">
        {leading}
        <span className={cn('text-ink', riche ? 'text-sm font-bold truncate' : 'text-xs font-semibold')}>{content}</span>
        {kbd && (
          <span className="ml-auto flex items-center gap-0.5 flex-none">
            {touchesRaccourci(kbd).map((k, i) => <Kbd key={i}>{k}</Kbd>)}
          </span>
        )}
      </div>
      {description && <p className="mt-1.5 text-xs text-ink-label">{description}</p>}
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(bulle, document.body) : bulle;
}

// ─── Déclencheur ────────────────────────────────────────────────────────────

type ChildProps = {
  ref?: Ref<HTMLElement>;
  onMouseEnter?: (e: ReactMouseEvent<HTMLElement>) => void;
  onMouseLeave?: (e: ReactMouseEvent<HTMLElement>) => void;
  onMouseDown?: (e: ReactMouseEvent<HTMLElement>) => void;
  onFocus?: (e: FocusEvent<HTMLElement>) => void;
  onBlur?: (e: FocusEvent<HTMLElement>) => void;
  'aria-describedby'?: string;
};

function assigner<T>(ref: Ref<T> | undefined, v: T | null) {
  if (typeof ref === 'function') ref(v);
  else if (ref && typeof ref === 'object') (ref as { current: T | null }).current = v;
}

const focusClavier = (el: HTMLElement) => { try { return el.matches(':focus-visible'); } catch { return true; } };

export function Tooltip({ children, side = 'top', align = 'center', delay = 450, disabled, describe = true, ...contenu }: TooltipContentProps & {
  children: ReactElement;
  side?: TooltipSide;
  align?: 'center' | 'start';
  /** Délai d'apparition au survol, en ms (le focus clavier est immédiat). */
  delay?: number;
  disabled?: boolean;
  /** Relie l'info-bulle par `aria-describedby` (à couper quand elle répète déjà le nom accessible). */
  describe?: boolean;
}) {
  const id = useId();
  const cible = useRef<HTMLElement | null>(null);
  const minuterie = useRef<number>();
  const [rect, setRect] = useState<Box | null>(null);

  const montrer = useCallback(() => {
    const el = cible.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  }, []);
  const cacher = useCallback(() => { window.clearTimeout(minuterie.current); setRect(null); }, []);

  useEffect(() => () => window.clearTimeout(minuterie.current), []);
  useEffect(() => { if (disabled) cacher(); }, [disabled, cacher]);

  // Visible : Échap, défilement et redimensionnement la masquent
  useEffect(() => {
    if (!rect) return;
    const touche = (e: KeyboardEvent) => { if (e.key === 'Escape') cacher(); };
    window.addEventListener('keydown', touche, true);
    window.addEventListener('scroll', cacher, true);
    window.addEventListener('resize', cacher);
    return () => {
      window.removeEventListener('keydown', touche, true);
      window.removeEventListener('scroll', cacher, true);
      window.removeEventListener('resize', cacher);
    };
  }, [rect, cacher]);

  if (!isValidElement(children)) return children;
  const enfant = children as ReactElement<ChildProps> & { ref?: Ref<HTMLElement> };
  const p = enfant.props;
  const visible = !!rect && !disabled;

  const clone = cloneElement(enfant, {
    ref: (el: HTMLElement | null) => { cible.current = el; assigner(enfant.ref, el); },
    onMouseEnter: (e: ReactMouseEvent<HTMLElement>) => {
      p.onMouseEnter?.(e);
      if (disabled) return;
      window.clearTimeout(minuterie.current);
      minuterie.current = window.setTimeout(montrer, delay);
    },
    onMouseLeave: (e: ReactMouseEvent<HTMLElement>) => { p.onMouseLeave?.(e); cacher(); },
    onMouseDown: (e: ReactMouseEvent<HTMLElement>) => { p.onMouseDown?.(e); cacher(); },
    onFocus: (e: FocusEvent<HTMLElement>) => { p.onFocus?.(e); if (!disabled && focusClavier(e.currentTarget)) montrer(); },
    onBlur: (e: FocusEvent<HTMLElement>) => { p.onBlur?.(e); cacher(); },
    'aria-describedby': visible && describe ? [p['aria-describedby'], id].filter(Boolean).join(' ') : p['aria-describedby'],
  });

  return (
    <Fragment>
      {clone}
      {visible && rect && <TooltipBubble anchor={rect} side={side} align={align} id={id} {...contenu} />}
    </Fragment>
  );
}

export default Tooltip;
