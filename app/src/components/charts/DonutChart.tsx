import { useState } from 'react';
import { replierCategories } from './palette';

const SIZE = 168, R = 74, STROKE = 26, C = SIZE / 2;
const CIRC = 2 * Math.PI * R;

/**
 * Anneau (part du total). Segments séparés par un petit interstice (2px de fond),
 * total au centre, légende directement chiffrée (identité jamais par la couleur
 * seule). Survol d'un segment ou d'une entrée de légende : met la part en avant.
 */
export default function DonutChart({ data, format, titreCentre = 'Total', max = 6 }: {
  data: { label: string; value: number }[];
  format: (v: number) => string;
  titreCentre?: string;
  max?: number;
}) {
  const items = replierCategories(data, max);
  const total = items.reduce((s, x) => s + x.value, 0);
  const [hover, setHover] = useState<number | null>(null);

  if (!items.length || total <= 0) return <div className="text-ink-muted text-sm py-4">Aucune donnée.</div>;

  let acc = 0;
  const segments = items.map((it, i) => {
    const frac = it.value / total;
    const len = frac * CIRC;
    const seg = { it, i, dash: `${Math.max(0, len - 3)} ${CIRC - Math.max(0, len - 3)}`, offset: -acc };
    acc += len;
    return seg;
  });

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" style={{ flex: 'none' }}
           aria-label={`Répartition : ${items.map((it) => `${it.label} ${format(it.value)}`).join(', ') || 'aucune donnée'}`}>
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--line-soft)" strokeWidth={STROKE} />
        {segments.map((s) => (
          <circle key={s.i} cx={C} cy={C} r={R} fill="none"
                  stroke={s.it.couleur} strokeWidth={STROKE}
                  strokeDasharray={s.dash} strokeDashoffset={s.offset}
                  transform={`rotate(-90 ${C} ${C})`}
                  opacity={hover == null || hover === s.i ? 1 : 0.4}
                  style={{ transition: 'opacity .15s' }}
                  onMouseEnter={() => setHover(s.i)} onMouseLeave={() => setHover(null)} />
        ))}
        <text x={C} y={C - 4} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{titreCentre}</text>
        <text x={C} y={C + 12} textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--text)" className="money">
          {hover != null ? `${((items[hover].value / total) * 100).toFixed(1)} %` : format(total)}
        </text>
      </svg>

      <div className="flex flex-col gap-1.5 min-w-[160px] flex-1">
        {items.map((it, i) => (
          <div key={it.label} className="flex items-center gap-2 text-xs cursor-default"
               onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
               style={{ opacity: hover == null || hover === i ? 1 : 0.5 }}>
            <span className="w-2.5 h-2.5 rounded-sm flex-none" style={{ background: it.couleur }} />
            <span className="font-semibold truncate flex-1" title={it.label}>{it.label}</span>
            <span className="money text-ink-muted tabular-nums">{format(it.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
