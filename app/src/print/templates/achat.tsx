import { renderToStaticMarkup } from 'react-dom/server';
import { fmtDate, fmtMoney, fmtQte } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { BASE_CSS, DocHeader, TiersBlock, TotalsBlock, SignFooter, Societe, MUTED } from './partials';

type AchatPrint = Record<string, any>;

/** Modèle d'impression — pièce d'ACHAT (FA / BR / BC / DO / avoir / retour). */
export function buildAchatPrint(achat: AchatPrint, societe: Societe): PrintDocument {
  const lignes: Record<string, any>[] = Array.isArray(achat.lignes) ? achat.lignes : [];

  const body = (
    <div>
      <DocHeader societe={societe} docLabel={String(achat.type_doc)} numero={String(achat.numero)} date={fmtDate(achat.date)} />
      <TiersBlock label="Fournisseur"
                  nom={String(achat.fournisseur ?? achat.raison ?? achat.code_four ?? '—')}
                  detail={achat.tel ? `Tél : ${achat.tel}` : null} societe={societe} />

      <table className="lines" style={{ marginTop: 4 }}>
        <thead>
          <tr>
            <th style={{ width: '14%' }}>Code</th>
            <th>Désignation</th>
            <th style={{ width: '11%' }}>Lot</th>
            <th className="r" style={{ width: '8%' }}>Qté</th>
            <th className="r" style={{ width: '14%' }}>Coût HT</th>
            <th className="r" style={{ width: '8%' }}>TVA</th>
            <th className="r" style={{ width: '16%' }}>Total TTC</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.id}>
              <td className="mono">{String(l.code_article ?? '')}</td>
              <td>{String(l.designation ?? '')}</td>
              <td className="mono muted">{l.n_lot ? String(l.n_lot) : '—'}</td>
              <td className="mono r">{fmtQte(l.qte)}</td>
              <td className="mono r">{fmtMoney(l.prix_ht)}</td>
              <td className="mono r">{fmtQte(l.tva)}%</td>
              <td className="mono r" style={{ fontWeight: 600 }}>{fmtMoney(l.total_ttc)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock
        rows={[
          { label: 'Total HT', value: fmtMoney(achat.total_ht) },
          ...(achat.tva != null ? [{ label: 'TVA', value: fmtMoney(achat.tva) }] : []),
          ...(Number(achat.remise) > 0 ? [{ label: 'Remise', value: fmtMoney(achat.remise) }] : []),
        ]}
        final={{ label: 'Net à payer', value: `${fmtMoney(achat.net_a_payer)} DA` }}
      />

      {Number(achat.regler) > 0 && (
        <div className="avoid-break" style={{ textAlign: 'right', marginTop: 6, fontSize: 10.5, color: MUTED }}>
          Réglé : <span className="mono">{fmtMoney(achat.regler)}</span>
          {' · '}Reste : <span className="mono">{fmtMoney(achat.reste_a_payer)}</span>
        </div>
      )}

      <SignFooter arreteA={`${fmtMoney(achat.net_a_payer)} DA`} />
    </div>
  );

  return {
    title: `${achat.type_doc} ${achat.numero}`,
    html: renderToStaticMarkup(body),
    css: BASE_CSS,
  };
}
