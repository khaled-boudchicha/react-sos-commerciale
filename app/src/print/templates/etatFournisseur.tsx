import { renderToStaticMarkup } from 'react-dom/server';
import { fmtDate, fmtMoney } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { BASE_CSS, DocHeader, TotalsBlock, Societe, LINE, MUTED, INK } from './partials';

export type EtatFournisseurSolde = {
  code_four: string; nom?: string | null; credit_initial?: number | null;
  total_achats?: number | null; total_retours?: number | null; solde_depart?: number | null;
  regler?: number | null; remboursements?: number | null; credit?: number | null;
};
export type EtatFournisseurLigne = {
  type_doc: string; numero?: string | null; date: string; montant: number;
  total_cumul: number; mode_payement?: string | null;
};

/** Modèle d'impression — ÉTAT / relevé FOURNISSEUR (chronologie + solde cumulé). */
export function buildEtatFournisseurPrint(
  { fournisseur, lignes, debut, fin }: {
    fournisseur: EtatFournisseurSolde; lignes: EtatFournisseurLigne[]; debut?: string; fin?: string;
  },
  societe: Societe,
): PrintDocument {
  const periode = debut || fin
    ? `Période : ${debut ? fmtDate(debut) : '…'} → ${fin ? fmtDate(fin) : '…'}`
    : 'Relevé complet';

  const body = (
    <div>
      <DocHeader societe={societe} docLabel="Relevé fournisseur"
                 numero={fournisseur.code_four} date={fmtDate(new Date().toISOString())} />

      <div className="avoid-break" style={{ display: 'flex', gap: 10, marginTop: 12, marginBottom: 10 }}>
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: '9px 13px', flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: MUTED, letterSpacing: '.5px' }}>Fournisseur</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{fournisseur.nom || fournisseur.code_four}</div>
          <div style={{ fontSize: 10, color: MUTED }}>{periode}</div>
        </div>
        {[
          { label: 'Total achats', v: fournisseur.total_achats },
          { label: 'Crédit initial', v: fournisseur.credit_initial },
          { label: 'Réglé', v: fournisseur.regler },
          { label: 'Solde', v: fournisseur.credit, strong: true },
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
          { label: 'Total achats', value: fmtMoney(fournisseur.total_achats) },
          { label: 'Total retours', value: fmtMoney(fournisseur.total_retours) },
          { label: 'Total réglé', value: fmtMoney(fournisseur.regler) },
          ...(Number(fournisseur.remboursements) !== 0 ? [{ label: 'Remboursements', value: fmtMoney(fournisseur.remboursements) }] : []),
        ]}
        final={{ label: 'Solde dû', value: `${fmtMoney(fournisseur.credit)} DA` }}
      />
    </div>
  );

  return {
    title: `Relevé ${fournisseur.nom || fournisseur.code_four}`,
    html: renderToStaticMarkup(body),
    css: BASE_CSS,
  };
}
