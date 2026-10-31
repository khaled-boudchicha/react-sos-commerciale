import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fmtMoney } from '../../lib/format';
import { Icon, TONE_VARS, type IconName, type Tone } from './Icon';
import { Button, IconButton } from './Button';
import { DateRangeField, SearchField } from './Field';
import { cn } from './cn';

/* ════════════════════════════════════════════════════════════════════════════
   Badges et statuts (charte v2 §2.9) — texte *-text sur fond *-soft : AA en clair et en sombre
   ════════════════════════════════════════════════════════════════════════════ */

export function Badge({ tone = 'neutral', shape = 'pill', dot, icon, size = 'sm', children, title, className }: {
  tone?: Tone; shape?: 'pill' | 'square'; dot?: boolean; icon?: IconName; size?: 'sm' | 'md';
  children: ReactNode; title?: string; className?: string;
}) {
  const t = TONE_VARS[tone];
  return (
    <span title={title}
          className={cn('inline-flex items-center gap-1 font-bold whitespace-nowrap leading-none',
            size === 'md' ? 'text-xs h-[22px] px-2' : 'text-2xs h-5 px-1.5',
            shape === 'pill' ? 'rounded-full' : 'rounded-xs tracking-wide', className)}
          style={{ background: t.soft, color: t.text }}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />}
      {icon && <Icon name={icon} size={12} strokeWidth={2.2} />}
      {children}
    </span>
  );
}

/** Couleurs stables par type de document (charte §2 « Documents »). */
export const DOC_TONE: Record<string, Tone> = {
  FA: 'brand', BL: 'teal', BCT: 'teal', BC: 'violet', DO: 'violet', FP: 'neutral', FAV: 'danger', BRT: 'danger', BR: 'orange',
};

export function DocBadge({ code }: { code: string }) {
  return <Badge tone={DOC_TONE[code] ?? 'neutral'} shape="square">{code}</Badge>;
}

export function StatusPill({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'mut'; children: ReactNode }) {
  const map: Record<typeof tone, Tone> = { ok: 'success', warn: 'warning', bad: 'danger', mut: 'neutral' };
  return <Badge tone={map[tone]} dot>{children}</Badge>;
}

/** Statut de règlement d'une pièce à partir de regler/reste */
export function PayStatus({ regler, reste }: { regler: number; reste: number }) {
  if (reste <= 0.009) return <StatusPill tone="ok">Payée</StatusPill>;
  if (regler > 0) return <StatusPill tone="warn">Partiel</StatusPill>;
  return <StatusPill tone="bad">Impayée</StatusPill>;
}

/** Pastille de connexion (agent cloud → PC). */
export function StatusDot({ online, label, className }: { online: boolean; label?: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} role="status">
      <span className="relative flex h-2 w-2">
        {online && <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ background: 'var(--status-online)' }} />}
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: online ? 'var(--status-online)' : 'var(--status-offline)' }} />
      </span>
      {label}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Montants
   ════════════════════════════════════════════════════════════════════════════ */

