import {
  createContext, forwardRef, useContext, useId, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { Icon, Kbd, type IconName } from './Icon';
import { cn } from './cn';

/**
 * Champs de saisie (charte v2 §2.7) : libellé au-dessus, astérisque des champs requis,
 * aide et erreur reliées au champ (aria-describedby / aria-invalid), hauteurs jetonisées.
 */

type FieldCtx = { id: string; describedBy?: string; invalid: boolean; required: boolean };
const FieldContext = createContext<FieldCtx | null>(null);

export function Field({ label, htmlFor, required, help, error, hint, span, className, children }: {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  /** Aide permanente sous le champ. */
  help?: ReactNode;
  /** Message d'erreur (le champ passe en rouge). */
  error?: ReactNode;
  /** Indication à droite du libellé (ex. « facultatif », unité). */
  hint?: ReactNode;
  /** Largeur dans une grille 12 colonnes. */
  span?: number;
  className?: string;
  children: ReactNode;
}) {
  const auto = useId();
  const id = htmlFor ?? `f${auto}`;
  const helpId = help ? `${id}-help` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [errId, helpId].filter(Boolean).join(' ') || undefined;
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: !!error, required: !!required }}>
      <div className={cn('flex flex-col gap-1 min-w-0', className)}
           style={span ? { gridColumn: `span ${span} / span ${span}` } : undefined}>
        <div className="flex items-baseline gap-2">
          <label htmlFor={id} className="text-xs font-semibold text-ink-label">
            {label}
            {required && <span className="text-danger-text ml-0.5" aria-hidden="true">*</span>}
          </label>
          {hint && <span className="ml-auto text-xs text-ink-muted">{hint}</span>}
        </div>
        {children}
        {error && (
          <span id={errId} className="flex items-center gap-1 text-xs font-semibold text-danger-text">
            <Icon name="alertCircle" size={14} />{error}
          </span>
        )}
        {help && <span id={helpId} className="text-xs text-ink-muted">{help}</span>}
      </div>
    </FieldContext.Provider>
  );
}

/** Propriétés ARIA héritées du `Field` englobant. */
function useFieldProps(id?: string, invalid?: boolean, required?: boolean) {
  const ctx = useContext(FieldContext);
  return {
    id: id ?? ctx?.id,
    'aria-describedby': ctx?.describedBy,
    'aria-invalid': invalid || ctx?.invalid || undefined,
    'aria-required': required || ctx?.required || undefined,
    invalid: !!(invalid || ctx?.invalid),
  };
}

export type InputSize = 'sm' | 'md' | 'lg';

export const CONTROL = 'w-full bg-surface text-ink border border-line rounded-sm transition-colors duration-fast '
  + 'hover:border-line-strong focus:border-brand-500 focus-visible:border-brand-500 '
  + 'disabled:bg-sunken disabled:text-ink-muted disabled:cursor-not-allowed read-only:bg-sunken';
const CONTROL_SIZE: Record<InputSize, string> = {
  sm: 'h-control-sm px-2 text-sm',
  md: 'h-control-md px-3 text-base',
  lg: 'h-control-lg px-3.5 text-md',
};
const INVALID = '!border-danger-text';

export type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: InputSize;
  invalid?: boolean;
  /** Police mono tabulaire (codes, montants). */
  mono?: boolean;
  align?: 'left' | 'right';
  /** Icône à gauche. */
  leading?: IconName;
  /** Élément à droite (unité, bouton). */
  trailing?: ReactNode;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { size = 'md', invalid, mono, align, leading, trailing, className, id, required, ...rest }, ref,
) {
  const { invalid: inv, ...aria } = useFieldProps(id, invalid, required);
  const input = (
    <input ref={ref} {...aria} required={required} {...rest}
           className={cn(CONTROL, CONTROL_SIZE[size], inv && INVALID, mono && 'money', align === 'right' && 'text-right',
             leading && (size === 'sm' ? 'pl-7' : 'pl-9'), trailing && 'pr-10', !leading && !trailing && className)} />
  );
  if (!leading && !trailing) return input;
  return (
    <div className={cn('relative flex items-center', className)}>
      {leading && (
        <Icon name={leading} size={16} className={cn('absolute text-ink-muted pointer-events-none', size === 'sm' ? 'left-2' : 'left-3')} />
      )}
      {input}
      {trailing && <span className="absolute right-2 flex items-center text-ink-muted">{trailing}</span>}
    </div>
  );
});

