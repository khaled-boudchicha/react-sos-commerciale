import { renderToStaticMarkup } from 'react-dom/server';
import { fmtDate, fmtMoney } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { BASE_CSS, DocHeader, TiersBlock, TotalsBlock, Societe } from './partials';

type FactureNR = {
  id: number; numero: string; type_facture: string; date: string;
  net_a_payer: number; regler: number; reste_a_payer: number; mode_payement?: string | null;
};

/** Modèle d'impression — FACTURES NON RÉGLÉES d'un client (situation des impayés). */
export function buildFacturesNonRegleesPrint(
  { codeCli, nom, factures }: { codeCli: string; nom: string; factures: FactureNR[] },
  societe: Societe,
): PrintDocument {
  const totalDu = factures.reduce((s, f) => s + Number(f.reste_a_payer || 0), 0);
  const totalMontant = factures.reduce((s, f) => s + Number(f.net_a_payer || 0), 0);
  const totalRegle = factures.reduce((s, f) => s + Number(f.regler || 0), 0);

  const body = (
    <div>
      <DocHeader societe={societe} docLabel="Situation des impayés"
                 numero={codeCli} date={fmtDate(new Date().toISOString())} />
      <TiersBlock label="Client" nom={nom || codeCli} societe={societe} />

      <table className="lines" style={{ marginTop: 4 }}>
        <thead>
          <tr>
            <th style={{ width: '20%' }}>Type</th>
            <th style={{ width: '18%' }}>N°</th>
            <th style={{ width: '13%' }}>Date</th>
            <th style={{ width: '13%' }}>Mode</th>
            <th className="r" style={{ width: '13%' }}>Montant</th>
            <th className="r" style={{ width: '11%' }}>Réglé</th>
            <th className="r" style={{ width: '12%' }}>Reste</th>
          </tr>
        </thead>
        <tbody>
          {factures.map((f) => (
            <tr key={f.id}>
              <td style={{ fontWeight: 600 }}>{f.type_facture}</td>
              <td className="mono">{f.numero}</td>
              <td>{fmtDate(f.date)}</td>
              <td className="muted">{f.mode_payement ?? '—'}</td>
              <td className="mono r">{fmtMoney(f.net_a_payer)}</td>
              <td className="mono r">{fmtMoney(f.regler)}</td>
              <td className="mono r" style={{ fontWeight: 700, color: '#DC2626' }}>{fmtMoney(f.reste_a_payer)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock
        rows={[
          { label: `${factures.length} pièce(s)`, value: '' },
          { label: 'Total facturé', value: fmtMoney(totalMontant) },
          { label: 'Total réglé', value: fmtMoney(totalRegle) },
        ]}
        final={{ label: 'Total dû', value: `${fmtMoney(totalDu)} DA` }}
      />
    </div>
  );

  return {
    title: `Impayés ${nom || codeCli}`,
    html: renderToStaticMarkup(body),
    css: BASE_CSS,
  };
}
