import { useQuery } from '@apollo/client';
import { LOTS } from '../../api/queries';
import { fmtDate, fmtQte, isoDate } from '../../lib/format';
import { LigneDoc, Sens } from './lignesDocument';

const champTexte = 'w-full bg-transparent money text-xs px-2 py-1.5 border border-transparent rounded-sm focus:border-brand-500 focus:bg-surface';
const champSelect = 'w-full bg-transparent text-xs px-1 py-1.5 border border-transparent rounded-sm focus:border-brand-500 focus:bg-surface';

/**
 * Cellule « N° de lot ».
 *  - Vente : liste les lots EXISTANTS en stock de l'article, triés par péremption
 *    croissante (FEFO). Choisir un lot renseigne aussi la date de péremption.
 *  - Achat (réception) : saisie libre (nouveau lot), avec les lots EXISTANTS de l'article proposés
 *    (réception dans un lot déjà connu) ; choisir un lot existant reprend sa date de péremption.
 *  - Vente d'un article sans lot en stock : saisie libre.
 */
export default function LotCell({ sens, line, patch }: {
  sens: Sens;
  line: LigneDoc;
  patch: (key: number, p: Partial<LigneDoc>) => void;
}) {
  const estVente = sens === 'vente';
  const { data } = useQuery(LOTS, {
    variables: { article_id: line.id_article },
    skip: !line.id_article,
  });

  const tous = (Array.isArray(data?.lots) ? data.lots : [])
    .filter((l: any) => String(l.n_lot ?? '').trim() !== '')
    .sort((a: any, b: any) => String(a.date_peremption ?? '').localeCompare(String(b.date_peremption ?? '')));
  const lots = tous.filter((l: any) => Number(l.qte) > 0);

  // Pas de sélection de lot possible → saisie libre (achat, ou vente sans stock lot)
  if (!estVente || lots.length === 0) {
    const listeId = !estVente && tous.length ? `lots-${line.key}` : undefined;
    return (
      <>
        <input value={line.n_lot ?? ''} placeholder="—" list={listeId}
               title={listeId ? 'Nouveau lot, ou lot existant de l’article (liste)' : undefined}
               onChange={(e) => {
                 const v = e.target.value;
                 // Lot existant choisi dans la liste : sa péremption est reprise
                 const existant = listeId ? tous.find((l: any) => String(l.n_lot) === v) : undefined;
                 patch(line.key, existant?.date_peremption
                   ? { n_lot: v, date_peremption: isoDate(existant.date_peremption) }
                   : { n_lot: v });
               }}
               className={champTexte} />
        {listeId && (
          <datalist id={listeId}>
            {tous.map((l: any) => (
              <option key={l.id} value={l.n_lot}>
                {`stock ${fmtQte(l.qte)} · ${l.date_peremption ? fmtDate(l.date_peremption) : 'sans péremption'}`}
              </option>
            ))}
          </datalist>
        )}
      </>
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
