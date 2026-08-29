import { useState } from 'react';
import { replierCategories } from './palette';

export type BarItem = { label: string; value: number };

/**
 * Barres horizontales (grandeurs comparées par catégorie). Chaque ligne est
 * directement étiquetée (label + valeur) → pas de légende. Le surplus au-delà de
 * `max` catégories est replié dans « Autres ». Survol : part en %.
 */
export default function BarChart({ data, format, max = 6 }: {
  data: BarItem[];
  format: (v: number) => string;
  max?: number;
}) {
  const items = replierCategories(data, max);
  const total = items.reduce((s, x) => s + x.value, 0) || 1;
  const haut = Math.max(1, ...items.map((x) => x.value));
  const [hover, setHover] = useState<number | null>(null);

  if (!items.length) return <div className="text-ink-muted text-[12px] py-4">Aucune donnée.</div>;

  return (
    <div className="flex flex-col gap-3">
      {items.map((it, i) => {
        const pct = (it.value / haut) * 100;
        const part = (it.value / total) * 100;
        return (
          <div key={it.label} className="flex items-center gap-3"
               onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className="w-[34%] shrink-0 text-[11.5px] font-semibold truncate" title={it.label}>{it.label}</div>
            <div className="flex-1 h-2 rounded-full overflow-hidden relative" style={{ background: 'var(--line-soft)' }}>
              <div className="h-full rounded-full transition-[width] duration-300"
                   style={{ width: `${pct}%`, background: it.couleur, opacity: hover == null || hover === i ? 1 : 0.5 }} />
            </div>
            <div className="w-[26%] shrink-0 text-right money text-[11.5px] tabular-nums">
              {hover === i
                ? <span className="text-ink-muted">{part.toFixed(1)} %</span>
                : <span className="font-semibold">{format(it.value)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
