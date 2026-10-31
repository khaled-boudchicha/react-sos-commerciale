import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, IconBadge, TONE_VARS, type IconName, type Tone } from './Icon';
import { Skeleton } from './States';
import { cn } from './cn';
import { fmtMoney } from '../../lib/format';

/**
 * Vignette d'indicateur (tableau de bord, créances, statistiques, comptes de trésorerie) :
 * libellé, valeur mise en avant, sous-texte, icône tonale, lien optionnel, état verrouillé (droits).
 */
export function KpiTile({ label, value, sub, icon, tone = 'brand', valueTone, to, onClick, loading, locked, size = 'md', selected, className }: {
  label: ReactNode;
  value?: ReactNode;
  sub?: ReactNode;
  icon?: IconName;
  tone?: Tone;
  /** Couleur de la valeur (sinon couleur de texte). */
  valueTone?: Tone;
  to?: string;
  onClick?: () => void;
  loading?: boolean;
  /** Indicateur masqué par les droits : message à la place de la valeur. */
  locked?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  className?: string;
}) {
  const clickable = !!to || !!onClick;
  const body = (
    <>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-ink-muted truncate">{label}</div>
          {locked ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-muted"><Icon name="lock" size={14} />{locked}</div>
          ) : (
            <div className={cn('money font-extrabold mt-1 truncate', size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-xl')}
                 style={{ color: valueTone ? TONE_VARS[valueTone].text : 'var(--text)' }}>
              {loading ? <Skeleton width="70%" height={size === 'lg' ? 28 : 20} /> : value}
            </div>
          )}
        </div>
        {icon && <IconBadge name={icon} tone={tone} size={size === 'sm' ? 'sm' : 'md'} />}
      </div>
      {sub && !locked && <div className="text-xs text-ink-muted mt-1.5 truncate">{loading ? <Skeleton width="50%" height={10} /> : sub}</div>}
      {clickable && !locked && (
        <Icon name="chevronRight" size={14} className="absolute right-2.5 bottom-2.5 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </>
  );
  const classes = cn(
    'group relative block bg-surface border rounded-md shadow-soft text-left min-w-0',
    size === 'sm' ? 'p-3' : 'p-4',
    selected ? 'border-brand-line ring-1 ring-[var(--brand-line)]' : 'border-line-soft',
    clickable && !locked && 'transition-[border-color,box-shadow] duration-fast hover:border-brand-line hover:shadow-card',
    className,
  );
  if (to && !locked) return <Link to={to} className={classes}>{body}</Link>;
  if (onClick && !locked) return <button type="button" onClick={onClick} aria-pressed={selected} className={cn(classes, 'w-full')}>{body}</button>;
  return <div className={classes}>{body}</div>;
}

/** Barres horizontales classées (top familles, top clients…). */
export function BarList({ items, max, tone = 'brand', empty = 'Aucune donnée.' }: {
  items: { key?: string; label: ReactNode; value: number; display?: ReactNode }[];
  max?: number; tone?: Tone; empty?: ReactNode;
}) {
  if (items.length === 0) return <div className="text-sm text-ink-muted">{empty}</div>;
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-3">
      {items.map((it, i) => (
        <li key={it.key ?? i}>
          <div className="flex justify-between gap-3 text-sm mb-1">
            <span className="font-semibold text-ink truncate">{it.label}</span>
            <span className="money text-ink-label whitespace-nowrap">{it.display ?? fmtMoney(it.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-line-soft overflow-hidden">
            <div className="h-full rounded-full transition-[width] duration-slow"
                 style={{ width: `${Math.max(2, (it.value / m) * 100)}%`, background: TONE_VARS[tone].solid }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
