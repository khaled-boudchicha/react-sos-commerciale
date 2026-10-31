import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { ARTICLES, REFERENTIELS } from '../../api/queries';
import { Article } from '../../api/types';
import { fmtMoney } from '../../lib/format';
import { NiveauPrix, ligneComptoir } from './comptoirCalc';
import { prixTtcUnitaire } from '../../components/document/lignesDocument';

/**
 * Panneau tactile familles → articles (TileFamille / dxTileControl du comptoir Delphi) —
 * gabarit maquette : puces de 34 px, grille de 6 tuiles de 64 px, deux rangées visibles.
 */
export default function TuilesArticles({ niveau, onArticle, onMasquer }: {
  niveau: NiveauPrix;
  onArticle: (a: Article) => void;
  onMasquer: () => void;
}) {
  const { data: refs } = useQuery(REFERENTIELS);
  const familles: { id: number; designation: string }[] = Array.isArray(refs?.familles) ? refs.familles : [];
  const [famille, setFamille] = useState<string | null>(null);
  const courante = famille ?? familles[0]?.designation ?? null;

  const { data, loading } = useQuery(ARTICLES, {
    skip: !courante,
    variables: { famille: courante, limit: 60, offset: 0 },
  });
  const articles: Article[] = data?.articles?.data ?? [];
  if (familles.length === 0) return null;

  return (
    <div className="flex-none rounded-xl bg-surface border border-line-soft shadow-soft p-2.5 flex flex-col gap-2.5">
      <div role="tablist" aria-label="Familles" className="flex gap-1.5 items-center">
        <div className="flex gap-1.5 overflow-x-auto min-w-0">
          {familles.map((f) => {
            const sel = courante === f.designation;
            return (
              <button key={f.id} type="button" role="tab" aria-selected={sel} onClick={() => setFamille(f.designation)}
                      className={`h-[34px] px-3.5 rounded-[9px] border text-[12.5px] whitespace-nowrap ${sel ? 'bg-brand-700 border-brand-700 text-white font-bold' : 'bg-surface border-line text-ink-label font-semibold hover:border-brand-300'}`}>
                {f.designation}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onMasquer} className="ml-auto h-[34px] px-3 text-sm leading-[1.45] font-bold text-brand-900 whitespace-nowrap">
          Masquer les tuiles
        </button>
      </div>
      <div className="grid gap-2 overflow-auto content-start" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', maxHeight: 136 }}>
        {loading && <div className="col-span-6 text-sm leading-[1.45] py-2 text-ink-muted">Chargement…</div>}
        {!loading && articles.length === 0 && <div className="col-span-6 text-sm leading-[1.45] py-2 text-ink-muted">Aucun article dans cette famille.</div>}
        {articles.map((a) => {
          const epuise = Number(a.qte_reale) <= 0;
          return (
            <button key={a.id} type="button" onClick={() => onArticle(a)} title={`${a.code} · stock ${a.qte_reale ?? 0}`}
                    className="h-16 rounded-md border border-line bg-surface px-2.5 py-2 flex flex-col justify-between items-start text-left hover:border-brand-500 hover:bg-brand-50 active:translate-y-px">
              <span className="text-sm font-bold leading-[1.2] text-ink line-clamp-2">{a.designation}</span>
              <span className="flex w-full justify-between items-baseline">
                <span className="money text-base leading-[1.45] font-extrabold text-brand-900">{fmtMoney(prixTtcUnitaire(ligneComptoir(a, niveau)))}</span>
                {epuise && <span className="text-2xs leading-[1.45] font-bold" style={{ color: 'var(--pos-alert)' }}>épuisé</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
