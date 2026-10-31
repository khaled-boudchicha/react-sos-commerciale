import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, IconBadge, TONE_VARS, type IconName, type Tone } from './Icon';
import { cn } from './cn';
import { fmtMoney } from '../../lib/format';

/**
 * Cartes et présentation de données (charte v2 §2.8) : une seule recette de carte,
 * listes de propriétés et panneau de totaux partagés par les détails et les éditeurs.
 */

const PADDING = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' } as const;

export function Card({ children, padding = 'md', interactive, tone, to, onClick, className, as: As = 'div', title }: {
  children: ReactNode;
  padding?: keyof typeof PADDING;
  /** Survol marqué + curseur (carte cliquable). Automatique avec `to` / `onClick`. */
  interactive?: boolean;
  /** Carte teintée (bandeau d'information). */
  tone?: Tone;
  to?: string;
  onClick?: () => void;
  className?: string;
  as?: 'div' | 'section' | 'article';
  title?: string;
}) {
  const clickable = interactive || !!to || !!onClick;
  const classes = cn(
    'block bg-surface border border-line-soft rounded-md shadow-soft min-w-0',
    PADDING[padding],
    clickable && 'transition-[border-color,box-shadow] duration-fast hover:border-brand-line hover:shadow-card cursor-pointer text-left',
    className,
  );
  const style = tone ? { background: TONE_VARS[tone].soft, borderColor: TONE_VARS[tone].line } : undefined;
  if (to) return <Link to={to} className={classes} style={style} title={title}>{children}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cn(classes, 'w-full')} style={style} title={title}>{children}</button>;
  return <As className={classes} style={style} title={title}>{children}</As>;
}

export function CardHeader({ title, description, actions, icon, iconTone = 'brand', className }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; icon?: IconName; iconTone?: Tone; className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-3 mb-3', className)}>
      {icon && <IconBadge name={icon} tone={iconTone} size="sm" />}
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-bold text-ink leading-tight">{title}</h2>
        {description && <p className="text-sm text-ink-muted mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-none">{actions}</div>}
    </div>
  );
}

/** Liste « libellé : valeur » (en-têtes de pièces, fiches tiers / articles, coordonnées). */
export function DescriptionList({ items, columns = 2, className }: {
  items: { label: ReactNode; value: ReactNode; mono?: boolean; full?: boolean }[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const grid = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[columns];
  return (
    <dl className={cn('grid gap-x-6 gap-y-3', grid, className)}>
      {items.map((it, i) => (
        <div key={i} className={cn('min-w-0', it.full && 'col-span-full')}>
          <dt className="text-xs font-semibold text-ink-muted">{it.label}</dt>
          <dd className={cn('text-base font-semibold text-ink mt-0.5 break-words', it.mono && 'money')}>
            {it.value === null || it.value === undefined || it.value === '' ? <span className="text-ink-muted font-normal">—</span> : it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Panneau de totaux d'une pièce (HT, remise, TVA, timbre… puis net à payer). */
export function TotalsPanel({ rows, total, after, className }: {
  rows: { label: ReactNode; value: number | null | undefined; tone?: 'danger' | 'success' | 'warning'; muted?: boolean; hidden?: boolean }[];
  total?: { label: ReactNode; value: number | null | undefined; currency?: string };
  after?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-surface border border-line-soft rounded-md shadow-soft overflow-hidden', className)}>
      <div className="p-4 flex flex-col gap-1.5">
        {rows.filter((r) => !r.hidden).map((r, i) => (
          <div key={i} className={cn('flex items-baseline justify-between gap-4 text-base', r.muted ? 'text-ink-muted' : 'text-ink-label')}>
            <span>{r.label}</span>
            <span className="money font-semibold"
                  style={r.tone ? { color: `var(--${r.tone}-text)` } : Number(r.value ?? 0) < 0 ? { color: 'var(--danger-text)' } : { color: 'var(--text)' }}>
              {fmtMoney(r.value)}
            </span>
          </div>
        ))}
      </div>
      {total && (
        <div className="px-4 py-3 flex items-baseline justify-between gap-4 text-ink-inverse" style={{ background: 'var(--gradient-hero)' }}>
          <span className="text-sm font-bold uppercase tracking-wide opacity-90">{total.label}</span>
          <span className="money text-2xl font-extrabold">{fmtMoney(total.value)}{total.currency !== '' && <span className="text-sm font-bold opacity-80 ml-1">{total.currency ?? 'DA'}</span>}</span>
        </div>
      )}
      {after && <div className="px-4 py-3 border-t border-line-soft">{after}</div>}
    </div>
  );
}

/** Section titrée à l'intérieur d'une carte ou d'un formulaire (titre « eyebrow »). */
export function SectionTitle({ children, icon, actions, className }: { children: ReactNode; icon?: IconName; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 mb-2', className)}>
      {icon && <Icon name={icon} size={14} className="text-ink-muted" />}
      <h3 className="text-2xs font-bold uppercase tracking-wider text-ink-muted">{children}</h3>
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
