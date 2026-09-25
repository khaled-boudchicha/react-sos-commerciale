import { renderToStaticMarkup } from 'react-dom/server';
import { fmtDate, fmtMoney, fmtQte } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { BASE_CSS, DocHeader, TotalsBlock, Societe, LINE, MUTED } from './partials';

export type BonStockLigne = {
  id?: number; id_article?: number; code_article?: string | null; designation?: string | null;
  qte: number; unite?: string | null; prix_unitaire?: number | null; total?: number | null;
};
export type BonStock = {
  id: number; numero?: string | null; date?: string | null; motif?: string | null;
  observation?: string | null; depot?: string | null; total_ht?: number | null;
  valeur_total?: number | null; agent?: string | null; lignes?: BonStockLigne[];
};

/** Modèle d'impression — BON D'ENTRÉE / BON DE SORTIE de stock (mouvement hors pièce commerciale). */
export function buildBonStockPrint(
  { bon, sens }: { bon: BonStock; sens: 'entree' | 'sortie' },
  societe: Societe,
): PrintDocument {
  const label = sens === 'entree' ? "Bon d'entrée" : 'Bon de sortie';
  const lignes = bon.lignes ?? [];
  const total = Number(bon.total_ht ?? bon.valeur_total ?? lignes.reduce((s, l) => s + Number(l.total ?? 0), 0));

  const body = (
    <div>
      <DocHeader societe={societe} docLabel={label} numero={bon.numero || String(bon.id)} date={fmtDate(bon.date)} />

      <div className="avoid-break" style={{ display: 'flex', gap: 10, marginTop: 12, marginBottom: 10 }}>
        {[
          { label: 'Dépôt', v: bon.depot || '—' },
          { label: 'Motif', v: bon.motif || '—' },
          { label: 'Agent', v: bon.agent || '—' },
        ].map((k) => (
          <div key={k.label} style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: '9px 13px', flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: MUTED, letterSpacing: '.5px' }}>{k.label}</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{k.v}</div>
          </div>
        ))}
      </div>

      <table className="lines">
        <thead>
          <tr>
            <th style={{ width: '14%' }}>Code</th>
            <th>Désignation</th>
            <th className="r" style={{ width: '12%' }}>Qté</th>
            <th style={{ width: '9%' }}>Unité</th>
            <th className="r" style={{ width: '15%' }}>P.U.</th>
            <th className="r" style={{ width: '16%' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={l.id ?? i}>
              <td className="mono">{l.code_article ?? ''}</td>
              <td>{l.designation ?? ''}</td>
              <td className="mono r">{fmtQte(l.qte)}</td>
              <td className="muted">{l.unite ?? ''}</td>
              <td className="mono r">{fmtMoney(l.prix_unitaire)}</td>
              <td className="mono r">{fmtMoney(l.total ?? Number(l.qte) * Number(l.prix_unitaire ?? 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock rows={[{ label: `${lignes.length} ligne(s)`, value: '' }]}
                   final={{ label: 'Valeur totale', value: `${fmtMoney(total)} DA` }} />

      {bon.observation ? <div style={{ marginTop: 10, fontSize: 10.5, color: MUTED }}>Observation : {bon.observation}</div> : null}

      <div className="avoid-break" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 26, fontSize: 10, color: MUTED }}>
        {['Magasinier', 'Visa'].map((l) => (
          <div key={l}>
            <div style={{ height: 38 }} />
            <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 4, width: '55mm' }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return {
    title: `${label} ${bon.numero || bon.id}`,
    html: renderToStaticMarkup(body),
    css: BASE_CSS,
  };
}
