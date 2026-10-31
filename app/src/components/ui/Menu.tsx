import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { IconName } from './Icon';
import { Button, type ButtonProps } from './Button';
import { MenuList, type MenuCloseReason } from './ContextMenu';
import { cn } from './cn';

export type MenuItem =
  | { label: ReactNode; icon?: IconName; kbd?: string; tone?: 'default' | 'danger'; disabled?: boolean; hint?: ReactNode; onSelect: () => void }
  | 'separator'
  | { heading: ReactNode };

/**
 * Menu déroulant accessible (role=menu) : ↑ ↓ Début Fin pour se déplacer, Entrée pour choisir,
 * une lettre pour sauter au libellé, Échap / clic extérieur pour fermer, focus rendu au bouton.
 * Regroupe les actions secondaires. La liste est rendue par `MenuList` (même rendu que `ContextMenu`).
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

  useEffect(() => {
    if (!open) return;
    const f = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', f);
    return () => window.removeEventListener('mousedown', f);
  }, [open]);

  function onClose(reason: MenuCloseReason) {
    setOpen(false);
    if (reason === 'escape') trigger.current?.focus();
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
        <MenuList items={items} onClose={onClose} label={typeof label === 'string' ? label : undefined}
                  className={cn('absolute top-full mt-1 z-dropdown', align === 'end' ? 'right-0' : 'left-0')}
                  style={{ width }} />
      )}
    </div>
  );
}
