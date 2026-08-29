import { useState } from 'react';

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
    <label className="text-[11px] font-bold text-ink-label">Remise globale
      <div className="flex gap-1 mt-1">
        <input type="number" min="0" step={mode === 'pct' ? '0.5' : '0.01'} max={mode === 'pct' ? 100 : undefined}
               value={value}
               onChange={(e) => {
                 const v = parseFloat(e.target.value) || 0;
                 if (mode === 'pct') onPct(Math.min(100, Math.max(0, v)));
                 else onPct(baseTtc > 0 ? Math.min(100, (v / baseTtc) * 100) : 0);
               }}
               className="flex-1 min-w-0 border border-line rounded-sm px-3 py-2 bg-surface text-ink money text-right font-normal" />
        <button type="button" onClick={() => setMode((m) => (m === 'pct' ? 'da' : 'pct'))}
                title="Basculer pourcentage / montant"
                className="px-2.5 rounded-sm border border-line text-[11px] font-bold text-ink-label w-11">
          {mode === 'pct' ? '%' : 'DA'}
        </button>
      </div>
    </label>
  );
}
