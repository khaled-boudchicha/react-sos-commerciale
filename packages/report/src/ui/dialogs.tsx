import type { ReactNode } from 'react';

/** Confirmation modale (suppression, abandon de modifications…). */
export function ConfirmDialog({
  title, message, confirmLabel = 'Confirmer', danger, loading, onConfirm, onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgb(15 26 46 / .45)' }} onClick={onCancel} role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-[420px] max-w-[calc(100vw-32px)] bg-surface border border-line-soft rounded-lg shadow-lifted p-5" onClick={(e) => e.stopPropagation()}>
        <div className="font-extrabold text-[15px] mb-1.5">{title}</div>
        <div className="text-[12.5px] text-ink-label mb-4">{message}</div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} disabled={loading} className="px-4 py-2 rounded-md border border-line text-ink-label font-bold text-[12px] disabled:opacity-60">Annuler</button>
          <button onClick={onConfirm} disabled={loading} className="px-4 py-2 rounded-md font-bold text-[12px] text-white disabled:opacity-60"
                  style={{ background: danger ? 'var(--gcr-danger)' : 'var(--gcr-brand-700)' }}>
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
