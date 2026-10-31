import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Kbd, IconBadge, type IconName, type Tone } from './Icon';
import { Button, IconButton, type ButtonVariant } from './Button';
import { cn } from './cn';

/**
 * Coquille modale UNIQUE de l'application (charte v2 §4.5) — équivalent TcxDialog / TForm modal :
 * voile thémé, titre + sous-titre, corps défilant, pied d'actions surélevé, piège de focus,
 * Échap pour fermer, focus restauré sur l'élément d'origine à la fermeture.
 * ConfirmDialog, FormModal et toutes les modales métier s'appuient dessus.
 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
const SIZE_PX: Record<Exclude<ModalSize, 'full'>, number> = { sm: 420, md: 560, lg: 720, xl: 920 };

export type ModalProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Contenu aligné à gauche dans le pied (aide, raccourcis). */
  footerStart?: ReactNode;
  onClose: () => void;
  /** Largeur en px (historique) ou taille nommée. */
  width?: number;
  size?: ModalSize;
  closeOnEscape?: boolean;
  /** Un clic sur le voile ferme la fenêtre (défaut : oui ; à désactiver pour une saisie). */
  closeOnOverlay?: boolean;
  /** Élément focalisé à l'ouverture (défaut : premier champ). */
  initialFocus?: RefObject<HTMLElement>;
  icon?: IconName;
  iconTone?: Tone;
  /** Corps sans marge (tableaux pleine largeur). */
  flush?: boolean;
};

export default function Dialog({
  title, subtitle, children, footer, footerStart, onClose, width, size = 'md', closeOnEscape = true, closeOnOverlay = true,
  initialFocus, icon, iconTone = 'brand', flush,
}: ModalProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const titreId = useRef(`dlg-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    const box = boxRef.current;
    // Focus initial demandé, sinon premier champ focusable, sauf si un enfant a déjà pris le focus (autoFocus)
    if (initialFocus?.current) initialFocus.current.focus();
    else if (box && !box.contains(document.activeElement)) (focusables(box).find((el) => !el.dataset.dialogClose) ?? box).focus();
    return () => { precedent?.focus?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && closeOnEscape) { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab' || !boxRef.current) return;
    const els = focusables(boxRef.current);
    if (els.length === 0) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  const maxWidth = size === 'full' ? undefined : width ?? SIZE_PX[size];

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-fade-in" style={{ background: 'var(--overlay)' }}
         onMouseDown={(e) => { if (closeOnOverlay && e.target === e.currentTarget) onClose(); }}>
      <div ref={boxRef} role="dialog" aria-modal="true" aria-labelledby={titreId} onKeyDown={onKeyDown} tabIndex={-1}
           className={cn('bg-raised w-full flex flex-col overflow-hidden rounded-lg shadow-modal border border-line-soft outline-none animate-pop-in',
             size === 'full' ? 'h-full max-h-full' : 'max-h-[92vh]')}
           style={{ maxWidth }}>
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-line-soft">
          <div className="flex items-start gap-3 min-w-0">
            {icon && <IconBadge name={icon} tone={iconTone} size="md" />}
            <div className="flex flex-col gap-0.5 min-w-0">
              <h2 id={titreId} className="m-0 text-xl font-extrabold text-ink truncate">{title}</h2>
              {subtitle && <span className="text-sm font-semibold text-ink-muted">{subtitle}</span>}
            </div>
          </div>
          <IconButton icon="close" label="Fermer (Échap)" onClick={onClose} variant="ghost" data-dialog-close="1" />
        </div>
        <div className={cn('overflow-auto flex-1 min-h-0', !flush && 'px-6 pt-[18px] pb-5')}>{children}</div>
        {footer && (
          <div className="px-6 py-3.5 border-t border-line-soft flex items-center justify-end gap-2.5 bg-sunken">
            {footerStart && <div className="mr-auto flex items-center gap-2 text-xs text-ink-muted">{footerStart}</div>}
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Nom moderne de la coquille modale. */
export { Dialog as Modal };

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(
    'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
  )].filter((el) => el.tabIndex !== -1 && el.offsetParent !== null);
}

/** Boutons de pied standard (48 px — maquette comptoir) : enveloppe de `Button size="xl"`. */
export function DialogButton({ children, onClick, kind = 'secondary', disabled, kbd }: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'cash' | 'secondary' | 'danger' | 'return';
  disabled?: boolean; kbd?: string;
}) {
  const variant: Record<typeof kind, ButtonVariant> = {
    primary: 'primary', cash: 'success', secondary: 'secondary', danger: 'danger-solid', return: 'primary',
  };
  return (
    <Button size="xl" variant={variant[kind]} onClick={onClick} disabled={disabled} kbd={kbd}
            className={cn(kind !== 'secondary' && 'text-md font-extrabold', kind === 'return' && '!bg-[var(--pos-return)] hover:!bg-[var(--pos-return-deep)]')}>
      {children}
    </Button>
  );
}

/** Aide clavier compacte pour les pieds de modale (« Entrée valider · Échap fermer »). */
export function KeyHints({ items }: { items: [string, string][] }) {
  return (
    <span className="inline-flex items-center gap-3">
      {items.map(([k, l]) => <span key={k} className="inline-flex items-center gap-1"><Kbd>{k}</Kbd>{l}</span>)}
    </span>
  );
}

