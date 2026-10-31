import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import { Icon, TONE_VARS, type IconName } from './Icon';
import { IconButton } from './Button';

type ToastType = 'success' | 'error' | 'info' | 'warning';
type ToastOptions = { title?: string; duration?: number | 'persistent'; action?: { label: string; onClick: () => void } };
type Toast = { id: number; type: ToastType; message: string } & ToastOptions;

type ToastApi = {
  success: (message: string, o?: ToastOptions) => void;
  error: (message: string, o?: ToastOptions) => void;
  info: (message: string, o?: ToastOptions) => void;
  warning: (message: string, o?: ToastOptions) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Feedback global non bloquant (coin bas-droit) — annoncé aux lecteurs d'écran. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>');
  return ctx;
}

const STYLE: Record<ToastType, { tone: 'success' | 'danger' | 'info' | 'warning'; icon: IconName; title: string; duree: number }> = {
  success: { tone: 'success', icon: 'checkCircle', title: 'Succès', duree: 3500 },
  info: { tone: 'info', icon: 'info', title: 'Information', duree: 4500 },
  warning: { tone: 'warning', icon: 'alert', title: 'Attention', duree: 7000 },
  // Les erreurs restent le temps de lire la cause (fermeture manuelle ou 12 s).
  error: { tone: 'danger', icon: 'alertCircle', title: 'Erreur', duree: 12000 },
};

const MAX = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(1);
  const timers = useRef(new Map<number, number>());

  const remove = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const arm = useCallback((t: Toast) => {
    if (t.duration === 'persistent') return;
    const ms = typeof t.duration === 'number' ? t.duration : STYLE[t.type].duree;
    timers.current.set(t.id, window.setTimeout(() => remove(t.id), ms));
  }, [remove]);

  const push = useCallback((type: ToastType, message: string, o?: ToastOptions) => {
    const t: Toast = { id: seq.current++, type, message, ...o };
    setToasts((list) => [...list, t].slice(-MAX));
    arm(t);
  }, [arm]);

  const api = useRef<ToastApi>({
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', m, o),
    info: (m, o) => push('info', m, o),
    warning: (m, o) => push('warning', m, o),
  });

  // Survol : le minuteur est suspendu (le temps de lire), puis relancé
  const pause = (id: number) => { window.clearTimeout(timers.current.get(id)); };
  const reprendre = (t: Toast) => { pause(t.id); arm(t); };

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      <div role="region" aria-label="Notifications"
           className="fixed bottom-4 right-4 z-toast flex flex-col gap-2 pointer-events-none" style={{ width: 380, maxWidth: 'calc(100vw - 32px)' }}>
        {toasts.map((t) => {
          const s = STYLE[t.type];
          const tone = TONE_VARS[s.tone];
          return (
            <div key={t.id} role={t.type === 'error' ? 'alert' : 'status'} aria-live={t.type === 'error' ? 'assertive' : 'polite'}
                 onMouseEnter={() => pause(t.id)} onMouseLeave={() => reprendre(t)}
                 className="pointer-events-auto flex items-start gap-3 rounded-md bg-raised border border-line-soft shadow-lifted pl-3 pr-1.5 py-2.5 animate-slide-in overflow-hidden relative">
              <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: tone.solid }} />
              <span className="mt-0.5 ml-1" style={{ color: tone.text }}><Icon name={s.icon} size={18} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-ink">{t.title ?? s.title}</div>
                <div className="text-sm text-ink-label break-words">{t.message}</div>
                {t.action && (
                  <button type="button" onClick={() => { t.action!.onClick(); remove(t.id); }}
                          className="mt-1 text-sm font-bold text-brand-text hover:underline">{t.action.label}</button>
                )}
              </div>
              <IconButton icon="close" label="Fermer la notification" size="xs" onClick={() => remove(t.id)} />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
