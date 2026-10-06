import { renderToStaticMarkup } from 'react-dom/server';
import { fmtDate, fmtMoney, fmtQte } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { Societe } from './partials';
import { TICKET_CSS } from './ticket';

export type TicketVentesLigne = { libelle: string; qte: number; total_ttc: number };

/**
 * Ticket de caisse 80 mm « Articles vendus » ou « Familles vendues » : liste des libellés
 * (article ou famille) avec quantité et CA TTC, sur la période choisie.
 */
export function buildTicketVentesPrint(
  { titre, debut, fin, lignes, societe }: { titre: string; debut: string; fin: string; lignes: TicketVentesLigne[]; societe: Societe },
): PrintDocument {
  const s = societe || {};
  const total = lignes.reduce((t, l) => t + (Number(l.total_ttc) || 0), 0);
  const qteTotale = lignes.reduce((t, l) => t + (Number(l.qte) || 0), 0);

  const body = (
    <div>
      <div className="center b" style={{ fontSize: 12 }}>{String(s.raison_sociale || 'Société')}</div>
      <div className="sep" />
      <div className="center b">{titre}</div>
      <div className="center">Du {fmtDate(debut)} au {fmtDate(fin)}</div>
      <div className="sep" />
      <table>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i}>
              <td>{l.libelle}</td>
              <td className="r">{fmtQte(l.qte)}</td>
              <td className="r b">{fmtMoney(l.total_ttc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sep" />
      <table>
        <tbody>
          <tr className="b"><td>Quantité totale</td><td className="r">{fmtQte(qteTotale)}</td></tr>
          <tr className="b" style={{ fontSize: 12 }}><td>TOTAL TTC</td><td className="r">{fmtMoney(total)} DA</td></tr>
        </tbody>
      </table>
      <div className="sep" />
      <div className="center">{lignes.length} ligne(s)</div>
    </div>
  );

  return { title: titre, html: renderToStaticMarkup(body), css: TICKET_CSS };
}
