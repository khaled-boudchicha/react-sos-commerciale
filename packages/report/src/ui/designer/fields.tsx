import { ReactNode, RefObject, useEffect, useRef, useState } from 'react';
import { Ic, NomIc } from '../icons';

const ENTREE = 'h-7 w-full rounded border border-line bg-surface text-ink text-[12px] px-2 focus:outline-none focus:border-[var(--gcr-brand-700)]';

export function Section({ titre, children, ouvert = true, actions }: { titre: string; children: ReactNode; ouvert?: boolean; actions?: ReactNode }) {
  const [o, setO] = useState(ouvert);
  return (
    <section className="border-b border-line-soft">
      <div className="flex items-center">
        <button type="button" onClick={() => setO(!o)} aria-expanded={o}
                className="flex-1 flex items-center gap-1.5 px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-ink-label hover:bg-[var(--gcr-surface-sunken)]">
          <Ic n={o ? 'chevD' : 'chevR'} size={12} /> {titre}
        </button>
        {actions && <div className="pr-2">{actions}</div>}
      </div>
      {o && <div className="px-3 pb-3 flex flex-col gap-2">{children}</div>}
    </section>
  );
}

export function Ligne({ label, children, large }: { label?: string; children: ReactNode; large?: boolean }) {
  return (
    <label className={`grid items-center gap-2 ${label ? (large ? 'grid-cols-[1fr]' : 'grid-cols-[84px_1fr]') : 'grid-cols-1'}`}>
      {label && <span className="text-[11px] text-ink-muted font-semibold truncate" title={label}>{label}</span>}
      <div className="min-w-0">{children}</div>
    </label>
  );
}

/**
 * Valide la saisie en cours AVANT qu'un clic ailleurs (autre objet du plan de travail, autre bande…) ne change la
 * sélection : sans cela, la valeur tapée sans Entrée était perdue (le champ se recalait sur le nouvel objet).
 * Le clic est intercepté en phase de capture sur la fenêtre, avant tout gestionnaire de l'interface.
 */
function useValiderAvantClicExterieur(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const avant = (e: PointerEvent) => {
      const el = ref.current;
      if (el && document.activeElement === el && !el.contains(e.target as Node)) el.blur();
    };
    window.addEventListener('pointerdown', avant, true);
    return () => window.removeEventListener('pointerdown', avant, true);
  }, [ref]);
}

/** Texte validé à la sortie du champ ou sur Entrée (une seule entrée d'historique). */
export function Texte({ value, onChange, placeholder, mono, multiligne, lignes = 3, disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; multiligne?: boolean; lignes?: number; disabled?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useValiderAvantClicExterieur(ref);
  const valider = () => { if (v !== value) onChange(v); };
  const commun = {
    ref, value: v, placeholder, disabled, spellCheck: false as const,
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setV(e.target.value),
    onBlur: valider,
    className: `${ENTREE} ${mono ? 'font-mono text-[11.5px]' : ''} ${multiligne ? 'h-auto py-1.5 resize-y' : ''}`,
  };
  return multiligne
    ? <textarea rows={lignes} {...commun} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); valider(); } }} />
    : <input type="text" {...commun} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); valider(); (e.target as HTMLElement).blur(); } }} />;
}

