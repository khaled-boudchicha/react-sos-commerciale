import { forwardRef, useState } from 'react';

/**
 * Éditeur numérique réutilisable (équivalent TcxCurrencyEdit / TcxSpinEdit) :
 *  - affichage formaté fr-DZ (espaces des milliers, virgule décimale) hors focus ;
 *  - saisie libre au focus (virgule ou point acceptés), tout sélectionné ;
 *  - validation sur Entrée / perte de focus, bornes min/max ;
 *  - ↑/↓ = ± step ; boutons − / + optionnels (`spin`).
 */
export type NumberEditProps = {
  value: number;
  onChange: (v: number) => void;
  /** Appelé après validation par Entrée (ex. : passer au champ suivant). */
  onEnter?: () => void;
  decimals?: number;
  /** Décimales minimales affichées (défaut = decimals) ; 0 pour une quantité « 3 » plutôt que « 3,000 ». */
  minDecimals?: number;
  min?: number;
  max?: number;
  step?: number;
  spin?: boolean;
  suffix?: string;
  /** pos = cellule de ligne de caisse (38 px) ; montant = champ d'encaissement (72 px, 34 px mono). */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'pos' | 'montant';
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

export function parseNombre(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(/ /g, '').replace(',', '.');
  if (t === '' || t === '-' || t === '.') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function formatNombre(n: number, decimals: number, minDecimals = decimals): string {
  return new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: Math.min(minDecimals, decimals), maximumFractionDigits: decimals })
    .format(Number.isFinite(n) ? n : 0);
}

const TAILLES = {
  sm: 'text-[12px] py-1 px-2',
  md: 'text-[13px] py-2 px-3',
  lg: 'text-[16px] py-2.5 px-3 font-bold',
  xl: 'text-[26px] py-3 px-4 font-extrabold',
  pos: 'h-[38px] text-[14px] px-2.5 rounded-lg font-medium',
  montant: 'h-[68px] text-[34px] px-0 font-extrabold bg-transparent',
};

const NumberEdit = forwardRef<HTMLInputElement, NumberEditProps>(function NumberEdit({
  value, onChange, onEnter, decimals = 2, minDecimals, min, max, step = 1, spin = false, suffix,
  size = 'md', autoFocus, disabled, className = '', ariaLabel,
}, ref) {
  const [focus, setFocus] = useState(false);
  const [texte, setTexte] = useState('');

  const borne = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const arrondi = (n: number) => Number(n.toFixed(Math.max(decimals, 0)));

  function valider(): number {
    const n = parseNombre(texte);
    const v = n == null ? value : arrondi(borne(n));
    if (v !== value) onChange(v);
    return v;
  }

  function incr(sens: 1 | -1) {
    const base = focus ? (parseNombre(texte) ?? value) : value;
    const v = arrondi(borne(base + sens * step));
    onChange(v);
    if (focus) setTexte(String(v).replace('.', ','));
  }

  const input = (
    <div className="relative flex-1 min-w-0">
      <input
        ref={ref}
        aria-label={ariaLabel}
        inputMode="decimal"
        disabled={disabled}
        autoFocus={autoFocus}
        value={focus ? texte : formatNombre(value, decimals, minDecimals ?? decimals)}
        onFocus={(e) => { setFocus(true); setTexte(value ? String(value).replace('.', ',') : ''); requestAnimationFrame(() => e.target.select()); }}
        onBlur={() => { valider(); setFocus(false); setTexte(''); }}
        onChange={(e) => setTexte(e.target.value)}
        // Champ montant : le cadre parent porte déjà le focus (bordure + halo)
        style={size === 'montant' ? { boxShadow: 'none' } : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); valider(); setTexte(''); (e.target as HTMLInputElement).select(); onEnter?.(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); incr(1); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); incr(-1); }
        }}
        className={`money w-full text-right text-ink outline-none disabled:opacity-60 ${size === 'montant' ? '' : 'border border-line rounded-sm bg-surface focus:border-brand-500'} ${TAILLES[size]} ${suffix ? 'pr-10' : ''} ${className}`}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-ink-muted pointer-events-none">{suffix}</span>}
    </div>
  );

  if (!spin) return input;
  const btn = size === 'pos'
    ? 'w-[38px] h-[38px] flex-none rounded-lg border border-line bg-surface text-ink-label text-[18px] font-extrabold hover:border-brand-300 disabled:opacity-50'
    : 'w-9 flex-none rounded-sm border border-line bg-surface text-ink-label font-extrabold hover:border-brand-300 disabled:opacity-50';
  return (
    <div className="flex gap-1 items-center">
      <button type="button" tabIndex={-1} className={btn} disabled={disabled} onClick={() => incr(-1)} aria-label="Diminuer">−</button>
      {input}
      <button type="button" tabIndex={-1} className={btn} disabled={disabled} onClick={() => incr(1)} aria-label="Augmenter">+</button>
    </div>
  );
});

export default NumberEdit;
