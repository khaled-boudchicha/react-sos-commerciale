import { ReactNode } from 'react';
import { fmtMoney } from '../../lib/format';

/** Couleurs stables par type de document (charte §2) */
const DOC_TONES: Record<string, { bg: string; fg: string }> = {
  FA: { bg: 'var(--brand-100)', fg: 'var(--brand-700)' },
  BL: { bg: 'color-mix(in srgb, var(--teal) 14%, transparent)', fg: 'var(--teal)' },
  BCT: { bg: 'color-mix(in srgb, var(--teal) 14%, transparent)', fg: 'var(--teal)' },
  BC: { bg: 'color-mix(in srgb, var(--violet) 14%, transparent)', fg: 'var(--violet)' },
  DO: { bg: 'color-mix(in srgb, var(--violet) 14%, transparent)', fg: 'var(--violet)' },
  FP: { bg: 'var(--line-soft)', fg: 'var(--text-muted)' },
  FAV: { bg: 'color-mix(in srgb, var(--danger) 12%, transparent)', fg: 'var(--danger)' },
  BRT: { bg: 'color-mix(in srgb, var(--danger) 12%, transparent)', fg: 'var(--danger)' },
  BR: { bg: 'color-mix(in srgb, var(--orange) 14%, transparent)', fg: 'var(--orange)' },
};

export function DocBadge({ code }: { code: string }) {
  const t = DOC_TONES[code] ?? DOC_TONES.FP;
  return (
    <span className="inline-block text-[10px] font-bold rounded px-1.5 py-0.5 tracking-wide"
          style={{ background: t.bg, color: t.fg }}>
      {code}
    </span>
  );
}

export function StatusPill({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'mut'; children: ReactNode }) {
  const map = {
    ok: { bg: 'color-mix(in srgb, var(--success) 12%, transparent)', fg: 'var(--success)' },
    warn: { bg: 'color-mix(in srgb, var(--warning) 14%, transparent)', fg: 'var(--warning)' },
    bad: { bg: 'color-mix(in srgb, var(--danger) 12%, transparent)', fg: 'var(--danger)' },
    mut: { bg: 'var(--line-soft)', fg: 'var(--text-muted)' },
  }[tone];
  return (
    <span className="inline-block text-[10px] font-bold rounded-full px-2 py-0.5"
          style={{ background: map.bg, color: map.fg }}>
      {children}
    </span>
  );
}

/** Statut de règlement d'une pièce à partir de regler/reste */
export function PayStatus({ regler, reste }: { regler: number; reste: number }) {
  if (reste <= 0.009) return <StatusPill tone="ok">Payée</StatusPill>;
  if (regler > 0) return <StatusPill tone="warn">Partiel</StatusPill>;
  return <StatusPill tone="bad">Impayée</StatusPill>;
}

export function Money({ value, colorNeg = true, digits = 2 }: { value: unknown; colorNeg?: boolean; digits?: number }) {
  const v = Number(value ?? 0);
  return (
    <span className="money font-medium" style={colorNeg && v < 0 ? { color: 'var(--danger)' } : undefined}>
      {fmtMoney(v, digits)}
    </span>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void;
  options: readonly { code: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex gap-0.5 bg-surface border border-line-soft rounded-md p-0.5 w-max">
      {options.map((o) => (
        <button key={o.code} onClick={() => onChange(o.code)}
                className={`px-3 py-1.5 rounded-sm text-[11.5px] font-bold ${value === o.code ? 'text-white bg-brand-700' : 'text-ink-muted hover:text-ink-label'}`}>
          {o.label}
          {o.count != null && <span className="money text-[10px] opacity-75 ml-1.5">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function PeriodPicker({ debut, fin, onChange }: {
  debut: string; fin: string; onChange: (debut: string, fin: string) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-label">
      <input type="date" value={debut} onChange={(e) => onChange(e.target.value, fin)}
             className="border border-line rounded-sm px-2 py-1.5 bg-surface text-ink" />
      →
      <input type="date" value={fin} onChange={(e) => onChange(debut, e.target.value)}
             className="border border-line rounded-sm px-2 py-1.5 bg-surface text-ink" />
    </span>
  );
}

export function SearchInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? 'Rechercher…'}
           className="border border-line rounded-sm px-3 py-1.5 bg-surface text-ink text-[12px] min-w-[220px]" />
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <h1 className="text-[18px] font-extrabold tracking-tight mr-auto">{title}</h1>
      {children}
    </div>
  );
}

export function Pagination({ offset, limit, total, onOffset }: {
  offset: number; limit: number; total: number; onOffset: (o: number) => void;
}) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center gap-2 text-[11.5px] text-ink-muted">
      <button disabled={offset === 0} onClick={() => onOffset(Math.max(0, offset - limit))}
              className="border border-line rounded-sm px-2 py-1 disabled:opacity-40">←</button>
      Page {page} / {pages} · {total} lignes
      <button disabled={offset + limit >= total} onClick={() => onOffset(offset + limit)}
              className="border border-line rounded-sm px-2 py-1 disabled:opacity-40">→</button>
    </div>
  );
}

/** Bouton d'export CSV (liste complète, au-delà de la page affichée). */
export function ExportBtn({ onClick, loading, disabled }: { onClick: () => void; loading?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={loading || disabled}
            title="Exporter la liste complète en CSV (Excel)"
            className="rounded-md px-3 py-1.5 font-semibold text-[11.5px] border border-line-soft bg-surface hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed">
      {loading ? 'Export…' : '⬇ Exporter CSV'}
    </button>
  );
}

/** Carte chiffrée (montant) des tableaux de bord de créances / recouvrement. */
export function Bucket({ label, value, tone, sub }: { label: string; value: number; tone: string; sub?: string }) {
  return (
    <div className="bg-surface border border-line-soft rounded-md shadow-soft p-3.5">
      <div className="text-[11px] font-semibold text-ink-muted mb-1">{label}</div>
      <div className="money text-[17px] font-extrabold" style={{ color: tone }}>{fmtMoney(value)}</div>
      {sub && <div className="text-[10.5px] text-ink-muted mt-0.5">{sub}</div>}
    </div>
  );
}