export function Nombre({ value, onChange, min, max, step = 0.5, unite, decimales = 2, disabled, mixte }: {
  value: number | undefined; onChange: (v: number) => void; min?: number; max?: number; step?: number; unite?: string; decimales?: number; disabled?: boolean; mixte?: boolean;
}) {
  const fmt = (n: number | undefined) => (mixte || n === undefined || Number.isNaN(n) ? '' : String(Math.round(n * 10 ** decimales) / 10 ** decimales));
  const [v, setV] = useState(fmt(value));
  useEffect(() => setV(fmt(value)), [value, mixte]); // eslint-disable-line react-hooks/exhaustive-deps
  const ref = useRef<HTMLInputElement>(null);
  useValiderAvantClicExterieur(ref);
  const valider = (brut: string) => {
    const n = parseFloat(brut.replace(',', '.'));
    if (!Number.isFinite(n)) { setV(fmt(value)); return; }
    const c = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    setV(fmt(c));
    if (c !== value) onChange(c);
  };
  return (
    <div className="relative">
      <input ref={ref} type="text" inputMode="decimal" value={v} disabled={disabled} placeholder={mixte ? '—' : undefined}
             onChange={(e) => setV(e.target.value)} onBlur={(e) => valider(e.target.value)}
             onKeyDown={(e) => {
               if (e.key === 'Enter') { valider((e.target as HTMLInputElement).value); (e.target as HTMLElement).blur(); }
               else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                 e.preventDefault();
                 const base = parseFloat(v.replace(',', '.')) || 0;
                 valider(String(base + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)));
               }
             }}
             className={`${ENTREE} money ${unite ? 'pr-7' : ''}`} />
      {unite && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-muted pointer-events-none">{unite}</span>}
    </div>
  );
}

export function Choix<T extends string | number>({ value, onChange, options, disabled }: {
  value: T | undefined; onChange: (v: T) => void; options: { value: T; label: string }[]; disabled?: boolean;
}) {
  return (
    <select value={value === undefined ? '' : String(value)} disabled={disabled}
            onChange={(e) => { const o = options.find((x) => String(x.value) === e.target.value); if (o) onChange(o.value); }}
            className={ENTREE}>
      {value === undefined && <option value="">—</option>}
      {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
    </select>
  );
}

export function Couleur({ value, onChange, vide = 'Aucune' }: { value: string | undefined; onChange: (v: string | undefined) => void; vide?: string }) {
  const hex = value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff';
  return (
    <div className="flex items-center gap-1.5">
      <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} aria-label="Couleur"
             className="h-7 w-9 rounded border border-line bg-surface p-0.5 cursor-pointer" style={!value ? { opacity: .45 } : undefined} />
      <span className="text-[11px] text-ink-muted font-mono flex-1 truncate">{value ?? vide}</span>
      {value !== undefined && <button type="button" onClick={() => onChange(undefined)} className="text-ink-muted hover:text-ink p-1" title="Effacer"><Ic n="close" size={12} /></button>}
    </div>
  );
}

export function Interrupteur({ label, value, onChange, aide }: { label: string; value: boolean | undefined; onChange: (v: boolean) => void; aide?: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-[12px] text-ink-label" title={aide}>
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--gcr-brand-700)]" />
      {label}
    </label>
  );
}

export function Bascules<T extends string>({ value, onChange, options }: {
  value: T | undefined; onChange: (v: T) => void; options: { value: T; icone: NomIc; titre: string }[];
}) {
  return (
    <div className="inline-flex rounded border border-line overflow-hidden" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" title={o.titre} aria-pressed={value === o.value} onClick={() => onChange(o.value)}
                className="h-7 w-8 inline-flex items-center justify-center border-r border-line last:border-r-0 text-ink-label hover:bg-[var(--gcr-surface-sunken)]"
                style={value === o.value ? { background: 'var(--gcr-brand-700)', color: '#fff' } : undefined}>
          <Ic n={o.icone} size={14} />
        </button>
      ))}
    </div>
  );
}

export function BoutonIcone({ icone, titre, onClick, actif, disabled, taille = 15 }: {
  icone: NomIc; titre: string; onClick: () => void; actif?: boolean; disabled?: boolean; taille?: number;
}) {
  return (
    <button type="button" title={titre} aria-label={titre} aria-pressed={actif} onClick={onClick} disabled={disabled}
            className="h-7 w-7 rounded inline-flex items-center justify-center text-ink-label hover:bg-[var(--gcr-surface-sunken)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
            style={actif ? { background: 'var(--gcr-brand-700)', color: '#fff' } : undefined}>
      <Ic n={icone} size={taille} />
    </button>
  );
}

export const classeEntree = ENTREE;
