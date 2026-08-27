import { renderToStaticMarkup } from 'react-dom/server';
import { fmtDate, fmtMoney } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { BASE_CSS, DocHeader, TotalsBlock, Societe, LINE, MUTED, INK } from './partials';

type CreditDetails = {
  code_cli: string; nom_client: string; credit_initial: number; total_ventes: number;
  total_avoirs: number; regler: number; credit: number; solde_avance: number; ca: number;
};
type EtatLigne = {
  type_doc: string; numero?: string | null; date: string; montant: number;
  total_cumul: number; mode_payement?: string | null;
};

/** Modèle d'impression — ÉTAT / relevé client (chronologique avec solde cumulé). */
export function buildEtatClientPrint(
  { client, lignes, debut, fin }: { client: CreditDetails; lignes: EtatLigne[]; debut?: string; fin?: string },
  societe: Societe,
): PrintDocument {
  const periode = debut || fin
    ? `Période : ${debut ? fmtDate(debut) : '…'} → ${fin ? fmtDate(fin) : '…'}`
    : 'Relevé complet';

  const body = (
    <div>
      <DocHeader societe={societe} docLabel="Relevé client"
                 numero={client.code_cli} date={fmtDate(new Date().toISOString())} />

      {/* Cartouche client + synthèse financière */}
      <div className="avoid-break" style={{ display: 'flex', gap: 10, marginTop: 12, marginBottom: 10 }}>
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: '9px 13px', flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: MUTED, letterSpacing: '.5px' }}>Client</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{client.nom_client || client.code_cli}</div>
          <div style={{ fontSize: 10, color: MUTED }}>{periode}</div>
        </div>
        {[
          { label: 'CA', v: client.ca },
          { label: 'Crédit initial', v: client.credit_initial },
          { label: 'Réglé', v: client.regler },
          { label: 'Solde', v: client.credit, strong: true },
        ].map((k) => (
          <div key={k.label} style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: '9px 13px', minWidth: '30mm', textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: MUTED, letterSpacing: '.5px' }}>{k.label}</div>
            <div className="mono" style={{ fontSize: 12, fontWeight: k.strong ? 800 : 600, marginTop: 2, color: k.strong ? INK : undefined }}>
              {fmtMoney(k.v)}
            </div>
          </div>
        ))}
      </div>

      <table className="lines">
        <thead>
          <tr>
            <th style={{ width: '12%' }}>Date</th>
            <th style={{ width: '22%' }}>Opération</th>
            <th style={{ width: '16%' }}>N°</th>
            <th style={{ width: '12%' }}>Mode</th>
            <th className="r" style={{ width: '17%' }}>Montant</th>
            <th className="r" style={{ width: '17%' }}>Solde cumulé</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i}>
              <td>{fmtDate(l.date)}</td>
              <td style={{ fontWeight: 600 }}>{l.type_doc}</td>
              <td className="mono">{l.numero ?? '—'}</td>
              <td className="muted">{l.mode_payement ?? '—'}</td>
              <td className="mono r" style={{ color: Number(l.montant) < 0 ? '#16A34A' : undefined }}>{fmtMoney(l.montant)}</td>
              <td className="mono r" style={{ fontWeight: 600 }}>{fmtMoney(l.total_cumul)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock
        rows={[
          { label: 'Total ventes', value: fmtMoney(client.total_ventes) },
          { label: 'Total avoirs', value: fmtMoney(client.total_avoirs) },
          { label: 'Total réglé', value: fmtMoney(client.regler) },
          ...(Number(client.solde_avance) !== 0 ? [{ label: 'Avances', value: fmtMoney(client.solde_avance) }] : []),
        ]}
        final={{ label: 'Solde dû', value: `${fmtMoney(client.credit)} DA` }}
      />
    </div>
  );

  return {
    title: `Relevé ${client.nom_client || client.code_cli}`,
    html: renderToStaticMarkup(body),
    css: BASE_CSS,
  };
}