export const Select = forwardRef<HTMLSelectElement, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  size?: InputSize; invalid?: boolean; placeholder?: string;
}>(function Select({ size = 'md', invalid, placeholder, className, id, required, children, ...rest }, ref) {
  const { invalid: inv, ...aria } = useFieldProps(id, invalid, required);
  return (
    <select ref={ref} {...aria} required={required} {...rest}
            className={cn(CONTROL, CONTROL_SIZE[size], 'pr-8 cursor-pointer', inv && INVALID, className)}>
      {placeholder != null && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ invalid, className, id, required, rows = 3, ...rest }, ref) {
    const { invalid: inv, ...aria } = useFieldProps(id, invalid, required);
    return (
      <textarea ref={ref} rows={rows} {...aria} required={required} {...rest}
                className={cn(CONTROL, 'px-3 py-2 text-base resize-y', inv && INVALID, className)} />
    );
  },
);

export function Checkbox({ label, description, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode; description?: ReactNode;
}) {
  return (
    <label className={cn('inline-flex items-start gap-2 cursor-pointer select-none', rest.disabled && 'opacity-50 cursor-not-allowed', className)}>
      <input type="checkbox" className="mt-[3px] h-4 w-4 flex-none cursor-pointer accent-[var(--brand-700)]" {...rest} />
      <span className="flex flex-col">
        <span className="text-base text-ink">{label}</span>
        {description && <span className="text-xs text-ink-muted">{description}</span>}
      </span>
    </label>
  );
}

/** Interrupteur on/off (préférences). */
export function Switch({ checked, onChange, label, description, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean;
}) {
  return (
    <label className={cn('inline-flex items-start gap-2.5 cursor-pointer select-none', disabled && 'opacity-50 cursor-not-allowed')}>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
              className={cn('relative mt-0.5 h-5 w-9 flex-none rounded-full transition-colors duration-fast',
                checked ? 'bg-brand-700' : 'bg-line')}>
        <span className={cn('absolute left-0 top-0.5 h-4 w-4 rounded-full bg-surface shadow-soft transition-transform duration-fast',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </button>
      <span className="flex flex-col">
        <span className="text-base text-ink">{label}</span>
        {description && <span className="text-xs text-ink-muted">{description}</span>}
      </span>
    </label>
  );
}

/** Champ de recherche : icône loupe, bouton d'effacement, raccourci affiché. */
export function SearchField({ value, onChange, placeholder, label, width = 260, autoFocus, shortcut, size = 'md', className }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  /** Nom accessible (obligatoire si pas de libellé visible). */
  label?: string; width?: number | string; autoFocus?: boolean; shortcut?: string; size?: InputSize; className?: string;
}) {
  return (
    <div className={cn('relative flex items-center', className)} style={{ width }}>
      <Icon name="search" size={16} className="absolute left-2.5 text-ink-muted pointer-events-none" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus}
             placeholder={placeholder ?? 'Rechercher…'} aria-label={label ?? placeholder ?? 'Rechercher'}
             onKeyDown={(e) => { if (e.key === 'Escape' && value) { e.stopPropagation(); onChange(''); } }}
             className={cn(CONTROL, CONTROL_SIZE[size], 'pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden')} />
      {value ? (
        <button type="button" onClick={() => onChange('')} aria-label="Effacer la recherche" title="Effacer (Échap)"
                className="absolute right-1.5 h-6 w-6 inline-flex items-center justify-center rounded-xs text-ink-muted hover:text-ink hover:bg-hover">
          <Icon name="close" size={14} />
        </button>
      ) : shortcut ? <span className="absolute right-2 pointer-events-none"><Kbd>{shortcut}</Kbd></span> : null}
    </div>
  );
}

/** Contrôle segmenté (choix exclusif court : thème, densité, vue). */
export function SegmentedControl<T extends string>({ value, onChange, options, size = 'md', label }: {
  value: T; onChange: (v: T) => void;
  options: readonly { value: T; label: ReactNode; icon?: IconName }[];
  size?: 'sm' | 'md'; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label}
         className="inline-flex items-center gap-0.5 rounded-md border border-line-soft bg-sunken p-0.5">
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={sel} onClick={() => onChange(o.value)}
                  className={cn('inline-flex items-center gap-1.5 rounded-sm font-semibold transition-colors duration-fast',
                    size === 'sm' ? 'h-6 px-2.5 text-sm' : 'h-[30px] px-3 text-base',
                    sel ? 'bg-surface text-brand-text shadow-soft' : 'text-ink-muted hover:text-ink')}>
            {o.icon && <Icon name={o.icon} size={16} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Période (du … au …) avec raccourcis optionnels. Valeurs ISO `AAAA-MM-JJ`. */
export function DateRangeField({ from, to, onChange, presets = true, label = 'Période', size = 'md' }: {
  from: string; to: string; onChange: (from: string, to: string) => void;
  presets?: boolean; label?: string; size?: InputSize;
}) {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = new Date();
  const choix: { libelle: string; de: string; a: string }[] = [
    { libelle: 'Aujourd’hui', de: iso(now), a: iso(now) },
    { libelle: 'Ce mois', de: iso(new Date(now.getFullYear(), now.getMonth(), 1)), a: iso(now) },
    { libelle: 'Mois dernier', de: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), a: iso(new Date(now.getFullYear(), now.getMonth(), 0)) },
    { libelle: 'Année', de: iso(new Date(now.getFullYear(), 0, 1)), a: iso(now) },
  ];
  const actif = choix.find((c) => c.de === from && c.a === to)?.libelle ?? '';
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-1.5">
      <div className="inline-flex items-center rounded-sm border border-line bg-surface hover:border-line-strong transition-colors duration-fast">
        <Icon name="calendar" size={16} className="ml-2.5 text-ink-muted" />
        <input type="date" value={from} aria-label={`${label} : du`} onChange={(e) => onChange(e.target.value, to)}
               className={cn('bg-transparent text-ink border-0 px-2 outline-none', size === 'sm' ? 'h-[26px] text-sm' : 'h-[32px] text-base')} />
        <Icon name="arrowRight" size={14} className="text-ink-muted" />
        <input type="date" value={to} aria-label={`${label} : au`} onChange={(e) => onChange(from, e.target.value)}
               className={cn('bg-transparent text-ink border-0 px-2 outline-none', size === 'sm' ? 'h-[26px] text-sm' : 'h-[32px] text-base')} />
      </div>
      {presets && (
        <select value={actif} aria-label="Période prédéfinie"
                onChange={(e) => { const c = choix.find((x) => x.libelle === e.target.value); if (c) onChange(c.de, c.a); }}
                className={cn(CONTROL, CONTROL_SIZE[size], 'w-auto pr-7 cursor-pointer text-ink-label')}>
          <option value="" disabled>Raccourcis…</option>
          {choix.map((c) => <option key={c.libelle} value={c.libelle}>{c.libelle}</option>)}
        </select>
      )}
    </div>
  );
}
