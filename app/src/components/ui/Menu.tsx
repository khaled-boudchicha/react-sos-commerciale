import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, Kbd, type IconName } from './Icon';
import { Button, type ButtonProps } from './Button';
import { cn } from './cn';

export type MenuItem =
  | { label: ReactNode; icon?: IconName; kbd?: string; tone?: 'default' | 'danger'; disabled?: boolean; hint?: ReactNode; onSelect: () => void }
  | 'separator'
  | { heading: ReactNode };

/**
 * Menu déroulant accessible (role=menu) : ↑ ↓ Début Fin pour se déplacer, Entrée pour choisir,
 * Échap / clic extérieur pour fermer, focus rendu au bouton. Regroupe les actions secondaires.
 */
export function Menu({ label, items, icon = 'more', align = 'end', width = 240, variant = 'secondary', size = 'md', iconOnly, disabled }: {
  label: ReactNode;
  items: MenuItem[];
  icon?: IconName;
  align?: 'start' | 'end';
  width?: number;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  /** Bouton réduit à l'icône (le libellé devient le nom accessible). */
  iconOnly?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const actifs = () => [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [])];

  useEffect(() => {
    if (!open) return;
    actifs()[0]?.focus();
    const f = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', f);
    return () => window.removeEventListener('mousedown', f);
  }, [open]);

  function fermer() { setOpen(false); trigger.current?.focus(); }

  function onKey(e: React.KeyboardEvent) {
    const els = actifs();
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermer(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  }

  return (
    <div ref={root} className="relative inline-flex">
      <Button ref={trigger} variant={variant} size={size} disabled={disabled}
              icon={iconOnly ? icon : undefined} iconRight={iconOnly ? undefined : 'chevronDown'}
              aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
              aria-label={iconOnly && typeof label === 'string' ? label : undefined}
              title={iconOnly && typeof label === 'string' ? label : undefined}
              className={iconOnly ? '!px-0 w-[34px]' : undefined}
              onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}>
        {iconOnly ? undefined : label}
      </Button>
      {open && (
        <div ref={list} role="menu" onKeyDown={onKey}
             className={cn('absolute top-full mt-1 z-dropdown bg-raised border border-line-soft rounded-md shadow-lifted py-1 animate-pop-in',
               align === 'end' ? 'right-0' : 'left-0')}
             style={{ width }}>
          {items.map((it, i) => {
            if (it === 'separator') return <div key={i} role="separator" className="my-1 border-t border-line-soft" />;
            if ('heading' in it) return <div key={i} className="px-3 pt-2 pb-1 text-2xs font-bold uppercase tracking-wider text-ink-muted">{it.heading}</div>;
            return (
              <button key={i} type="button" role="menuitem" disabled={it.disabled}
                      onClick={() => { setOpen(false); it.onSelect(); }}
                      className={cn('w-full flex items-center gap-2.5 px-3 h-8 text-base text-left outline-none',
                        'hover:bg-hover focus:bg-hover disabled:opacity-50 disabled:cursor-not-allowed',
                        it.tone === 'danger' ? 'text-danger-text' : 'text-ink')}>
                {it.icon ? <Icon name={it.icon} size={16} className={it.tone === 'danger' ? '' : 'text-ink-muted'} /> : <span className="w-4" />}
                <span className="flex-1 truncate">{it.label}</span>
                {it.hint && <span className="text-xs text-ink-muted">{it.hint}</span>}
                {it.kbd && <Kbd>{it.kbd}</Kbd>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
