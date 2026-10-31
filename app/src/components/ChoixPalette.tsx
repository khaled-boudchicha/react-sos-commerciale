import { useState } from 'react';
import { PALETTES, applyPalette, paletteCourante, type Palette, type PaletteId } from '../lib/apparence';
import { Icon } from './ui/Icon';
import { cn } from './ui/cn';

/**
 * Sélecteur de palette de couleurs (Paramètres › Apparence) : une carte par palette avec une
 * mini-maquette (fond, barre latérale, carte, bouton, accent). Effet immédiat, mémorisé sur le poste.
 */
export default function ChoixPalette({ onChange }: { onChange?: (id: PaletteId) => void }) {
  const [courante, setCourante] = useState<PaletteId>(paletteCourante);
  const choisir = (id: PaletteId) => { applyPalette(id); setCourante(id); onChange?.(id); };

  return (
    <div role="radiogroup" aria-label="Palette de couleurs" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {PALETTES.map((p) => {
        const sel = p.id === courante;
        return (
          <button key={p.id} type="button" role="radio" aria-checked={sel} onClick={() => choisir(p.id)}
                  className={cn('group text-left rounded-md border p-2 transition-colors bg-surface',
                    sel ? 'border-brand-line ring-1 ring-[var(--brand-line)]' : 'border-line-soft hover:border-line-strong')}>
            <Maquette p={p} />
            <span className="mt-2 flex items-center gap-1.5">
              <span className={cn('inline-flex h-4 w-4 flex-none items-center justify-center rounded-full border-2',
                sel ? 'border-brand-700 bg-brand-700 text-ink-inverse' : 'border-line')}>
                {sel && <Icon name="check" size={10} strokeWidth={3.5} />}
              </span>
              <span className="text-sm font-bold text-ink">{p.libelle}</span>
            </span>
            <span className="block text-xs text-ink-muted mt-0.5 pl-[22px] leading-snug">{p.description}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Mini-maquette de l'interface aux couleurs de la palette (variante claire). */
function Maquette({ p }: { p: Palette }) {
  const { fond, surface, marque, accent } = p.apercu;
  const trait = (w: string, o = 0.25) => <span className="block h-[3px] rounded-full" style={{ width: w, background: marque, opacity: o }} />;
  return (
    <span className="flex h-[74px] overflow-hidden rounded-sm border border-line-soft" style={{ background: fond }} aria-hidden="true">
      <span className="w-[26%] flex flex-col gap-1.5 p-1.5" style={{ background: surface, borderRight: `1px solid ${fond}` }}>
        <span className="h-3 w-3 rounded-[3px]" style={{ background: marque }} />
        {trait('80%', 0.9)}{trait('65%')}{trait('70%')}
      </span>
      <span className="flex-1 flex flex-col gap-1.5 p-1.5">
        <span className="h-4 rounded-[3px]" style={{ background: `linear-gradient(135deg, ${marque}, ${marque})`, opacity: 0.92 }} />
        <span className="flex-1 rounded-[3px] p-1 flex flex-col gap-1" style={{ background: surface }}>
          {trait('70%', 0.35)}{trait('50%', 0.2)}
          <span className="mt-auto flex items-center gap-1">
            <span className="h-2.5 w-7 rounded-[2px]" style={{ background: marque }} />
            <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
          </span>
        </span>
      </span>
    </span>
  );
}
