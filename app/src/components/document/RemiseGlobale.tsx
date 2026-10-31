import { useState } from 'react';
import { CONTROL } from '../ui/Field';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Champ « remise globale » avec bascule **% / DA**. La valeur canonique reste un
 * pourcentage (`pct`, envoyé au serveur comme `RemiseP`). En mode montant, la
 * saisie est convertie en % relatif au TTC avant remise globale (`baseTtc`).
 */
export default function RemiseGlobale({ pct, onPct, baseTtc }: {
  pct: number;
  onPct: (pct: number) => void;
  baseTtc: number;
}) {
  const [mode, setMode] = useState<'pct' | 'da'>('pct');
  const montant = baseTtc * (pct / 100);
  const value = mode === 'pct' ? pct : round2(montant);

  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-ink-label">Remise globale
      <div className="flex gap-1">
        <input type="number" min="0" step={mode === 'pct' ? '0.5' : '0.01'} max={mode === 'pct' ? 100 : undefined}
               value={value}
               onChange={(e) => {
                 const v = parseFloat(e.target.value) || 0;
                 if (mode === 'pct') onPct(Math.min(100, Math.max(0, v)));
                 else onPct(baseTtc > 0 ? Math.min(100, (v / baseTtc) * 100) : 0);
               }}
               className={`${CONTROL} h-control-md px-3 text-base flex-1 min-w-0 money text-right font-normal`} />
        <button type="button" onClick={() => setMode((m) => (m === 'pct' ? 'da' : 'pct'))}
                title="Basculer pourcentage / montant" aria-label={`Remise en ${mode === 'pct' ? 'pourcentage' : 'montant'} — basculer`}
                className="h-control-md w-11 flex-none rounded-sm border border-line bg-sunken text-sm font-bold text-brand-text hover:border-brand-line hover:bg-brand-soft transition-colors">
          {mode === 'pct' ? '%' : 'DA'}
        </button>
      </div>
    </label>
  );
}
