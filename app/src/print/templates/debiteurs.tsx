import { renderToStaticMarkup } from 'react-dom/server';
import { fmtDate, fmtMoney } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { BASE_CSS, DocHeader, TotalsBlock, Societe, LINE, MUTED } from './partials';

type DebiteurRow = Record<string, unknown> & {
  code_cli?: string; raison?: string; montant?: number; nb_factures?: number; jours_retard?: number;
};
type DebiteursTotaux = {
  total_clients: number; total_factures: number; total_creances: number;
  bucket_0_30: number; bucket_30_60: number; bucket_60_plus: number;
};

/** Modèle d'impression — ÉTAT DES DÉBITEURS (créances clients + ancienneté). */
export function buildDebiteursPrint(
  { rows, totaux }: { rows: DebiteurRow[]; totaux: DebiteursTotaux },
  societe: Societe,
): PrintDocument {
  const body = (
    <div>
      <DocHeader societe={societe} docLabel="État des créances"
                 refLabel={null} numero={`${totaux.total_clients} clients`} date={fmtDate(new Date().toISOString())} />

      {/* Ventilation par ancienneté */}
      <div className="avoid-break" style={{ display: 'flex', gap: 10, marginTop: 12, marginBottom: 10 }}>
        {[
          { label: 'Total créances', v: totaux.total_creances, strong: true },
          { label: '0–30 jours', v: totaux.bucket_0_30 },
          { label: '30–60 jours', v: totaux.bucket_30_60 },
          { label: '+60 jours', v: totaux.bucket_60_plus, danger: true },
        ].map((k) => (
          <div key={k.label} style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: '9px 13px', flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: MUTED, letterSpacing: '.5px', textAlign: 'left' }}>{k.label}</div>
            <div className="mono" style={{ fontSize: 12.5, fontWeight: k.strong ? 800 : 600, marginTop: 2, color: k.danger ? '#DC2626' : undefined }}>
              {fmtMoney(k.v)}
            </div>
          </div>
        ))}
      </div>

      <table className="lines">
        <thead>
          <tr>
            <th style={{ width: '12%' }}>Code</th>
            <th>Client</th>
            <th className="r" style={{ width: '12%' }}>Factures</th>
            <th className="r" style={{ width: '12%' }}>Retard</th>
            <th className="r" style={{ width: '20%' }}>Créance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d, i) => (
            <tr key={i}>
              <td className="mono">{String(d.code_cli ?? '')}</td>
              <td style={{ fontWeight: 600 }}>{String(d.raison ?? '')}</td>
              <td className="mono r">{String(d.nb_factures ?? '')}</td>
              <td className="mono r" style={{ color: Number(d.jours_retard) > 60 ? '#DC2626' : undefined }}>
                {Number(d.jours_retard ?? 0)} j
              </td>
              <td className="mono r" style={{ fontWeight: 700, color: '#DC2626' }}>{fmtMoney(d.montant)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock
        rows={[
          { label: `${totaux.total_clients} client(s) · ${totaux.total_factures} facture(s)`, value: '' },
        ]}
        final={{ label: 'Total des créances', value: `${fmtMoney(totaux.total_creances)} DA` }}
      />
    </div>
  );

  return {
    title: 'État des créances',
    html: renderToStaticMarkup(body),
    css: BASE_CSS,
  };
}
