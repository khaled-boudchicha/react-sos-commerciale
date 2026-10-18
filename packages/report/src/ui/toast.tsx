import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { configReport, type Notifier } from '../config';

/**
 * Notifications. Si l'hôte fournit `notifier` (configurerReport), c'est lui qui est utilisé ; sinon une pile
 * intégrée s'affiche en bas à droite (montée à la demande dans `document.body`, sans fournisseur à installer).
 */

type Type = 'success' | 'error' | 'info';
type Item = { id: number; type: Type; message: string };

let items: Item[] = [];
let seq = 1;
const ecouteurs = new Set<() => void>();
const emettre = () => ecouteurs.forEach((f) => f());
let hoteMonte = false;

function retirer(id: number) { items = items.filter((i) => i.id !== id); emettre(); }

function monterHote() {
  if (hoteMonte || typeof document === 'undefined') return;
  hoteMonte = true;
  const el = document.createElement('div');
  el.className = 'gcr-root';
  document.body.appendChild(el);
  createRoot(el).render(<Pile />);
}

function pousser(type: Type, message: string) {
  monterHote();
  const id = seq++;
  items = [...items, { id, type, message }];
  emettre();
  // les erreurs restent plus longtemps (le temps de lire la cause)
  window.setTimeout(() => retirer(id), type === 'error' ? 6000 : 3500);
}

const integre: Notifier = {
  success: (m) => pousser('success', m),
  error: (m) => pousser('error', m),
  info: (m) => pousser('info', m),
};

export function useToast(): Notifier {
  return configReport().notifier ?? integre;
}

const STYLE: Record<Type, { bg: string; icone: string }> = {
  success: { bg: 'var(--gcr-success)', icone: '✓' },
  error: { bg: 'var(--gcr-danger)', icone: '⚠' },
  info: { bg: 'var(--gcr-brand-700)', icone: 'ℹ' },
};

function Pile() {
  const liste = useSyncExternalStore((cb) => { ecouteurs.add(cb); return () => { ecouteurs.delete(cb); }; }, () => items, () => items);
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 380, zIndex: 2147483000 }}>
      {liste.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-start gap-2.5 rounded-md shadow-lifted px-3.5 py-2.5 text-[12.5px] font-semibold"
             style={{ background: STYLE[t.type].bg, color: '#fff' }} role={t.type === 'error' ? 'alert' : 'status'}>
          <span className="text-[13px] leading-5">{STYLE[t.type].icone}</span>
          <span className="flex-1 leading-5">{t.message}</span>
          <button onClick={() => retirer(t.id)} className="opacity-80 hover:opacity-100 leading-5" aria-label="Fermer">✕</button>
        </div>
      ))}
    </div>
  );
}
