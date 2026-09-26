import { renderToStaticMarkup } from 'react-dom/server';
import { fmtDate, fmtMoney } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { BASE_CSS, DocHeader, TotalsBlock, Societe } from './partials';

export type BordereauLigne = {
  numero?: string | null;
  date?: string | null;
  tiers?: string | null;
  mode_payement?: string | null;
  net?: number | null;
  regler?: number | null;
  reste?: number | null;
};

/**
 * Modèle d'impression — BORDEREAU (liste des pièces d'une période).
 * Générique vente/achat : une ligne par document, avec net à payer / réglé / reste.
 */
export function buildBordereauPrint(
  { titre, tiersLabel, lignes, debut, fin }:
  { titre: string; tiersLabel: string; lignes: BordereauLigne[]; debut?: string; fin?: string },
  societe: Societe,
): PrintDocument {
  const totNet = lignes.reduce((s, l) => s + Number(l.net ?? 0), 0);
  const totRegle = lignes.reduce((s, l) => s + Number(l.regler ?? 0), 0);
  const totReste = lignes.reduce((s, l) => s + Number(l.reste ?? 0), 0);
  const periode = debut || fin ? `du ${debut ? fmtDate(debut) : '…'} au ${fin ? fmtDate(fin) : '…'}` : '';

  const body = (
    <div>
      <DocHeader societe={societe} docLabel={titre}
                 refLabel={null} numero={`${lignes.length} pièce(s)`} date={periode || fmtDate(new Date().toISOString())} />

      <table className="lines" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ width: '14%' }}>N° pièce</th>
            <th style={{ width: '11%' }}>Date</th>
            <th>{tiersLabel}</th>
            <th style={{ width: '11%' }}>Mode</th>
            <th className="r" style={{ width: '14%' }}>Net à payer</th>
            <th className="r" style={{ width: '13%' }}>Réglé</th>
            <th className="r" style={{ width: '13%' }}>Reste</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i}>
              <td className="mono">{l.numero ?? '—'}</td>
              <td>{l.date ? fmtDate(l.date) : '—'}</td>
              <td>{l.tiers ?? '—'}</td>
              <td className="muted">{l.mode_payement ?? '—'}</td>
              <td className="mono r">{fmtMoney(l.net)}</td>
              <td className="mono r">{fmtMoney(l.regler)}</td>
              <td className="mono r" style={{ color: Number(l.reste ?? 0) > 0 ? '#DC2626' : undefined }}>{fmtMoney(l.reste)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock
        rows={[
          { label: 'Total net', value: `${fmtMoney(totNet)} DA` },
          { label: 'Total réglé', value: `${fmtMoney(totRegle)} DA` },
        ]}
        final={{ label: 'Total reste dû', value: `${fmtMoney(totReste)} DA` }}
      />
    </div>
  );

  return {
    title: `${titre}${periode ? ` — ${periode}` : ''}`,
    css: BASE_CSS,
    html: renderToStaticMarkup(body),
  };
}
