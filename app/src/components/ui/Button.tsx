import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, Kbd, type IconName } from './Icon';
import { Tooltip, type TooltipSide } from './Tooltip';
import { cn } from './cn';

/**
 * Bouton standard de l'application (charte v2 §2.6).
 * - une seule action `primary` par zone ; le destructif en `danger` (isolé) ou `danger-solid` (confirmation finale) ;
 * - `kbd` affiche le raccourci clavier sur le bouton ; `loading` fige la largeur et annonce l'attente ;
 * - `to` rend un lien de navigation (react-router) avec le même aspect.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid' | 'success' | 'accent' | 'link';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-ink-inverse border-transparent hover:bg-brand-900 shadow-soft font-bold',
  secondary: 'bg-surface text-ink-label border-line hover:bg-hover hover:border-line-strong hover:text-ink font-semibold',
  ghost: 'bg-transparent text-ink-label border-transparent hover:bg-hover hover:text-ink font-semibold',
  danger: 'bg-danger-soft text-danger-text border-danger-line hover:bg-danger-solid hover:text-ink-inverse hover:border-transparent font-semibold',
  'danger-solid': 'bg-danger-solid text-ink-inverse border-transparent hover:bg-[var(--danger-hover)] font-bold',
  success: 'bg-success-solid text-ink-inverse border-transparent hover:brightness-95 font-bold',
  accent: 'bg-gold-400 text-gold-ink border-transparent hover:bg-gold-600 font-bold',
  link: 'bg-transparent text-brand-text border-transparent hover:underline underline-offset-2 font-semibold !px-0 !h-auto',
};

const SIZES: Record<ButtonSize, { box: string; icon: number }> = {
  xs: { box: 'h-6 px-2 text-xs gap-1 rounded-xs', icon: 14 },
  sm: { box: 'h-control-sm px-2.5 text-sm gap-1.5 rounded-sm', icon: 16 },
  md: { box: 'h-control-md px-3.5 text-base gap-2 rounded-md', icon: 16 },
  lg: { box: 'h-control-lg px-4 text-md gap-2 rounded-md', icon: 18 },
  xl: { box: 'h-control-xl px-5 text-md gap-2.5 rounded-md', icon: 20 },
};

const ICON_ONLY: Record<ButtonSize, string> = {
  xs: 'h-6 w-6 rounded-xs', sm: 'h-control-sm w-[28px] rounded-sm', md: 'h-control-md w-[34px] rounded-md',
  lg: 'h-control-lg w-10 rounded-md', xl: 'h-control-xl w-12 rounded-md',
};

const BASE = 'relative inline-flex items-center justify-center whitespace-nowrap border select-none transition-colors duration-fast '
  + 'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  /** Raccourci clavier affiché (« F10 », « Ctrl+S »…). */
  kbd?: string;
  loading?: boolean;
  /** Pleine largeur. */
  block?: boolean;
  /** Bouton bascule (état enfoncé). */
  pressed?: boolean;
  /** Navigation : rend un lien react-router. */
  to?: string;
  children?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, kbd, loading, block, pressed, to, className, children, disabled, type, ...rest },
  ref,
) {
  const s = SIZES[size];
  const filled = variant === 'primary' || variant === 'danger-solid' || variant === 'success';
  const classes = cn(
    BASE, s.box, VARIANTS[variant], block && 'w-full',
    pressed && variant !== 'primary' && '!bg-brand-soft !text-brand-text !border-brand-line',
    className,
  );
  const content = (
    <>
      {loading
        ? <Spinner size={s.icon} />
        : icon && <Icon name={icon} size={s.icon} />}
      {children != null && <span className={cn('truncate', loading && 'opacity-90')}>{children}</span>}
      {iconRight && !loading && <Icon name={iconRight} size={s.icon} />}
      {kbd && <Kbd tone={filled ? 'inverse' : 'line'}>{kbd}</Kbd>}
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={classes} title={rest.title} aria-label={rest['aria-label']}
            onClick={rest.onClick as unknown as React.MouseEventHandler<HTMLAnchorElement>}>{content}</Link>
    );
  }
  return (
    <button ref={ref} type={type ?? 'button'} className={classes} disabled={disabled || loading}
            aria-busy={loading || undefined} aria-pressed={pressed} {...rest}>
      {content}
    </button>
  );
});

export type IconButtonProps = Omit<ButtonProps, 'icon' | 'iconRight' | 'children' | 'kbd' | 'block'> & {
  icon: IconName;
  /** Libellé accessible ET info-bulle (obligatoire : un bouton-icône sans nom est muet). */
  label: string;
  /** Teinte de l'icône au repos (ex. danger pour une corbeille). */
  tone?: 'default' | 'danger' | 'brand';
  /**
   * Info-bulle de la charte (`Tooltip`) au lieu de l'attribut `title` natif : `true` reprend le libellé,
   * un contenu la remplace. Absent : comportement historique (`title`).
   */
  tooltip?: boolean | ReactNode;
  /** Raccourci affiché dans l'info-bulle (avec `tooltip`) et annoncé (`aria-keyshortcuts`). */
  kbd?: string;
  /** Côté préféré de l'info-bulle (retournée automatiquement si la place manque). */
  tooltipSide?: TooltipSide;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'ghost', size = 'md', tone = 'default', className, loading, pressed, disabled, to, type, tooltip, kbd, tooltipSide, ...rest },
  ref,
) {
  const s = SIZES[size];
  const toneCls = tone === 'danger' ? 'text-danger-text hover:!text-danger-text hover:!bg-danger-soft'
    : tone === 'brand' ? 'text-brand-text hover:!text-brand-text' : '';
  const classes = cn(
    BASE, ICON_ONLY[size], VARIANTS[variant], '!px-0', toneCls,
    pressed && '!bg-brand-soft !text-brand-text !border-brand-line', className,
  );
  const bulle = tooltip != null && tooltip !== false;
  const title = bulle ? undefined : label;
  const raccourci = kbd ? kbd.replace(/\bCtrl\b/g, 'Control') : undefined;
  const bouton = to && !disabled
    ? <Link to={to} className={classes} title={title} aria-label={label} aria-keyshortcuts={raccourci}><Icon name={icon} size={s.icon} /></Link>
    : (
      <button ref={ref} type={type ?? 'button'} className={classes} title={title} aria-label={label} aria-keyshortcuts={raccourci}
              disabled={disabled || loading} aria-pressed={pressed} {...rest}>
        {loading ? <Spinner size={s.icon} /> : <Icon name={icon} size={s.icon} />}
      </button>
    );
  if (!bulle) return bouton;
  // Un texte répète le nom accessible (aria-label) : il n'est pas relié en plus par aria-describedby.
  return (
    <Tooltip content={tooltip === true ? label : tooltip} kbd={kbd} side={tooltipSide}
             describe={typeof tooltip !== 'boolean' && typeof tooltip !== 'string'}>
      {bouton}
    </Tooltip>
  );
});

/** Groupe de boutons ; `attached` les accole (barre segmentée). */
export function ButtonGroup({ children, attached, className }: { children: ReactNode; attached?: boolean; className?: string }) {
  return (
    <div role="group" className={cn(
      'inline-flex items-center',
      attached ? '[&>*]:rounded-none [&>*:first-child]:rounded-l-md [&>*:last-child]:rounded-r-md [&>*+*]:-ml-px' : 'gap-2',
      className,
    )}>
      {children}
    </div>
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span role="presentation" className={cn('inline-block flex-none rounded-full border-2 border-current border-r-transparent animate-spin', className)}
          style={{ width: size, height: size }} />
  );
}
