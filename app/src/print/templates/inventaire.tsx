import { renderToStaticMarkup } from 'react-dom/server';
import { fmtDate, fmtMoney, fmtQte } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { BASE_CSS, DocHeader, TotalsBlock, Societe } from './partials';

export type InventaireLigne = {
  code_article: string; designation: string; depot?: string | null;
  qte_theorique: number; qte_reale: number; ecart: number;
  prix_pmp?: number; valeur_theorique?: number; valeur_reale?: number;
};
export type InventaireEntete = {
  designation?: string | null; date?: string | null;
  valeur_theorique?: number; valeur_reale?: number; ecart_valeur?: number;
};

/**
 * Modèle d'impression — FEUILLE D'INVENTAIRE.
 *  - `vierge = true` : feuille de comptage à remplir à la main (colonne « Compté »
 *    vide, sans écart) — pour parcourir les rayons.
 *  - sinon : état chiffré (théorique / compté / écart + valorisation).
 */
export function buildInventairePrint(
  { inv, lignes, vierge = false }: { inv: InventaireEntete; lignes: InventaireLigne[]; vierge?: boolean },
  societe: Societe,
): PrintDocument {
  const titre = vierge ? 'Feuille de comptage' : 'Inventaire — état';
  const sousTitre = inv.designation || `${lignes.length} article(s)`;

  const body = (
    <div>
      <DocHeader societe={societe} docLabel={titre}
                 refLabel={null} numero={sousTitre} date={inv.date ? fmtDate(inv.date) : fmtDate(new Date().toISOString())} />

      <table className="lines" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ width: '11%' }}>Code</th>
            <th>Désignation</th>
            <th style={{ width: '11%' }}>Dépôt</th>
            <th className="r" style={{ width: '11%' }}>Théorique</th>
            <th className="r" style={{ width: '13%' }}>Compté</th>
            {!vierge && <th className="r" style={{ width: '10%' }}>Écart</th>}
            {!vierge && <th className="r" style={{ width: '13%' }}>Valeur écart</th>}
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => {
            const ecartVal = Number(l.valeur_reale ?? 0) - Number(l.valeur_theorique ?? 0);
            return (
              <tr key={i}>
                <td className="mono">{l.code_article}</td>
                <td>{l.designation}</td>
                <td className="muted">{l.depot ?? '—'}</td>
                <td className="mono r">{fmtQte(l.qte_theorique)}</td>
                <td className="mono r" style={{ minWidth: 60 }}>{vierge ? '' : fmtQte(l.qte_reale)}</td>
                {!vierge && (
                  <td className="mono r" style={{ fontWeight: 700, color: l.ecart < 0 ? '#DC2626' : l.ecart > 0 ? '#059669' : undefined }}>
                    {l.ecart > 0 ? '+' : ''}{fmtQte(l.ecart)}
                  </td>
                )}
                {!vierge && (
                  <td className="mono r" style={{ color: ecartVal < 0 ? '#DC2626' : undefined }}>{fmtMoney(ecartVal)}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {!vierge && (
        <TotalsBlock
          rows={[
            { label: 'Valeur théorique', value: `${fmtMoney(inv.valeur_theorique)} DA` },
            { label: 'Valeur comptée', value: `${fmtMoney(inv.valeur_reale)} DA` },
          ]}
          final={{ label: 'Écart de valorisation', value: `${fmtMoney(inv.ecart_valeur)} DA` }}
        />
      )}
    </div>
  );

  return { title: `${titre} — ${sousTitre}`, css: BASE_CSS, html: renderToStaticMarkup(body) };
}