export function Money({ value, colorNeg = true, digits = 2, signed, currency, tone, className }: {
  value: unknown; colorNeg?: boolean; digits?: number;
  /** Préfixe « + » sur les montants positifs. */
  signed?: boolean;
  /** Ajoute « DA ». */
  currency?: boolean;
  tone?: 'danger' | 'success' | 'warning' | 'muted';
  className?: string;
}) {
  const v = Number(value ?? 0);
  const color = tone === 'muted' ? 'var(--text-muted)' : tone ? `var(--${tone}-text)` : colorNeg && v < 0 ? 'var(--danger-text)' : undefined;
  return (
    <span className={cn('money font-medium whitespace-nowrap', className)} style={color ? { color } : undefined}>
      {signed && v > 0 ? '+' : ''}{fmtMoney(v, digits)}{currency && <span className="text-ink-muted font-normal"> DA</span>}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Onglets — `pill` (vues d'un écran) ou `underline` (sous-filtres), clavier ← → Début Fin
   ════════════════════════════════════════════════════════════════════════════ */

export function Tabs<T extends string>({ value, onChange, options, variant = 'pill', size = 'md', label }: {
  value: T; onChange: (v: T) => void;
  options: readonly { code: T; label: ReactNode; count?: number; icon?: IconName; tone?: Tone }[];
  variant?: 'pill' | 'underline';
  size?: 'sm' | 'md';
  /** Nom accessible du groupe d'onglets. */
  label?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent, i: number) {
    const n = options.length;
    const cible = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n
      : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (cible < 0) return;
    e.preventDefault();
    onChange(options[cible].code);
    refs.current[cible]?.focus();
  }
  const pill = variant === 'pill';
  return (
    <div role="tablist" aria-label={label}
         className={pill
           ? 'inline-flex gap-0.5 bg-surface border border-line-soft rounded-md p-0.5 w-max max-w-full overflow-x-auto'
           : 'flex gap-1 border-b border-line-soft w-full overflow-x-auto'}>
      {options.map((o, i) => {
        const sel = value === o.code;
        const tone = o.tone ? TONE_VARS[o.tone] : null;
        return (
          <button key={o.code} ref={(el) => { refs.current[i] = el; }} role="tab" type="button" aria-selected={sel} data-code={o.code}
                  tabIndex={sel ? 0 : -1} onClick={() => onChange(o.code)} onKeyDown={(e) => onKey(e, i)}
                  className={cn('inline-flex items-center gap-1.5 whitespace-nowrap font-semibold transition-colors duration-fast',
                    size === 'sm' ? 'text-sm' : 'text-base',
                    pill
                      ? cn('rounded-sm', size === 'sm' ? 'h-[26px] px-2.5' : 'h-[30px] px-3',
                        sel ? 'text-ink-inverse bg-brand-700 shadow-soft' : 'text-ink-muted hover:text-ink hover:bg-hover')
                      : cn('relative -mb-px border-b-2', size === 'sm' ? 'h-8 px-2' : 'h-9 px-3',
                        sel ? 'text-ink' : 'border-transparent text-ink-muted hover:text-ink hover:border-line'))}
                  style={!pill && sel ? { borderColor: tone?.solid ?? 'var(--brand-700)', color: tone?.text } : undefined}>
            {o.icon && <Icon name={o.icon} size={16} />}
            {o.label}
            {o.count != null && (
              <span className={cn('money text-2xs rounded-full px-1.5 py-px',
                sel && pill ? 'bg-white/20' : 'bg-line-soft text-ink-label')}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Filtres
   ════════════════════════════════════════════════════════════════════════════ */

/** Période — enveloppe historique de `DateRangeField`. */
export function PeriodPicker({ debut, fin, onChange, presets = true }: {
  debut: string; fin: string; onChange: (debut: string, fin: string) => void; presets?: boolean;
}) {
  return <DateRangeField from={debut} to={fin} onChange={onChange} presets={presets} />;
}

/** Recherche — enveloppe historique de `SearchField`. */
export function SearchInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return <SearchField value={value} onChange={onChange} placeholder={placeholder} width={260} />;
}

/* ════════════════════════════════════════════════════════════════════════════
   En-tête d'écran : fil d'Ariane, titre, méta, actions ; titre de la fenêtre synchronisé
   ════════════════════════════════════════════════════════════════════════════ */

export type Crumb = { label: ReactNode; to?: string };

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Fil d'Ariane">
      <ol className="flex items-center gap-1 text-xs text-ink-muted flex-wrap">
        {items.map((c, i) => (
          <li key={i} className="inline-flex items-center gap-1">
            {i > 0 && <Icon name="chevronRight" size={12} />}
            {c.to && i < items.length - 1
              ? <Link to={c.to} className="font-semibold hover:text-brand-text hover:underline underline-offset-2">{c.label}</Link>
              : <span aria-current={i === items.length - 1 ? 'page' : undefined} className="font-semibold text-ink-label">{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const APP_TITLE = 'Gestion Commerciale';

/** Synchronise le titre de la fenêtre (barre de titre Electron, barre des tâches). */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    document.title = `${title} — ${APP_TITLE}`;
    return () => { document.title = APP_TITLE; };
  }, [title]);
}

export function PageHeader({ title, children, description, breadcrumb, backTo, backLabel = 'Retour', meta, icon, iconTone = 'brand' }: {
  title: ReactNode;
  /** Actions de l'écran (à droite). */
  children?: ReactNode;
  description?: ReactNode;
  breadcrumb?: Crumb[];
  /** Bouton retour (écrans de détail / éditeurs). */
  backTo?: string;
  backLabel?: string;
  /** Badges / statut à côté du titre. */
  meta?: ReactNode;
  icon?: IconName;
  iconTone?: Tone;
}) {
  usePageTitle(typeof title === 'string' ? title : null);
  return (
    <header className="flex flex-col gap-1.5">
      {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}
      <div className="flex items-center gap-3 flex-wrap min-h-control-md">
        {backTo && <IconButton icon="arrowLeft" label={backLabel} to={backTo} variant="secondary" />}
        {icon && (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md flex-none"
                style={{ background: TONE_VARS[iconTone].soft, color: TONE_VARS[iconTone].text }}>
            <Icon name={icon} size={20} />
          </span>
        )}
        <div className="mr-auto min-w-0 flex flex-col">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink truncate">{title}</h1>
            {meta}
          </div>
          {description && <p className="text-sm text-ink-muted mt-0.5">{description}</p>}
        </div>
        {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
      </div>
    </header>
  );
}

/** Barre d'outils de filtres sous l'en-tête (périodes, recherche, onglets). */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-2 flex-wrap', className)}>{children}</div>;
}

export function Pagination({ offset, limit, total, onOffset }: {
  offset: number; limit: number; total: number; onOffset: (o: number) => void;
}) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted">
      <IconButton icon="chevronLeft" label="Page précédente" size="sm" variant="secondary"
                  disabled={offset === 0} onClick={() => onOffset(Math.max(0, offset - limit))} />
      <span>Page <b className="text-ink">{page}</b> / {pages} · {total} lignes</span>
      <IconButton icon="chevronRight" label="Page suivante" size="sm" variant="secondary"
                  disabled={offset + limit >= total} onClick={() => onOffset(offset + limit)} />
    </div>
  );
}

/** Bouton d'export CSV (liste complète, au-delà de la page affichée). */
export function ExportBtn({ onClick, loading, disabled }: { onClick: () => void; loading?: boolean; disabled?: boolean }) {
  return (
    <Button icon="download" onClick={onClick} loading={loading} disabled={disabled}
            title="Exporter la liste complète en CSV (Excel)">
      {loading ? 'Export…' : 'Exporter'}
    </Button>
  );
}

/** Carte chiffrée (montant) des tableaux de bord de créances / recouvrement. */
export function Bucket({ label, value, tone, sub }: { label: string; value: number; tone: string; sub?: string }) {
  // Les anciens appels passent une couleur d'aplat : on la lit en couleur de texte AA.
  const color = tone.replace(/var\(--(danger|warning|success|info)\)/, 'var(--$1-text)');
  return (
    <div className="bg-surface border border-line-soft rounded-md shadow-soft p-4 min-w-0">
      <div className="text-xs font-semibold text-ink-muted mb-1">{label}</div>
      <div className="money text-xl font-extrabold truncate" style={{ color }}>{fmtMoney(value)}</div>
      {sub && <div className="text-xs text-ink-muted mt-0.5">{sub}</div>}
    </div>
  );
}
