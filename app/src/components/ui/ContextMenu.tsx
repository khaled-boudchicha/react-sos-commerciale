import {
  forwardRef, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, Kbd, type IconName } from './Icon';
import { cn } from './cn';

/**
 * Menu contextuel / flottant (charte v2 §6) : positionné sur un point (clic droit) ou sur le rectangle d'un
 * bouton (menu déroulant), maintenu dans la fenêtre, `role="menu"`, clavier complet (↑ ↓ Début Fin Entrée Échap,
 * une lettre = saut au libellé suivant qui commence par elle), fermeture au clic extérieur, au défilement, au
 * redimensionnement et à la perte de focus de la fenêtre, focus rendu à l'élément d'origine.
 *
 * `MenuList` est le rendu unique des listes de menus : `Menu` (déroulant attaché à un bouton) l'utilise aussi.
 */

export type ContextMenuItem =
  | {
    label: ReactNode;
    icon?: IconName;
    /** Raccourci affiché à droite (« Ctrl+F1 »). */
    kbd?: string;
    /** Texte secondaire discret à droite (compteur, valeur courante…). */
    hint?: ReactNode;
    tone?: 'default' | 'danger';
    disabled?: boolean;
    /** Case cochée (true / false) ; absent = simple commande (menuitemcheckbox / menuitemradio). */
    checked?: boolean;
    /** Avec `checked` : choix exclusif (bouton radio). */
    radio?: boolean;
    /** Le menu reste ouvert après le choix (cases à cocher multiples). */
    keepOpen?: boolean;
    onSelect: () => void;
  }
  | 'separator'
  | { heading: ReactNode };

/** Point (clic droit) ou rectangle d'un bouton (menu sous le bouton). */
export type ContextMenuAnchor = { x: number; y: number } | DOMRect;

type Box = { left: number; top: number; right: number; bottom: number };
const estRect = (a: ContextMenuAnchor): a is DOMRect => 'width' in a;

// ─── Logique pure (testée dans __tests__/menus.test.ts) ─────────────────────

/**
 * Position d'un menu : au point du clic, ou sous le bouton (aligné à gauche `start` ou à droite `end`),
 * ramenée dans la fenêtre horizontalement et retournée au-dessus quand la place manque en bas.
 */
export function placeMenu(
  anchor: { x: number; y: number } | Box,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  align: 'start' | 'end' = 'start',
  margin = 8,
  gap = 4,
): { left: number; top: number } {
  const rect = 'right' in anchor ? anchor : null;
  const pt = rect ? null : (anchor as { x: number; y: number });
  let left = rect ? (align === 'end' ? rect.right - size.width : rect.left) : pt!.x;
  let top = rect ? rect.bottom + gap : pt!.y;
  left = Math.max(margin, Math.min(left, viewport.width - size.width - margin));
  if (top + size.height > viewport.height - margin) top = Math.max(margin, (rect ? rect.top - gap : top) - size.height);
  return { left, top };
}

/** Libellé ramené à une forme comparable : minuscules, sans accents ni espaces de tête. */
export const normaliserLibelle = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Saut par lettre : index du prochain libellé (après `current`, en boucle) qui commence par `char` ;
 * -1 si aucun. Les libellés vides (désactivés retirés en amont) sont ignorés.
 */
export function nextByLetter(labels: readonly string[], current: number, char: string): number {
  const c = normaliserLibelle(char);
  if (!c) return -1;
  for (let k = 1; k <= labels.length; k++) {
    const i = (current + k + labels.length) % labels.length;
    if (normaliserLibelle(labels[i]).startsWith(c)) return i;
  }
  return -1;
}

// ─── Liste (rendu commun à Menu et ContextMenu) ─────────────────────────────

export type MenuCloseReason = 'select' | 'escape' | 'tab';

type MenuListProps = {
  items: ContextMenuItem[];
  /** Fermeture demandée : choix d'un élément, Échap ou Tab. */
  onClose: (reason: MenuCloseReason) => void;
  label?: string;
  /** Tab : `true` empêche la tabulation native (le conteneur rend le focus), `false` la laisse se faire. */
  trapTab?: boolean;
  className?: string;
  style?: CSSProperties;
};

const ITEMS_SELECTOR = '[role^="menuitem"]:not([disabled])';

