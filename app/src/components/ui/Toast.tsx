import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';
type Toast = { id: number; type: ToastType; message: string };

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Feedback global non bloquant (coin bas-droit, auto-effacement). */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>');
  return ctx;
}

const STYLE: Record<ToastType, { bg: string; fg: string; icon: string }> = {
  success: { bg: 'var(--success)', fg: '#fff', icon: '✓' },
  error:   { bg: 'var(--danger)',  fg: '#fff', icon: '⚠' },
  info:    { bg: 'var(--brand-700)', fg: '#fff', icon: 'ℹ' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(1);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type: ToastType, message: string) => {
    const id = seq.current++;
    setToasts((list) => [...list, { id, type, message }]);
    // Les erreurs restent plus longtemps (le temps de lire la cause).
    window.setTimeout(() => remove(id), type === 'error' ? 6000 : 3500);
  }, [remove]);

  const api = useRef<ToastApi>({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  });

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 380 }}>
        {toasts.map((t) => {
          const s = STYLE[t.type];
          return (
            <div key={t.id}
                 className="pointer-events-auto flex items-start gap-2.5 rounded-md shadow-lifted px-3.5 py-2.5 text-[12.5px] font-semibold"
                 style={{ background: s.bg, color: s.fg }}>
              <span className="text-[13px] leading-5">{s.icon}</span>
              <span className="flex-1 leading-5">{t.message}</span>
              <button onClick={() => remove(t.id)} className="opacity-80 hover:opacity-100 leading-5" aria-label="Fermer">✕</button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
