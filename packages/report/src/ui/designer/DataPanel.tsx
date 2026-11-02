import { useMemo, useState } from 'react';
import type { FieldDef, ReportDef } from '../../model';
import { kindDe } from '../../registre';
import { categoriesFonctions, FONCTIONS_DOC, VARIABLES_SYSTEME } from '../../data/functions';
import { Ic, NomIc } from '../icons';
import type { ChampDepose } from './Canvas';

const ICONE_TYPE: Record<FieldDef['type'], NomIc> = { text: 'text', number: 'fx', date: 'page', boolean: 'checkbox', image: 'image', list: 'bands' };
const COULEUR_TYPE: Record<FieldDef['type'], string> = { text: '#64748B', number: '#2450E0', date: '#D97706', boolean: '#7C3AED', image: '#0D9488', list: '#64748B' };

/**
 * Arbre des données : jeux de données du type de document, paramètres, variables, variables système
 * et fonctions. Les champs se glissent sur une bande ou s'insèrent d'un double-clic.
 */
export default function DataPanel({ def, onInserer, compact }: { def: ReportDef; onInserer: (c: ChampDepose) => void; compact?: boolean }) {
  const [onglet, setOnglet] = useState<'donnees' | 'fonctions'>('donnees');
  const [filtre, setFiltre] = useState('');
  const [fermes, setFermes] = useState<Set<string>>(new Set());
  const kind = kindDe(def.kind);
  const q = filtre.trim().toLowerCase();
  const correspond = (...s: (string | undefined)[]) => !q || s.some((x) => x?.toLowerCase().includes(q));

  const bascule = (n: string) => setFermes((s) => { const c = new Set(s); if (c.has(n)) c.delete(n); else c.add(n); return c; });

  const glisser = (e: React.DragEvent, c: ChampDepose) => {
    e.dataTransfer.setData('application/x-gcr-champ', JSON.stringify(c));
    e.dataTransfer.setData('text/plain', c.texte);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const fonctions = useMemo(() => FONCTIONS_DOC.filter((x) => correspond(x.nom, x.description, x.categorie)), [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex border-b border-line-soft flex-none">
        {([['donnees', 'Données', 'database'], ['fonctions', 'Fonctions', 'fx']] as const).map(([id, label, ic]) => (
          <button key={id} type="button" onClick={() => setOnglet(id)} aria-pressed={onglet === id}
                  className="flex-1 h-8 text-[11.5px] font-bold inline-flex items-center justify-center gap-1.5 border-b-2"
                  style={{ borderColor: onglet === id ? 'var(--gcr-brand-700)' : 'transparent', color: onglet === id ? 'var(--gcr-brand-700)' : 'var(--gcr-text-label)' }}>
            <Ic n={ic} size={13} /> {label}
          </button>
        ))}
      </div>
      <div className="p-2 flex-none">
        <div className="relative">
          <Ic n="search" size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher un champ ou une fonction"
                 className="h-7 w-full rounded border border-line bg-surface text-ink text-[12px] pl-7 pr-2" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-3 text-[12px]">
        {onglet === 'donnees' && (
          <>
            {kind.datasets.map((ds) => {
              const champs = ds.fields.filter((f) => correspond(f.name, f.label, ds.name));
              if (!champs.length) return null;
              const ouvert = !fermes.has(ds.name) || !!q;
              return (
                <div key={ds.name} className="mb-1">
                  <button type="button" onClick={() => bascule(ds.name)} className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-[var(--gcr-surface-sunken)] font-bold text-ink text-left">
                    <Ic n={ouvert ? 'chevD' : 'chevR'} size={12} />
                    <Ic n={ds.mode === 'list' ? 'bands' : 'database'} size={13} />
                    <span className="truncate">{ds.name}</span>
                    <span className="ml-auto text-[10px] font-semibold text-ink-muted">{ds.mode === 'list' ? 'liste' : 'unique'}</span>
                  </button>
                  {ouvert && champs.map((f) => {
                    const c: ChampDepose = { texte: `[${ds.name}.${f.name}]`, type: f.type, nom: f.label || f.name };
                    return (
                      <div key={f.name} draggable onDragStart={(e) => glisser(e, c)} onDoubleClick={() => onInserer(c)}
                           title={`${ds.name}.${f.name} — glisser sur une bande, ou double-clic`}
                           className="flex items-center gap-1.5 pl-6 pr-1.5 py-[3px] rounded cursor-grab active:cursor-grabbing hover:bg-[var(--gcr-surface-sunken)] text-ink-label">
                        <span style={{ color: COULEUR_TYPE[f.type] }}><Ic n={ICONE_TYPE[f.type]} size={12} /></span>
                        <span className="truncate font-semibold">{f.label ?? f.name}</span>
                        <span className="ml-auto font-mono text-[10px] text-ink-muted truncate max-w-[88px]">{f.name}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {def.parameters.filter((p) => correspond(p.name, p.label)).length > 0 && (
              <Groupe titre="Paramètres">
                {def.parameters.filter((p) => correspond(p.name, p.label)).map((p) => <Element key={p.name} nom={p.label || p.name} detail={p.name} icone="settings" c={{ texte: `[${p.name}]`, type: p.type, nom: p.name }} glisser={glisser} onInserer={onInserer} />)}
              </Groupe>
            )}
            {def.variables.filter((v) => correspond(v.name)).length > 0 && (
              <Groupe titre="Variables">
                {def.variables.filter((v) => correspond(v.name)).map((v) => <Element key={v.name} nom={v.name} detail="calculée" icone="fx" c={{ texte: `[${v.name}]`, type: 'number', nom: v.name }} glisser={glisser} onInserer={onInserer} />)}
              </Groupe>
            )}
            {VARIABLES_SYSTEME.filter((v) => correspond(v.nom, v.description)).length > 0 && (
              <Groupe titre="Système">
                {VARIABLES_SYSTEME.filter((v) => correspond(v.nom, v.description)).map((v) => <Element key={v.nom} nom={v.nom} detail={v.description} icone="page" c={{ texte: `[${v.nom}]`, type: 'number', nom: v.nom }} glisser={glisser} onInserer={onInserer} />)}
              </Groupe>
            )}
          </>
        )}

        {onglet === 'fonctions' && categoriesFonctions().map((cat) => {
          const liste = fonctions.filter((x) => x.categorie === cat);
          if (!liste.length) return null;
          return (
            <Groupe key={cat} titre={cat}>
              {liste.map((fn) => (
                <div key={fn.nom} draggable onDragStart={(e) => glisser(e, { texte: `[${fn.signature}]`, type: 'text', nom: fn.nom })} onDoubleClick={() => onInserer({ texte: `[${fn.signature}]`, type: 'text', nom: fn.nom })}
                     title={`${fn.signature}\n${fn.description}`}
                     className="px-1.5 py-1 rounded cursor-grab hover:bg-[var(--gcr-surface-sunken)]">
                  <div className="font-mono font-bold text-[11.5px] text-ink">{fn.nom}</div>
                  {!compact && <div className="text-[10.5px] text-ink-muted leading-snug">{fn.description}</div>}
                </div>
              ))}
            </Groupe>
          );
        })}
      </div>
    </div>
  );
}

function Groupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <div className="px-1.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">{titre}</div>
      {children}
    </div>
  );
}

function Element({ nom, detail, icone, c, glisser, onInserer }: {
  nom: string; detail: string; icone: NomIc; c: ChampDepose; glisser: (e: React.DragEvent, c: ChampDepose) => void; onInserer: (c: ChampDepose) => void;
}) {
  return (
    <div draggable onDragStart={(e) => glisser(e, c)} onDoubleClick={() => onInserer(c)} title={`${c.texte} — ${detail}`}
         className="flex items-center gap-1.5 px-1.5 py-[3px] rounded cursor-grab hover:bg-[var(--gcr-surface-sunken)] text-ink-label">
      <Ic n={icone} size={12} />
      <span className="truncate font-semibold">{nom}</span>
      <span className="ml-auto text-[10px] text-ink-muted truncate max-w-[110px]">{detail}</span>
    </div>
  );
}
