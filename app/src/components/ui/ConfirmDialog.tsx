import { useRef, type ReactNode } from 'react';
import Dialog, { KeyHints } from './Dialog';
import { Button } from './Button';

/**
 * Confirmation (charte v2, principe « confirmer le destructif, jamais l'ordinaire ») :
 * - libellé de confirmation = verbe d'action (« Supprimer la pièce ») ;
 * - en mode `danger`, le focus initial va au bouton SÛR (Entrée n'efface rien par mégarde),
 *   le voile ne ferme pas la fenêtre et le bouton d'abandon s'appelle « Conserver » par défaut ;
 * - Échap = abandon, dans tous les cas.
 */
export default function ConfirmDialog({
  title, message, confirmLabel = 'Confirmer', cancelLabel, danger, loading, onConfirm, onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const sur = useRef<HTMLButtonElement>(null);
  const valider = useRef<HTMLButtonElement>(null);
  return (
    <Dialog title={title} onClose={() => { if (!loading) onCancel(); }} size="sm"
            icon={danger ? 'alert' : 'info'} iconTone={danger ? 'danger' : 'brand'}
            closeOnOverlay={!danger} initialFocus={danger ? sur : valider}
            footerStart={<KeyHints items={[['Échap', 'annuler']]} />}
            footer={(
              <>
                <Button ref={sur} onClick={onCancel} disabled={loading}>
                  {cancelLabel ?? (danger ? 'Conserver' : 'Annuler')}
                </Button>
                <Button ref={valider} variant={danger ? 'danger-solid' : 'primary'} onClick={onConfirm} loading={loading}>
                  {confirmLabel}
                </Button>
              </>
            )}>
      <div className="text-base text-ink-label">{message}</div>
    </Dialog>
  );
}
