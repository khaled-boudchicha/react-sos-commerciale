import { renderToStaticMarkup } from 'react-dom/server';
import { Article } from '../../api/types';
import { fmtDate, fmtMoney, fmtQte } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { BASE_CSS, DocHeader, TotalsBlock, Societe } from './partials';

/** Modèle d'impression — ÉTAT DU STOCK (liste articles + valeur au PMP). */
export function buildStockPrint(
  { articles, filtre }: { articles: Article[]; filtre?: string },
  societe: Societe,
): PrintDocument {
  const valeurPmp = articles.reduce((s, a) => {
    const q = Number(a.qte_reale ?? 0);
    return s + (q > 0 ? q * Number(a.pmp ?? 0) : 0);
  }, 0);
  const enAlerte = articles.filter((a) => Number(a.stock_min ?? 0) > 0 && Number(a.qte_reale ?? 0) <= Number(a.stock_min)).length;

  const body = (
    <div>
      <DocHeader societe={societe} docLabel="État du stock"
                 numero={filtre || `${articles.length} articles`} date={fmtDate(new Date().toISOString())} />

      <table className="lines" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ width: '11%' }}>Code</th>
            <th>Désignation</th>
            <th style={{ width: '13%' }}>Famille</th>
            <th className="r" style={{ width: '12%' }}>PMP</th>
            <th className="r" style={{ width: '12%' }}>P.V. TTC</th>
            <th className="r" style={{ width: '9%' }}>Stock</th>
            <th className="r" style={{ width: '13%' }}>Valeur (PMP)</th>
          </tr>
        </thead>
        <tbody>
          {articles.map((a) => {
            const q = Number(a.qte_reale ?? 0);
            return (
              <tr key={a.id}>
                <td className="mono">{a.code}</td>
                <td>{a.designation}</td>
                <td className="muted">{a.famille ?? '—'}</td>
                <td className="mono r">{fmtMoney(a.pmp)}</td>
                <td className="mono r">{fmtMoney(a.prix_vente_ttc)}</td>
                <td className="mono r" style={{ fontWeight: 700, color: q <= 0 ? '#DC2626' : Number(a.stock_min ?? 0) > 0 && q <= Number(a.stock_min) ? '#D97706' : undefined }}>
                  {fmtQte(q)}
                </td>
                <td className="mono r">{fmtMoney(q > 0 ? q * Number(a.pmp ?? 0) : 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <TotalsBlock
        rows={[
          { label: `${articles.length} article(s)`, value: '' },
          { label: 'Dont en alerte', value: String(enAlerte) },
        ]}
        final={{ label: 'Valeur du stock (PMP)', value: `${fmtMoney(valeurPmp)} DA` }}
      />
    </div>
  );

  return {
    title: 'État du stock',
    html: renderToStaticMarkup(body),
    css: BASE_CSS,
  };
}
