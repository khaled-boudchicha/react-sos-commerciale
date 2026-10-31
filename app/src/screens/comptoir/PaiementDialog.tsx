import { useState } from 'react';
import Dialog, { DialogButton } from '../../components/ui/Dialog';
import NumberEdit from '../../components/ui/NumberEdit';
import { fmtMoney, fmtQte } from '../../lib/format';
import { calculerEncaissement, montantsRapides } from './comptoirCalc';

export type ResultatPaiement = { recu: number; regle: number; rendu: number; credit: boolean; imprimer: boolean };

/**
 * Encaissement du ticket (portage de CacheReglements.pas) — gabarit maquette « Encaissement (F2) ».
 * Montant remis pré-rempli au net, coupures rapides, monnaie à rendre, vente à crédit pour un
 * client identifié. Entrée valide, Échap revient au ticket.
 */
export default function PaiementDialog({
  net, ticket, clientNom, articles, creditPossible, imprimerDefaut, imprimante, enCours, onValider, onClose,
}: {
  net: number;
  ticket: number;
  clientNom: string;
  articles: number;
  /** Crédit / paiement partiel : seulement pour un client identifié (pas le client de passage). */
  creditPossible: boolean;
  imprimerDefaut: boolean;
  imprimante?: string;
  enCours: boolean;
  onValider: (r: ResultatPaiement) => void;
  onClose: () => void;
}) {
  const [recu, setRecu] = useState(net);
  const [credit, setCredit] = useState(false);
  const [imprimer, setImprimer] = useState(imprimerDefaut);
  const e = calculerEncaissement(net, recu, credit);
  const insuffisant = !creditPossible && e.reste > 0;
  const rapides = montantsRapides(net);

  function valider() {
    if (enCours || insuffisant) return;
    onValider({ recu: credit ? 0 : recu, regle: e.regle, rendu: e.rendu, credit, imprimer });
  }

  return (
    <Dialog title="Encaissement" onClose={onClose} width={560}
            subtitle={`Ticket ${ticket} · ${clientNom} · ${fmtQte(articles)} article${articles > 1 ? 's' : ''}`}
            footer={<>
              <DialogButton onClick={onClose} kbd="Échap">Retour au ticket</DialogButton>
              <DialogButton kind="cash" onClick={valider} disabled={enCours || insuffisant} kbd="Entrée">
                {enCours ? 'Enregistrement…' : 'Valider la vente'}
              </DialogButton>
            </>}>
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between px-[18px] py-3.5 rounded-xl text-white bg-brand-900">
          <span className="text-base leading-[1.45] font-bold tracking-[1px] uppercase">Net à payer</span>
          <span className="money text-display leading-[1.45] font-extrabold">{fmtMoney(net)} <span className="text-lg leading-[1.45] opacity-80">DA</span></span>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="comptoir-recu" className="text-sm leading-[1.45] font-bold text-ink-label">Montant remis par le client</label>
          <div className="flex items-center h-[72px] rounded-xl px-[18px]"
               style={{ border: `2px solid ${credit ? 'var(--line)' : 'var(--brand-500)'}`, boxShadow: credit ? undefined : '0 0 0 4px rgb(59 102 245 / .12)' }}>
            <div className="flex-1 min-w-0 [&_input]:w-full" id="comptoir-recu-box">
              <NumberEdit size="montant" value={credit ? 0 : recu} onChange={setRecu} onEnter={valider}
                          autoFocus disabled={credit} min={0} step={100} ariaLabel="Montant remis par le client" />
            </div>
            <span className="text-[15px] font-extrabold ml-2.5 text-ink-muted">DA</span>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {rapides.map((m, i) => {
              const sel = !credit && Math.abs(recu - m) < 0.005;
              return (
                <button key={m} type="button" disabled={credit} onClick={() => setRecu(m)} aria-pressed={sel}
                        className={`money h-[46px] rounded-md text-md leading-[1.45] disabled:opacity-40 ${sel ? 'font-extrabold text-brand-text bg-brand-50 border-2 border-brand-700' : 'font-bold text-ink-label bg-surface border border-line hover:border-brand-300'}`}>
                  {i === 0 ? 'Exact' : fmtMoney(m, 0)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <div className={`rounded-xl px-4 py-3 flex flex-col gap-0.5 border ${e.rendu > 0 ? 'bg-success-soft border-success-line' : 'bg-bg border-line-soft'}`}>
            <span className={`text-sm leading-[1.45] font-bold ${e.rendu > 0 ? '' : 'text-ink-label'}`} style={e.rendu > 0 ? { color: 'var(--pos-ok-text)' } : undefined}>Monnaie à rendre</span>
            <span className={`money text-[30px] font-extrabold ${e.rendu > 0 ? 'text-success-solid' : 'text-ink-label'}`}>{fmtMoney(e.rendu)}</span>
          </div>
          <div className="rounded-xl px-4 py-3 flex flex-col gap-0.5"
               style={e.reste > 0 ? { background: 'var(--pos-return-soft)', border: '1px solid var(--pos-return-line)' } : { background: 'var(--bg)', border: '1px solid var(--line-soft)' }}>
            <span className={`text-sm leading-[1.45] font-bold ${e.reste > 0 ? 'text-warning-text' : 'text-ink-label'}`}>
              {creditPossible ? 'Reste (crédit client)' : 'Reste dû'}
            </span>
            <span className={`money text-[30px] font-extrabold ${e.reste > 0 ? 'text-warning-text' : 'text-ink-label'}`}>{fmtMoney(e.reste)}</span>
          </div>
        </div>

        {insuffisant && (
          <div role="alert" className="px-3 py-2 rounded-lg text-[12.5px] font-bold text-warning-text" style={{ background: 'var(--pos-return-soft)' }}>
            Client de passage : le montant remis doit couvrir le net à payer. Choisissez un client (F8) pour une vente à crédit.
          </div>
        )}

        <div className="flex flex-col gap-2.5 px-3.5 py-3 rounded-xl border border-line-soft">
          <label className="flex items-center gap-2.5 text-base leading-[1.45] font-semibold cursor-pointer">
            <input type="checkbox" checked={imprimer} onChange={(ev) => setImprimer(ev.target.checked)}
                   className="w-[18px] h-[18px] accent-brand-700" />
            Imprimer le ticket <span className="font-medium text-ink-muted">({imprimante || 'imprimante par défaut'}, 80 mm)</span>
          </label>
          <label className={`flex items-center gap-2.5 text-base leading-[1.45] font-semibold cursor-pointer ${creditPossible ? '' : 'text-ink-muted'}`}>
            <input type="checkbox" checked={credit} disabled={!creditPossible} onChange={(ev) => setCredit(ev.target.checked)}
                   className="w-[18px] h-[18px] accent-brand-700" />
            {creditPossible ? 'Vente à crédit — rien n’est encaissé, le montant s’ajoute au crédit du client' : 'Vente à crédit — choisissez d’abord un client (F8)'}
          </label>
        </div>
      </div>
    </Dialog>
  );
}
