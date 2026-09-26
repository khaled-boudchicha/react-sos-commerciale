import { renderToStaticMarkup } from 'react-dom/server';
import { MouvementTresorie, TresorieCompleteResult } from '../../api/types';
import { fmtDate, fmtMoney } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { BASE_CSS, DocHeader, TotalsBlock, Societe, LINE, MUTED } from './partials';

/** Modèle d'impression — ÉTAT DE TRÉSORERIE (mouvements période, solde initial/final). */
export function buildTresoreriePrint(
  { res, compte, debut, fin }: { res: TresorieCompleteResult; compte: string; debut?: string; fin?: string },
  societe: Societe,
): PrintDocument {
  const rows: MouvementTresorie[] = res.data ?? [];
  const periode = `${debut ? fmtDate(debut) : '…'} → ${fin ? fmtDate(fin) : '…'}`;

  const body = (
    <div>
      <DocHeader societe={societe} docLabel="État de trésorerie" refLabel="Compte" numero={compte} date={fmtDate(new Date().toISOString())} />

      <div className="avoid-break" style={{ display: 'flex', gap: 10, marginTop: 12, marginBottom: 10 }}>
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: '9px 13px', flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: MUTED, letterSpacing: '.5px' }}>Compte</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{compte}</div>
          <div style={{ fontSize: 10, color: MUTED }}>Période : {periode}</div>
        </div>
        {[
          { label: 'Solde initial', v: res.solde_initial },
          { label: 'Crédits', v: res.total_credit, color: '#16A34A' },
          { label: 'Débits', v: res.total_debit, color: '#DC2626' },
          { label: 'Solde final', v: res.solde_final, strong: true },
        ].map((k) => (
          <div key={k.label} style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: '9px 13px', minWidth: '30mm', textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: MUTED, letterSpacing: '.5px', textAlign: 'left' }}>{k.label}</div>
            <div className="mono" style={{ fontSize: 12, fontWeight: k.strong ? 800 : 600, marginTop: 2, color: k.color }}>
              {fmtMoney(k.v)}
            </div>
          </div>
        ))}
      </div>

      <table className="lines">
        <thead>
          <tr>
            <th style={{ width: '11%' }}>Date</th>
            <th style={{ width: '15%' }}>Catégorie</th>
            <th>Tiers / libellé</th>
            <th style={{ width: '11%' }}>Mode</th>
            <th className="r" style={{ width: '16%' }}>Montant</th>
            <th className="r" style={{ width: '16%' }}>Solde cumulé</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.cle}>
              <td>{fmtDate(m.date)}</td>
              <td style={{ fontWeight: 600 }}>{m.categorie ?? m.cle?.replace(/\d+$/, '') ?? '—'}</td>
              <td>{m.tier || m.objet || m.code_tier || m.observation || '—'}</td>
              <td className="muted">{m.mode_payement ?? '—'}</td>
              <td className="mono r" style={{ fontWeight: 600, color: Number(m.montant) >= 0 ? '#16A34A' : '#DC2626' }}>
                {Number(m.montant) >= 0 ? '+' : ''}{fmtMoney(m.montant)}
              </td>
              <td className="mono r">{fmtMoney(m.solde_cumul)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock
        rows={[
          { label: `${res.total} mouvement(s)`, value: '' },
          { label: 'Total crédits', value: fmtMoney(res.total_credit) },
          { label: 'Total débits', value: fmtMoney(res.total_debit) },
        ]}
        final={{ label: 'Solde final', value: `${fmtMoney(res.solde_final)} DA` }}
      />
    </div>
  );

  return {
    title: `Trésorerie ${compte}`,
    html: renderToStaticMarkup(body),
    css: BASE_CSS,
  };
}
