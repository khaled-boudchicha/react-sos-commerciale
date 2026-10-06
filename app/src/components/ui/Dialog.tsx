import { ReactNode, useEffect, useRef } from 'react';
import { Kbd } from './Icon';

/**
 * Coquille de dialogue modale réutilisable (équivalent TcxDialog / TForm modal) :
 * overlay, titre, corps, pied d'actions, piège de focus, Échap pour fermer,
 * focus restauré sur l'élément d'origine à la fermeture. Gabarit de la maquette
 * « Vente au comptoir » (rayon 16, en-tête 20/24, pied surélevé 14/24).
 */
export default function Dialog({
  title, subtitle, children, footer, onClose, width = 560, closeOnEscape = true,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: number;
  closeOnEscape?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const titreId = useRef(`dlg-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    const box = boxRef.current;
    // Premier champ focusable, sauf si un enfant a déjà pris le focus (autoFocus)
    if (box && !box.contains(document.activeElement)) focusables(box)[0]?.focus();
    return () => { precedent?.focus?.(); };
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--pos-overlay)' }}
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={boxRef} role="dialog" aria-modal="true" aria-labelledby={titreId} onKeyDown={onKeyDown}
           className="bg-surface w-full max-h-[92vh] flex flex-col overflow-hidden"
           style={{ maxWidth: width, borderRadius: 16, boxShadow: '0 24px 64px rgb(8 20 40 / .35)' }}>
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3.5 border-b border-line-soft">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h2 id={titreId} className="m-0 text-[18px] font-extrabold text-ink truncate">{title}</h2>
            {subtitle && <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{subtitle}</span>}
          </div>
          <button onClick={onClose} aria-label="Fermer" tabIndex={-1}
                  className="w-9 h-9 flex-none rounded-[9px] bg-bg text-ink-label text-[16px] font-extrabold hover:bg-line-soft">✕</button>
        </div>
        <div className="px-6 pt-[18px] pb-5 overflow-auto">{children}</div>
        {footer && (
          <div className="px-6 py-3.5 border-t border-line-soft flex justify-end gap-2.5" style={{ background: 'var(--surface-sunken)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(
    'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((el) => el.tabIndex !== -1 && el.offsetParent !== null);
}

/** Boutons de pied standard (48 px, rayon 11 — maquette). */
export function DialogButton({ children, onClick, kind = 'secondary', disabled, kbd }: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'cash' | 'secondary' | 'danger' | 'return';
  disabled?: boolean; kbd?: string;
}) {
  const plein = kind !== 'secondary';
  const bg = { primary: 'var(--brand-700)', cash: 'var(--pos-cash)', danger: 'var(--pos-alert)', return: 'var(--pos-return)', secondary: 'var(--surface)' }[kind];
  return (
    <button type="button" onClick={onClick} disabled={disabled}
            className={`h-12 rounded-[11px] inline-flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed ${plein ? 'px-[22px] text-[15px] font-extrabold text-white' : 'px-[18px] text-[14px] font-bold text-ink-label border border-line hover:border-brand-300'}`}
            style={{ background: bg }}>
      {children}
      {kbd && <Kbd tone={plein ? 'inverse' : 'line'}>{kbd}</Kbd>}
    </button>
  );
}
