import type { ReactNode } from 'react';
import { Icon, IconBadge, TONE_VARS, type IconName, type Tone } from './Icon';
import { IconButton, Spinner } from './Button';
import { cn } from './cn';

/**
 * États de l'interface (charte v2, principe « dire ce qui se passe ») :
 * squelettes de chargement, états vides actionnables, panneaux d'erreur / d'accès, alertes en ligne.
 */

export function Skeleton({ width, height = 14, rounded = 'sm', lines, className }: {
  width?: number | string; height?: number | string; rounded?: 'xs' | 'sm' | 'md' | 'full'; lines?: number; className?: string;
}) {
  const r = { xs: 'rounded-xs', sm: 'rounded-sm', md: 'rounded-md', full: 'rounded-full' }[rounded];
  if (lines && lines > 1) {
    return (
      <span className={cn('flex flex-col gap-2', className)} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className={cn('gc-skeleton animate-shimmer block', r)} style={{ height, width: i === lines - 1 ? '60%' : width ?? '100%' }} />
        ))}
      </span>
    );
  }
  return <span aria-hidden="true" className={cn('gc-skeleton animate-shimmer inline-block align-middle', r, className)} style={{ width: width ?? '100%', height }} />;
}

export function EmptyState({ icon = 'inbox', title, description, action, size = 'md', tone = 'neutral', className }: {
  icon?: IconName; title: ReactNode; description?: ReactNode; action?: ReactNode;
  size?: 'sm' | 'md' | 'lg'; tone?: Tone; className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center gap-2', size === 'sm' ? 'py-5' : size === 'lg' ? 'py-14' : 'py-9', className)}>
      <IconBadge name={icon} tone={tone} size={size === 'sm' ? 'md' : 'lg'} />
      <div className={cn('font-bold text-ink mt-1', size === 'sm' ? 'text-base' : 'text-lg')}>{title}</div>
      {description && <div className="text-sm text-ink-muted max-w-[420px]">{description}</div>}
      {action && <div className="mt-2 flex items-center gap-2">{action}</div>}
    </div>
  );
}

const STATE_KIND: Record<'error' | 'forbidden' | 'not-found' | 'offline', { icon: IconName; tone: Tone; title: string }> = {
  error: { icon: 'alert', tone: 'danger', title: 'Une erreur est survenue' },
  forbidden: { icon: 'lock', tone: 'warning', title: 'Accès non autorisé' },
  'not-found': { icon: 'search', tone: 'neutral', title: 'Page introuvable' },
  offline: { icon: 'wifiOff', tone: 'warning', title: 'Agent hors ligne' },
};

/** Panneau d'état pleine zone (erreur d'écran, accès refusé, page introuvable). */
export function StatePanel({ kind, title, description, detail, actions, className }: {
  kind: keyof typeof STATE_KIND; title?: ReactNode; description?: ReactNode; detail?: string; actions?: ReactNode; className?: string;
}) {
  const k = STATE_KIND[kind];
  return (
    <div role={kind === 'error' ? 'alert' : undefined}
         className={cn('bg-surface border border-line-soft rounded-lg shadow-soft p-6 max-w-[640px] flex gap-4 animate-fade-in', className)}>
      <IconBadge name={k.icon} tone={k.tone} size="lg" />
      <div className="flex-1 min-w-0">
        <div className="text-lg font-bold text-ink">{title ?? k.title}</div>
        {description && <div className="text-sm text-ink-muted mt-1">{description}</div>}
        {detail && (
          <pre className="mt-3 text-xs money whitespace-pre-wrap rounded-sm p-3 bg-sunken border border-line-soft text-ink-label max-h-40 overflow-auto">{detail}</pre>
        )}
        {actions && <div className="flex flex-wrap gap-2 mt-4">{actions}</div>}
      </div>
    </div>
  );
}

const ALERT_ICON: Record<'info' | 'success' | 'warning' | 'danger', IconName> = {
  info: 'info', success: 'checkCircle', warning: 'alert', danger: 'alertCircle',
};

/** Message en ligne (bandeau) : erreur de formulaire, avertissement, information. */
export function Alert({ tone = 'info', title, children, onClose, action, compact, className }: {
  tone?: 'info' | 'success' | 'warning' | 'danger'; title?: ReactNode; children?: ReactNode;
  onClose?: () => void; action?: ReactNode; compact?: boolean; className?: string;
}) {
  const t = TONE_VARS[tone];
  return (
    <div role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
         className={cn('flex items-start gap-2.5 rounded-md border animate-fade-in', compact ? 'px-3 py-2 text-sm' : 'px-3.5 py-2.5 text-base', className)}
         style={{ background: t.soft, borderColor: t.line, color: t.text }}>
      <Icon name={ALERT_ICON[tone]} size={compact ? 16 : 18} className="mt-px" />
      <div className="flex-1 min-w-0">
        {title && <div className="font-bold">{title}</div>}
        {children && <div className={cn(title ? 'text-ink-label' : 'font-semibold', 'break-words')}>{children}</div>}
      </div>
      {action && <div className="flex-none">{action}</div>}
      {onClose && <IconButton icon="close" label="Fermer" size="xs" onClick={onClose} className="!text-current -mr-1" />}
    </div>
  );
}

/** Voile de chargement posé sur une zone (rafraîchissement d'une liste déjà affichée). */
export function LoadingOverlay({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-sticky flex items-center justify-center animate-fade-in" role="status" aria-live="polite"
         style={{ background: 'color-mix(in srgb, var(--surface) 60%, transparent)' }}>
      <span className="inline-flex items-center gap-2 rounded-md bg-raised border border-line-soft shadow-card px-3 py-2 text-sm font-semibold text-ink-label">
        <Spinner size={14} className="text-brand-text" />{label}
      </span>
    </div>
  );
}

/** Ligne « chargement » compacte (sous un titre, dans une carte). */
export function Loading({ label = 'Chargement…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn('inline-flex items-center gap-2 text-sm text-ink-muted', className)}>
      <Spinner size={14} className="text-brand-text" />{label}
    </div>
  );
}
