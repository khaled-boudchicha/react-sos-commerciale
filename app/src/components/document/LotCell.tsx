import { useQuery } from '@apollo/client';
import { LOTS } from '../../api/queries';
import { fmtDate, fmtQte, isoDate } from '../../lib/format';
import { LigneDoc, Sens } from './lignesDocument';

const champTexte = 'w-full bg-transparent money text-[11px] px-2 py-1.5 border border-transparent rounded-sm focus:border-brand-500 focus:bg-surface';
const champSelect = 'w-full bg-transparent text-[11px] px-1 py-1.5 border border-transparent rounded-sm focus:border-brand-500 focus:bg-surface';

/**
 * Cellule « N° de lot ».
 *  - Vente : liste les lots EXISTANTS en stock de l'article, triés par péremption
 *    croissante (FEFO). Choisir un lot renseigne aussi la date de péremption.
 *  - Achat (réception) ou article sans lot en stock : saisie libre (nouveau lot).
 */
export default function LotCell({ sens, line, patch }: {
  sens: Sens;
  line: LigneDoc;
  patch: (key: number, p: Partial<LigneDoc>) => void;
}) {
  const estVente = sens === 'vente';
  const { data } = useQuery(LOTS, {
    variables: { article_id: line.id_article },
    skip: !estVente || !line.id_article,
  });

  const lots = (Array.isArray(data?.lots) ? data.lots : [])
    .filter((l: any) => Number(l.qte) > 0)
    .sort((a: any, b: any) => String(a.date_peremption ?? '').localeCompare(String(b.date_peremption ?? '')));

  // Pas de sélection de lot possible → saisie libre (achat, ou vente sans stock lot)
  if (!estVente || lots.length === 0) {
    return (
      <input value={line.n_lot ?? ''} placeholder="—"
             onChange={(e) => patch(line.key, { n_lot: e.target.value })}
             className={champTexte} />
    );
  }

  return (
    <select value={line.n_lot ?? ''}
            onChange={(e) => {
              const lot = lots.find((l: any) => String(l.n_lot) === e.target.value);
              patch(line.key, {
                n_lot: e.target.value,
                date_peremption: lot?.date_peremption ? isoDate(lot.date_peremption) : (line.date_peremption ?? ''),
              });
            }}
            title="Choisir un lot en stock (péremption la plus proche en premier)"
            className={champSelect}>
      <option value="">— lot —</option>
      {lots.map((l: any) => (
        <option key={l.id} value={l.n_lot}>
          {l.n_lot} · {fmtQte(l.qte)} · {l.date_peremption ? fmtDate(l.date_peremption) : '—'}
        </option>
      ))}
    </select>
  );
}