export const MenuList = forwardRef<HTMLDivElement, MenuListProps>(function MenuList(
  { items, onClose, label, trapTab, className, style },
  ref,
) {
  const local = useRef<HTMLDivElement | null>(null);
  const actifs = () => [...(local.current?.querySelectorAll<HTMLButtonElement>(ITEMS_SELECTOR) ?? [])];

  // Le premier élément actif reçoit le focus à l'ouverture
  useEffect(() => { actifs()[0]?.focus({ preventScroll: true }); }, []);

  function onKey(e: ReactKeyboardEvent) {
    const els = actifs();
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    const aller = (j: number) => { e.preventDefault(); els[j]?.focus({ preventScroll: true }); };
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose('escape'); }
    else if (e.key === 'ArrowDown') aller((i + 1) % els.length);
    else if (e.key === 'ArrowUp') aller((i - 1 + els.length) % els.length);
    else if (e.key === 'Home') aller(0);
    else if (e.key === 'End') aller(els.length - 1);
    else if (e.key === 'Tab') { if (trapTab) e.preventDefault(); onClose('tab'); }
    else if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const libelles = els.map((b) => b.querySelector('[data-menu-label]')?.textContent ?? b.textContent ?? '');
      const j = nextByLetter(libelles, i, e.key);
      if (j >= 0) aller(j);
    }
  }

  return (
    <div ref={(el) => { local.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; }}
         role="menu" aria-label={label} onKeyDown={onKey} onContextMenu={(e) => e.preventDefault()}
         className={cn('bg-raised border border-line-soft rounded-md shadow-lifted py-1 animate-pop-in', className)} style={style}>
      {items.map((it, i) => {
        if (it === 'separator') return <div key={i} role="separator" className="my-1 border-t border-line-soft" />;
        if ('heading' in it) {
          return <div key={i} role="presentation" className="px-3 pt-2 pb-1 text-2xs font-bold uppercase tracking-wider text-ink-muted">{it.heading}</div>;
        }
        const role = it.checked === undefined ? 'menuitem' : it.radio ? 'menuitemradio' : 'menuitemcheckbox';
        const danger = it.tone === 'danger';
        return (
          <button key={i} type="button" role={role} aria-checked={it.checked} disabled={it.disabled}
                  onClick={() => { if (!it.keepOpen) onClose('select'); it.onSelect(); }}
                  className={cn('w-full flex items-center gap-2.5 px-3 h-8 text-base text-left outline-none',
                    'hover:bg-hover focus:bg-hover disabled:opacity-50 disabled:cursor-not-allowed',
                    danger ? 'text-danger-text' : 'text-ink')}>
            {it.checked !== undefined
              ? (
                <span aria-hidden="true" className={cn('w-4 h-4 inline-flex items-center justify-center flex-none rounded-xs border',
                  it.radio && 'rounded-full',
                  it.checked ? 'bg-brand-700 border-transparent text-ink-inverse' : 'border-line-strong')}>
                  {it.checked && (it.radio
                    ? <span className="w-1.5 h-1.5 rounded-full bg-ink-inverse" />
                    : <Icon name="check" size={12} strokeWidth={3} />)}
                </span>
              )
              : it.icon
                ? <Icon name={it.icon} size={16} className={danger ? '' : 'text-ink-muted'} />
                : <span className="w-4 flex-none" />}
            <span data-menu-label="" className="flex-1 truncate">{it.label}</span>
            {it.hint && <span className="text-xs text-ink-muted">{it.hint}</span>}
            {it.kbd && <Kbd>{it.kbd}</Kbd>}
          </button>
        );
      })}
    </div>
  );
});

// ─── Menu flottant ──────────────────────────────────────────────────────────

export type ContextMenuProps = {
  anchor: ContextMenuAnchor;
  items: ContextMenuItem[];
  onClose: () => void;
  /** Nom accessible du menu. */
  label: string;
  width?: number;
  /** Sous un bouton : aligné sur son bord gauche (start) ou droit (end). */
  align?: 'start' | 'end';
  /** Bouton qui ouvre le menu : un clic dessus ne compte pas comme « extérieur » (il bascule le menu). */
  trigger?: HTMLElement | null;
  /**
   * Rendu dans un portail sur `document.body` (défaut). `false` le garde dans l'arbre DOM du parent
   * (utile quand le parent traite les clics « extérieurs » à son propre conteneur, comme le ruban).
   */
  portal?: boolean;
};

export function ContextMenu({ anchor, items, onClose, label, width = 260, align = 'start', trigger, portal = true }: ContextMenuProps) {
  const liste = useRef<HTMLDivElement>(null);
  const precedent = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const fermer = useRef(onClose);
  fermer.current = onClose;

  useLayoutEffect(() => {
    const el = liste.current;
    if (!el) return;
    const a = estRect(anchor) ? { left: anchor.left, top: anchor.top, right: anchor.right, bottom: anchor.bottom } : anchor;
    setPos(placeMenu(a, { width, height: el.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }, align));
  }, [anchor, align, width]);

  useEffect(() => {
    const dehors = (e: MouseEvent) => {
      const cible = e.target as Node;
      if (!liste.current?.contains(cible) && !trigger?.contains(cible)) fermer.current();
    };
    const defile = (e: Event) => { if (!liste.current?.contains(e.target as Node)) fermer.current(); };
    const ferme = () => fermer.current();
    window.addEventListener('mousedown', dehors, true);
    window.addEventListener('scroll', defile, true);
    window.addEventListener('resize', ferme);
    window.addEventListener('blur', ferme);
    return () => {
      window.removeEventListener('mousedown', dehors, true);
      window.removeEventListener('scroll', defile, true);
      window.removeEventListener('resize', ferme);
      window.removeEventListener('blur', ferme);
    };
  }, [trigger]);

  const onListClose = () => {
    fermer.current();
    (precedent.current as HTMLElement | null)?.focus?.({ preventScroll: true });
  };

  const menu = (
    <MenuList ref={liste} items={items} label={label} trapTab onClose={onListClose}
              className="fixed z-popover" style={{ width, left: pos?.left ?? -9999, top: pos?.top ?? -9999 }} />
  );
  return portal && typeof document !== 'undefined' ? createPortal(menu, document.body) : menu;
}

export default ContextMenu;
