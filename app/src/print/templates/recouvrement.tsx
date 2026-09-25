import { renderToStaticMarkup } from 'react-dom/server';
import { fmtDate, fmtMoney } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { BASE_CSS, DocHeader, TotalsBlock, Societe, LINE, MUTED } from './partials';

export type RecouvrementLigne = {
  code_cli: string; raison: string; tel?: string | null; nb_pieces: number;
  total_du: number; du_en_retard: number; echu: number; b_0_30: number; b_31_60: number; b_61_90: number; b_90_plus: number;
  plus_ancienne?: string | null; derniere?: string | null; jours_max: number;
};
export type RecouvrementTotaux = {
  total_du: number; du_en_retard: number; echu: number; b_0_30: number; b_31_60: number; b_61_90: number; b_90_plus: number;
};

/** Modèle d'impression — ÉTAT DE RECOUVREMENT (créances en retard, ancienneté par client). */
export function buildRecouvrementPrint(
  { rows, totaux, nbrjour, inactifs }: { rows: RecouvrementLigne[]; totaux: RecouvrementTotaux; nbrjour: number; inactifs: boolean },
  societe: Societe,
): PrintDocument {
  const critere = inactifs ? `Clients sans pièce depuis plus de ${nbrjour} jours` : `Créances de plus de ${nbrjour} jours`;
  const body = (
    <div>
      <DocHeader societe={societe} docLabel="État de recouvrement"
                 numero={`${rows.length} clients`} date={fmtDate(new Date().toISOString())} />
      <div style={{ fontSize: 11, marginTop: 8, color: MUTED }}>{critere}</div>

      <div className="avoid-break" style={{ display: 'flex', gap: 8, marginTop: 10, marginBottom: 10 }}>
        {[
          { label: 'Total dû', v: totaux.total_du, strong: true },
          { label: 'En retard', v: totaux.du_en_retard, danger: true },
          { label: 'Échu', v: totaux.echu, danger: true },
          { label: '0–30 j', v: totaux.b_0_30 },
          { label: '31–60 j', v: totaux.b_31_60 },
          { label: '61–90 j', v: totaux.b_61_90 },
          { label: '+90 j', v: totaux.b_90_plus, danger: true },
        ].map((k) => (
          <div key={k.label} style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: '8px 10px', flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', color: MUTED, textAlign: 'left' }}>{k.label}</div>
            <div className="mono" style={{ fontSize: 11.5, fontWeight: k.strong ? 800 : 600, marginTop: 2, color: k.danger ? '#DC2626' : undefined }}>
              {fmtMoney(k.v)}
            </div>
          </div>
        ))}
      </div>

      <table className="lines">
        <thead>
          <tr>
            <th>Client</th>
            <th style={{ width: '11%' }}>Téléphone</th>
            <th className="r" style={{ width: '6%' }}>Pièces</th>
            <th className="r" style={{ width: '10%' }}>Plus ancienne</th>
            <th className="r" style={{ width: '12%' }}>Dû total</th>
            <th className="r" style={{ width: '12%' }}>En retard</th>
            <th className="r" style={{ width: '11%' }}>Échu</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code_cli}>
              <td><b>{r.raison}</b> <span className="mono" style={{ color: MUTED, fontSize: 9 }}>{r.code_cli}</span></td>
              <td className="mono">{r.tel || '—'}</td>
              <td className="mono r">{r.nb_pieces}</td>
              <td className="mono r">{fmtDate(r.plus_ancienne)} <span style={{ color: MUTED }}>({r.jours_max} j)</span></td>
              <td className="mono r">{fmtMoney(r.total_du)}</td>
              <td className="mono r" style={{ fontWeight: 700, color: '#DC2626' }}>{fmtMoney(r.du_en_retard)}</td>
              <td className="mono r">{fmtMoney(r.echu)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock
        rows={[{ label: 'Total dû', value: fmtMoney(totaux.total_du) }]}
        final={{ label: 'Total en retard', value: `${fmtMoney(totaux.du_en_retard)} DA` }}
      />
    </div>
  );
  return { title: 'État de recouvrement', html: renderToStaticMarkup(body), css: BASE_CSS };
}
