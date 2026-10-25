import { Icone } from './icones';
import { usePreferencesNavigation, type Disposition } from './preferences';

/**
 * Choix de la disposition du menu, avec une vignette de chaque mise en page (Paramètres et menu Fichier).
 */
export default function ChoixDisposition() {
  const { disposition, definirDisposition, rubanReduit, definirRubanReduit } = usePreferencesNavigation();
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 max-w-[520px]" role="radiogroup" aria-label="Disposition du menu">
        {(['lateral', 'ruban'] as Disposition[]).map((d) => {
          const sel = disposition === d;
          return (
            <button key={d} role="radio" aria-checked={sel} onClick={() => definirDisposition(d)}
                    className="text-left rounded-lg border p-2.5 transition-colors"
                    style={{ borderColor: sel ? 'var(--brand-700)' : 'var(--line)', background: sel ? 'color-mix(in srgb, var(--brand-700) 6%, var(--surface))' : 'var(--surface)', boxShadow: sel ? '0 0 0 3px color-mix(in srgb, var(--brand-700) 16%, transparent)' : undefined }}>
              <Vignette d={d} />
              <div className="mt-2 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 inline-flex items-center justify-center flex-none" style={{ borderColor: sel ? 'var(--brand-700)' : 'var(--line)' }}>
                  {sel && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--brand-700)' }} />}
                </span>
                <span className="text-[12.5px] font-bold text-ink">{d === 'lateral' ? 'Barre latérale' : 'Ruban (style Office)'}</span>
                <Icone nom={d === 'lateral' ? 'lateral' : 'ruban'} taille={14} className="ml-auto text-ink-muted" />
              </div>
              <div className="text-[11px] text-ink-muted mt-0.5 pl-6">
                {d === 'lateral' ? 'Menu compact à gauche, plus de place en hauteur.' : 'Onglets et groupes de commandes en haut, comme Word et Excel.'}
              </div>
            </button>
          );
        })}
      </div>
      {disposition === 'ruban' && (
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-label">
          <input type="checkbox" checked={rubanReduit} onChange={(e) => definirRubanReduit(e.target.checked)} style={{ accentColor: 'var(--brand-700)' }} />
          Réduire le ruban (onglets seuls) — <span className="font-normal text-ink-muted">Ctrl+F1 ou double-clic sur un onglet</span>
        </label>
      )}
    </div>
  );
}

/** Mini-maquette de la mise en page. */
function Vignette({ d }: { d: Disposition }) {
  const trait = (w: string, o = 0.35) => <span className="block h-[3px] rounded-full" style={{ width: w, background: 'var(--text-muted)', opacity: o }} />;
  return (
    <div className="h-[86px] rounded-md overflow-hidden border flex" style={{ borderColor: 'var(--line-soft)', background: 'var(--bg)', flexDirection: d === 'lateral' ? 'row' : 'column' }}>
      {d === 'lateral' ? (
        <>
          <div className="w-[30%] p-1.5 flex flex-col gap-1.5" style={{ background: 'var(--surface)', borderRight: '1px solid var(--line-soft)' }}>
            <span className="w-4 h-4 rounded-[4px]" style={{ background: 'var(--gradient-hero)' }} />
            {trait('80%', 0.6)}{trait('65%')}{trait('75%')}{trait('55%')}{trait('70%')}
          </div>
          <div className="flex-1 p-2 flex flex-col gap-1.5">{trait('50%', 0.6)}<div className="flex-1 rounded-[4px]" style={{ background: 'var(--surface)' }} /></div>
        </>
      ) : (
        <>
          <div className="h-[11px]" style={{ background: 'var(--gradient-hero)' }} />
          <div className="h-[9px] flex items-end gap-1.5 px-1.5" style={{ background: 'var(--surface)' }}>
            <span className="w-4 h-[6px] rounded-t-sm" style={{ background: 'var(--brand-700)' }} />{trait('14%', 0.7)}{trait('12%')}{trait('12%')}
          </div>
          <div className="h-[22px] flex items-center gap-1.5 px-1.5" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line-soft)' }}>
            {['var(--brand-700)', 'var(--teal)', 'var(--orange)', 'var(--violet)', 'var(--success)'].map((c) => <span key={c} className="w-3.5 h-3.5 rounded-[3px]" style={{ background: `color-mix(in srgb, ${c} 30%, transparent)` }} />)}
            <span className="w-px h-3 mx-0.5" style={{ background: 'var(--line)' }} />{trait('18%')}
          </div>
          <div className="flex-1 p-1.5"><div className="h-full rounded-[4px]" style={{ background: 'var(--surface)' }} /></div>
        </>
      )}
    </div>
  );
}
