import { renderToStaticMarkup } from 'react-dom/server';
import { Vente, LigneVente } from '../../api/types';
import { fmtDate, fmtMoney, fmtQte } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { Societe } from './partials';

/** CSS ticket 80 mm (imprimantes thermiques) — indépendant de BASE_CSS (A4). */
export const TICKET_CSS = `
@page { size: 80mm auto; margin: 3mm 4mm; }
* { box-sizing: border-box; }
body {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px; line-height: 1.35; color: #000; margin: 0;
  width: 72mm;
}
.center { text-align: center; }
.r { text-align: right; }
.b { font-weight: 700; }
.sep { border-top: 1px dashed #000; margin: 4px 0; }
table { width: 100%; border-collapse: collapse; }
td { padding: 1px 0; vertical-align: top; }
tr { break-inside: avoid; }
`;

/** Informations d'encaissement connues au comptoir (non stockées sur la pièce). */
export type TicketExtras = { caissier?: string | null; recu?: number; rendu?: number };

/** Modèle d'impression — TICKET de caisse 80 mm (vente comptoir / BCT, retour BRT). */
export function buildTicketPrint(vente: Vente, societe: Societe, extras: TicketExtras = {}): PrintDocument {
  const lignes: LigneVente[] = vente.lignes ?? [];
  const s = societe || {};

  const body = (
    <div>
      <div className="center b" style={{ fontSize: 12 }}>{s.raison_sociale || 'Société'}</div>
      {s.adresse ? <div className="center">{s.adresse}</div> : null}
      {s.telephone ? <div className="center">Tél : {s.telephone}</div> : null}
      <div className="sep" />
      <table>
        <tbody>
          <tr><td>{vente.type_doc}</td><td className="r b">N° {vente.numero}</td></tr>
          <tr><td>Date</td><td className="r">{fmtDate(vente.date)}</td></tr>
          {vente.raison ? <tr><td>Client</td><td className="r">{vente.raison}</td></tr> : null}
          {(extras.caissier || vente.user_name) ? <tr><td>Caissier</td><td className="r">{extras.caissier || vente.user_name}</td></tr> : null}
        </tbody>
      </table>
      <div className="sep" />
      <table>
        <tbody>
          {lignes.map((l) => (
            <>
              <tr key={`d${l.id}`}><td colSpan={2}>{l.designation}</td></tr>
              <tr key={`m${l.id}`}>
                <td>&nbsp;&nbsp;{fmtQte(l.qte)} × {fmtMoney(l.prix_ttc ?? l.prix_ht)}</td>
                <td className="r b">{fmtMoney(l.total_ttc)}</td>
              </tr>
            </>
          ))}
        </tbody>
      </table>
      <div className="sep" />
      <table>
        <tbody>
          <tr><td>Total HT</td><td className="r">{fmtMoney(vente.total_ht)}</td></tr>
          {Number(vente.timbre) > 0 && <tr><td>Droit de timbre</td><td className="r">{fmtMoney(vente.timbre)}</td></tr>}
          <tr className="b" style={{ fontSize: 12 }}>
            <td>NET À PAYER</td><td className="r">{fmtMoney(vente.net_a_payer)} DA</td>
          </tr>
          {Number(vente.regler) > 0 ? (
            <>
              <tr><td>Réglé</td><td className="r">{fmtMoney(vente.regler)}</td></tr>
              {Number(vente.reste_a_payer) > 0 ? <tr><td>Reste</td><td className="r">{fmtMoney(vente.reste_a_payer)}</td></tr> : null}
            </>
          ) : null}
          {Number(extras.recu) > 0 ? <tr><td>Espèces reçues</td><td className="r">{fmtMoney(extras.recu)}</td></tr> : null}
          {Number(extras.rendu) > 0 ? <tr className="b"><td>Rendu</td><td className="r">{fmtMoney(extras.rendu)}</td></tr> : null}
        </tbody>
      </table>
      <div className="sep" />
      <div className="center">{lignes.length} article(s) — Merci de votre visite</div>
    </div>
  );

  return {
    title: `Ticket ${vente.numero}`,
    html: renderToStaticMarkup(body),
    css: TICKET_CSS,
  };
}
