import { renderToStaticMarkup } from 'react-dom/server';
import { fmtDate, fmtMoney } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { Societe } from './partials';
import { TICKET_CSS } from './ticket';

/** Reçu de transfert d'espèces entre caisses (arrêt de caisse), format ticket 80 mm. */
export function buildRecuTransfertPrint(
  { source, destination, montant, date, utilisateur, observation, societe }: {
    source: string; destination: string; montant: number; date: string;
    utilisateur?: string | null; observation?: string | null; societe: Societe;
  },
): PrintDocument {
  const s = societe || {};
  const body = (
    <div>
      <div className="center b" style={{ fontSize: 12 }}>{String(s.raison_sociale || 'Société')}</div>
      <div className="sep" />
      <div className="center b">REÇU DE TRANSFERT</div>
      <div className="sep" />
      <table>
        <tbody>
          <tr><td>Date</td><td className="r">{fmtDate(date)}</td></tr>
          <tr><td>De</td><td className="r">{source}</td></tr>
          <tr><td>Vers</td><td className="r">{destination}</td></tr>
          {utilisateur ? <tr><td>Caissier</td><td className="r">{utilisateur}</td></tr> : null}
        </tbody>
      </table>
      <div className="sep" />
      <table>
        <tbody>
          <tr className="b" style={{ fontSize: 12 }}><td>MONTANT</td><td className="r">{fmtMoney(montant)} DA</td></tr>
        </tbody>
      </table>
      {observation ? <><div className="sep" /><div>{observation}</div></> : null}
      <div className="sep" />
      <div className="center">Signature : ____________________</div>
    </div>
  );
  return { title: 'Reçu de transfert', html: renderToStaticMarkup(body), css: TICKET_CSS };
}
