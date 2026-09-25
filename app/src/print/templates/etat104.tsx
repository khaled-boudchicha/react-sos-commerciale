import { renderToStaticMarkup } from 'react-dom/server';
import { fmtDate, fmtMoney } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { BASE_CSS, DocHeader, TotalsBlock, Societe, MUTED } from './partials';

export type Etat104Ligne = {
  code_cli: string; raison: string; adresse?: string | null;
  rc?: string | null; nif?: string | null; nis?: string | null; art?: string | null;
  nb_pieces: number; montant_ht: number; tva: number; montant_ttc: number; incomplet: boolean;
};
export type Etat104Totaux = { nb_clients: number; montant_ht: number; tva: number; montant_ttc: number; incomplets: number };

/**
 * Modèle d'impression — ÉTAT 104 (Statistique104.pas) : chiffre d'affaires par
 * client avec identifiants fiscaux, annexe de la déclaration annuelle.
 * Paysage : les colonnes RC / NIF / NIS / Art. ne tiennent pas en portrait.
 */
export function buildEtat104Print(
  { rows, totaux, debut, fin, inclureBl }: { rows: Etat104Ligne[]; totaux: Etat104Totaux; debut: string; fin: string; inclureBl: boolean },
  societe: Societe,
): PrintDocument {
  const body = (
    <div>
      <DocHeader societe={societe} docLabel="État 104" numero={`${fmtDate(debut)} → ${fmtDate(fin)}`} date={fmtDate(new Date().toISOString())} />
      <div style={{ fontSize: 10.5, marginTop: 8, color: MUTED }}>
        Chiffre d’affaires par client — factures de vente{inclureBl ? ' et bons de livraison non facturés' : ''}, déduction faite des avoirs.
      </div>
      <table className="lines" style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>Client</th>
            <th style={{ width: '11%' }}>RC</th>
            <th style={{ width: '12%' }}>NIF</th>
            <th style={{ width: '12%' }}>NIS</th>
            <th style={{ width: '9%' }}>Art. imp.</th>
            <th className="r" style={{ width: '12%' }}>Montant HT</th>
            <th className="r" style={{ width: '10%' }}>TVA</th>
            <th className="r" style={{ width: '12%' }}>Montant TTC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code_cli || r.raison}>
              <td><b>{r.raison}</b>{r.adresse ? <div style={{ fontSize: 8.5, color: MUTED }}>{r.adresse}</div> : null}</td>
              <td className="mono">{r.rc || '—'}</td>
              <td className="mono" style={{ color: r.incomplet ? '#DC2626' : undefined }}>{r.nif || 'manquant'}</td>
              <td className="mono">{r.nis || '—'}</td>
              <td className="mono">{r.art || '—'}</td>
              <td className="mono r">{fmtMoney(r.montant_ht)}</td>
              <td className="mono r">{fmtMoney(r.tva)}</td>
              <td className="mono r" style={{ fontWeight: 700 }}>{fmtMoney(r.montant_ttc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <TotalsBlock
        rows={[
          { label: `${totaux.nb_clients} client(s)`, value: '' },
          { label: 'Total HT', value: fmtMoney(totaux.montant_ht) },
          { label: 'Total TVA', value: fmtMoney(totaux.tva) },
        ]}
        final={{ label: 'Total TTC', value: `${fmtMoney(totaux.montant_ttc)} DA` }}
      />
    </div>
  );
  return { title: `État 104 ${debut.slice(0, 4)}`, html: renderToStaticMarkup(body), css: `${BASE_CSS}\n@page { size: A4 landscape; }` };
}
