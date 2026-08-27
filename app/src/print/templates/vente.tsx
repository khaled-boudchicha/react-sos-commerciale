import { renderToStaticMarkup } from 'react-dom/server';
import { Vente, LigneVente } from '../../api/types';
import { fmtDate, fmtMoney, fmtQte } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { BASE_CSS, DocHeader, TiersBlock, TotalsBlock, SignFooter, Societe, MUTED } from './partials';

/** Modèle d'impression — pièce de VENTE (FA / BL / BCT / BC / FP / avoir / retour). */
export function buildVentePrint(vente: Vente, societe: Societe): PrintDocument {
  const lignes: LigneVente[] = vente.lignes ?? [];

  const body = (
    <div>
      <DocHeader societe={societe} docLabel={vente.type_doc} numero={vente.numero} date={fmtDate(vente.date)} />
      <TiersBlock label="Client" nom={vente.raison || vente.code_cli || 'Comptoir'}
                  detail={vente.tel ? `Tél : ${vente.tel}` : null} societe={societe} />

      <table className="lines" style={{ marginTop: 4 }}>
        <thead>
          <tr>
            <th style={{ width: '14%' }}>Code</th>
            <th>Désignation</th>
            <th className="r" style={{ width: '8%' }}>Qté</th>
            <th className="r" style={{ width: '14%' }}>P.U. HT</th>
            <th className="r" style={{ width: '8%' }}>Rem.</th>
            <th className="r" style={{ width: '8%' }}>TVA</th>
            <th className="r" style={{ width: '16%' }}>Total TTC</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.id}>
              <td className="mono">{l.code_article}</td>
              <td>{l.designation}{l.n_lot ? <span className="muted"> · lot {l.n_lot}</span> : null}</td>
              <td className="mono r">{fmtQte(l.qte)}</td>
              <td className="mono r">{fmtMoney(l.prix_ht)}</td>
              <td className="mono r">{fmtQte(l.remise ?? 0)}%</td>
              <td className="mono r">{fmtQte(l.tva)}%</td>
              <td className="mono r" style={{ fontWeight: 600 }}>{fmtMoney(l.total_ttc)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock
        rows={[
          { label: 'Total HT', value: fmtMoney(vente.total_ht) },
          ...(vente.tva != null ? [{ label: 'TVA', value: fmtMoney(vente.tva) }] : []),
          ...(Number(vente.total_taxe) > 0 ? [{ label: 'Timbre / Taxes', value: fmtMoney(vente.total_taxe) }] : []),
          ...(Number(vente.remise) > 0 ? [{ label: 'Remise', value: fmtMoney(vente.remise) }] : []),
        ]}
        final={{ label: 'Net à payer', value: `${fmtMoney(vente.net_a_payer)} DA` }}
      />

      {Number(vente.regler) > 0 && (
        <div className="avoid-break" style={{ textAlign: 'right', marginTop: 6, fontSize: 10.5, color: MUTED }}>
          Réglé : <span className="mono">{fmtMoney(vente.regler)}</span>
          {' · '}Reste : <span className="mono">{fmtMoney(vente.reste_a_payer)}</span>
        </div>
      )}

      <SignFooter arreteA={`${fmtMoney(vente.net_a_payer)} DA`} />
    </div>
  );

  return {
    title: `${vente.type_doc} ${vente.numero}`,
    html: renderToStaticMarkup(body),
    css: BASE_CSS,
  };
}
