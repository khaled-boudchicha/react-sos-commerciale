import { useId, useMemo, useState } from 'react';
import { SERIE_PRINCIPALE } from './palette';

export type PointSerie = { label: string; value: number };

const W = 800, H = 260;
const M = { l: 62, r: 16, t: 14, b: 30 };
const IW = W - M.l - M.r;
const IH = H - M.t - M.b;

/** Échelle « jolie » : borne haute arrondie + 4 graduations. */
function ticks(max: number): { vals: number[]; haut: number } {
  if (max <= 0) return { vals: [0], haut: 1 };
  const brut = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(brut)));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= brut) ?? mag * 10;
  const haut = Math.ceil(max / pas) * pas;
  const vals: number[] = [];
  for (let v = 0; v <= haut + 1e-6; v += pas) vals.push(v);
  return { vals, haut };
}

/**
 * Courbe (aire + ligne) mono-série — évolution dans le temps. Le titre nomme la
 * série (pas de légende). Survol : trait vertical + point + infobulle.
 */
export default function LineChart({ data, format, couleur = SERIE_PRINCIPALE, hauteur = 260 }: {
  data: PointSerie[];
  format: (v: number) => string;
  couleur?: string;
  hauteur?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const { vals, haut } = useMemo(() => ticks(Math.max(0, ...data.map((d) => d.value))), [data]);
  const x = (i: number) => M.l + (data.length <= 1 ? IW / 2 : (i / (data.length - 1)) * IW);
  const y = (v: number) => M.t + IH - (haut > 0 ? (v / haut) * IH : 0);

  const ligne = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ');
  const aire = data.length
    ? `${ligne} L ${x(data.length - 1).toFixed(1)} ${(M.t + IH).toFixed(1)} L ${x(0).toFixed(1)} ${(M.t + IH).toFixed(1)} Z`
    : '';

  // Étiquettes X : on en montre au plus ~8 pour éviter les collisions.
  const pasX = Math.max(1, Math.ceil(data.length / 8));

  function survol(e: React.MouseEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - M.l) / IW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  const pt = hover != null ? data[hover] : null;

  return (
    <div className="relative w-full" style={{ userSelect: 'none' }}>
      <svg viewBox={`0 0 ${W} ${hauteur}`} width="100%" role="img" preserveAspectRatio="none" aria-label={resumeSerie(data, format)}
           style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: couleur, stopOpacity: 0.18 }} />
            <stop offset="100%" style={{ stopColor: couleur, stopOpacity: 0.02 }} />
          </linearGradient>
        </defs>

        {/* Grille + graduations Y (discrètes) */}
        {vals.map((v, i) => (
          <g key={i}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line-soft)" strokeWidth="1" />
            <text x={M.l - 8} y={y(v) + 3} textAnchor="end" fontSize="10" fill="var(--text-muted)">{format(v)}</text>
          </g>
        ))}

        {aire && <path d={aire} fill={`url(#g${uid})`} />}
        {ligne && <path d={ligne} fill="none" stroke={couleur} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}

        {/* Étiquettes X */}
        {data.map((d, i) => (i % pasX === 0 || i === data.length - 1) ? (
          <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{d.label}</text>
        ) : null)}

        {/* Survol : trait + point */}
        {pt && (
          <g>
            <line x1={x(hover!)} x2={x(hover!)} y1={M.t} y2={M.t + IH} stroke={couleur} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={x(hover!)} cy={y(pt.value)} r="4.5" fill="var(--surface)" stroke={couleur} strokeWidth="2" />
          </g>
        )}

        <rect x={M.l} y={M.t} width={IW} height={IH} fill="transparent"
              onMouseMove={survol} onMouseLeave={() => setHover(null)} />
      </svg>

      {pt && (
        <div className="absolute pointer-events-none rounded-md shadow-lifted z-tooltip text-xs px-2.5 py-1.5 whitespace-nowrap"
             style={{
               left: `${(x(hover!) / W) * 100}%`,
               top: `${(y(pt.value) / hauteur) * 100}%`,
               transform: `translate(-50%, calc(-100% - 8px))`,
               background: 'var(--surface-raised)', border: '1px solid var(--line-soft)',
             }}>
          <div className="font-semibold text-ink">{pt.label}</div>
          <div className="money flex items-center gap-1.5 text-ink">
            <span className="w-2 h-2 rounded-full flex-none" style={{ background: couleur }} />{format(pt.value)}
          </div>
        </div>
      )}
    </div>
  );
}

/** Résumé textuel de la courbe pour les lecteurs d'écran (le détail reste dans le tableau voisin). */
function resumeSerie(data: PointSerie[], format: (v: number) => string): string {
  if (!data.length) return 'Courbe sans donnée';
  const valeurs = data.map((d) => Number(d.value) || 0);
  const max = Math.max(...valeurs), min = Math.min(...valeurs);
  return `Courbe de ${data.length} point(s), du ${data[0].label} au ${data[data.length - 1].label} : minimum ${format(min)}, maximum ${format(max)}`;
}
