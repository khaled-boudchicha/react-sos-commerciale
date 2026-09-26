import { renderToStaticMarkup } from 'react-dom/server';
import { fmtDate, fmtMoney, fmtQte } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { BASE_CSS, DocHeader, TotalsBlock, Societe } from './partials';

export type JournalLigne = Record<string, unknown> & {
  date?: string | null; numero?: string | null;
  code_article?: string | null; designation?: string | null; n_lot?: string | null;
  qte?: number | null; prix_ht?: number | null; total_ttc?: number | null; total_marge?: number | null;
  raison?: string | null; fournisseur?: string | null; code_cli?: string | null; code_four?: string | null;
};

/**
 * Modèle d'impression — JOURNAL ventes/achats (ligne à ligne).
 * Une ligne = un article vendu/acheté. La marge n'est imprimée que pour les ventes.
 */
export function buildJournalPrint(
  { sens, lignes, debut, fin }:
  { sens: 'vente' | 'achat'; lignes: JournalLigne[]; debut?: string; fin?: string },
  societe: Societe,
): PrintDocument {
  const vente = sens === 'vente';
  const totTtc = lignes.reduce((s, l) => s + Number(l.total_ttc ?? 0), 0);
  const totMarge = lignes.reduce((s, l) => s + Number(l.total_marge ?? 0), 0);
  const totQte = lignes.reduce((s, l) => s + Number(l.qte ?? 0), 0);
  const periode = debut || fin ? `du ${debut ? fmtDate(debut) : '…'} au ${fin ? fmtDate(fin) : '…'}` : '';
  const titre = vente ? 'Journal des ventes' : 'Journal des achats';

  const body = (
    <div>
      <DocHeader societe={societe} docLabel={titre}
                 refLabel={null} numero={`${lignes.length} ligne(s)`} date={periode || fmtDate(new Date().toISOString())} />

      <table className="lines" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ width: '9%' }}>Date</th>
            <th style={{ width: '11%' }}>Pièce</th>
            <th style={{ width: '9%' }}>Code</th>
            <th>Désignation</th>
            <th style={{ width: '9%' }}>Lot</th>
            <th className="r" style={{ width: '6%' }}>Qté</th>
            <th className="r" style={{ width: '11%' }}>P.U. HT</th>
            <th className="r" style={{ width: '12%' }}>Total TTC</th>
            {vente && <th className="r" style={{ width: '11%' }}>Marge</th>}
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i}>
              <td>{l.date ? fmtDate(l.date) : '—'}</td>
              <td className="mono">{l.numero ?? '—'}</td>
              <td className="mono">{l.code_article ?? '—'}</td>
              <td>{l.designation ?? '—'}</td>
              <td className="mono muted">{l.n_lot ?? '—'}</td>
              <td className="mono r">{fmtQte(l.qte)}</td>
              <td className="mono r">{fmtMoney(l.prix_ht)}</td>
              <td className="mono r" style={{ fontWeight: 700 }}>{fmtMoney(l.total_ttc)}</td>
              {vente && (
                <td className="mono r" style={{ color: Number(l.total_marge ?? 0) < 0 ? '#DC2626' : undefined }}>
                  {fmtMoney(l.total_marge)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock
        rows={[
          { label: 'Quantité totale', value: fmtQte(totQte) },
          ...(vente ? [{ label: 'Marge totale', value: `${fmtMoney(totMarge)} DA` }] : []),
        ]}
        final={{ label: 'Total TTC', value: `${fmtMoney(totTtc)} DA` }}
      />
    </div>
  );

  return {
    title: `${titre}${periode ? ` — ${periode}` : ''}`,
    css: BASE_CSS,
    html: renderToStaticMarkup(body),
  };
}
