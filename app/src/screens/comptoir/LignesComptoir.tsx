import { useEffect, useRef } from 'react';
import NumberEdit from '../../components/ui/NumberEdit';
import Icon, { Kbd } from '../../components/ui/Icon';
import {
  LigneDoc, depuisPrixTtc, depuisRemiseMontant, prixTtcUnitaire, remiseMontantLigne, totalTtcLigne,
} from '../../components/document/lignesDocument';
import { fmtDate, fmtMoney, fmtQte } from '../../lib/format';

/** Colonnes de la grille (maquette) : # · article · P.U. TTC · quantité · remise · montant · supprimer. */
const COLONNES = '44px minmax(0,1fr) 132px 148px 112px 132px 52px';

/**
 * Lignes du ticket (DBGRID de ComptoirMixts) : lignes de 66 px, ligne active surlignée
 * (fond bleu 50 + anneau), prix / quantité / remise éditables, alerte de stock en rouge.
 */
export default function LignesComptoir({
  lignes, selection, onSelect, patch, remove, retour, articles, tuilesMasquees, onAfficherTuiles,
}: {
  lignes: LigneDoc[];
  selection: number | null;
  onSelect: (key: number) => void;
  patch: (key: number, p: Partial<LigneDoc>) => void;
  remove: (key: number) => void;
  retour: boolean;
  articles: number;
  tuilesMasquees: boolean;
  onAfficherTuiles: () => void;
}) {
  const actifRef = useRef<HTMLDivElement>(null);
  useEffect(() => { actifRef.current?.scrollIntoView({ block: 'nearest' }); }, [selection]);
  const secondaire = { color: 'var(--text-secondary)' };
  // Remises affichées TTC, comme le prix unitaire et le montant de la ligne
  const remisesTtc = lignes.reduce((s, l) => s + remiseTtc(l), 0);

  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-xl bg-surface border border-line-soft shadow-soft overflow-hidden">
      <div className="grid items-center h-10 px-2 border-b border-line-soft text-[10.5px] font-bold tracking-[.6px] uppercase flex-none"
           style={{ gridTemplateColumns: COLONNES, ...secondaire }}>
        <span className="text-center">#</span><span>Article</span>
        <span className="text-right pr-2.5">P.U. TTC</span><span className="text-center">Quantité</span>
        <span className="text-right pr-2.5">Remise</span><span className="text-right pr-2">Montant</span><span />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {lignes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6" style={secondaire}>
            <span style={{ color: retour ? 'var(--pos-return)' : 'var(--brand-500)' }}><Icon name={retour ? 'retour' : 'panier'} size={34} strokeWidth={1.6} /></span>
            <span className="text-[15px] font-bold text-ink">{retour ? 'Retour : scannez les articles rendus' : 'Ticket vide'}</span>
            <span className="text-[13px]">Scannez un code-barres, tapez une désignation (F6) ou touchez une tuile article.</span>
          </div>
        ) : lignes.map((l, i) => {
          const actif = l.key === selection;
          const survente = !retour && l.stock != null && l.qte > l.stock;
          const remise = remiseTtc(l);
          return (
            <div key={l.key} ref={actif ? actifRef : undefined} onMouseDown={() => onSelect(l.key)}
                 className="grid items-center min-h-[66px] px-2 border-b border-line-soft"
                 style={{
                   gridTemplateColumns: COLONNES,
                   background: actif ? (retour ? 'var(--pos-return-soft)' : 'var(--brand-50)') : undefined,
                   boxShadow: actif ? `inset 0 0 0 2px ${retour ? 'var(--pos-return-line)' : 'var(--brand-300)'}` : undefined,
                 }}>
              <span className="money text-center text-[12px]" style={secondaire}>{i + 1}</span>
              <div className="flex flex-col gap-[3px] min-w-0 pr-2 py-2">
                <span className="text-[15px] font-bold leading-[1.2]">{l.designation}</span>
                <span className="money text-[11px] flex flex-wrap gap-x-3" style={secondaire}>
                  <span>{l.code_article}</span>
                  {l.n_lot ? <span>Lot {l.n_lot}{l.date_peremption ? ` · exp. ${fmtMoisAnnee(l.date_peremption)}` : ''}</span> : null}
                  {l.stock != null && (
                    <span style={survente ? { color: 'var(--pos-alert)', fontWeight: 700 } : undefined}>
                      stock {fmtQte(l.stock)}{survente ? ' — insuffisant' : ''}
                    </span>
                  )}
                </span>
              </div>
              <div className="px-1.5">
                <NumberEdit size="pos" value={round2(prixTtcUnitaire(l))} min={0} ariaLabel={`Prix unitaire TTC, ligne ${i + 1}`}
                            onChange={(v) => patch(l.key, depuisPrixTtc(l, v))} />
              </div>
              <div className="px-1.5">
                <NumberEdit size="pos" spin value={l.qte} decimals={3} minDecimals={0} min={0.001} step={1}
                            className="!text-center !text-[16px] !font-bold" ariaLabel={`Quantité, ligne ${i + 1}`}
                            onChange={(v) => patch(l.key, { qte: v > 0 ? v : l.qte })} />
              </div>
              <div className="px-1.5">
                <NumberEdit size="pos" value={round2(remise)} min={0} ariaLabel={`Remise, ligne ${i + 1}`}
                            className={remise > 0 ? '!text-[var(--pos-amber)]' : '!text-[var(--text-secondary)]'}
                            onChange={(v) => patch(l.key, depuisRemiseMontant(l, v / (1 + (l.tva || 0) / 100)))} />
              </div>
              <span className="money text-right pr-2 text-[16px] font-extrabold">{fmtMoney(totalTtcLigne(l))}</span>
              <button type="button" onClick={() => remove(l.key)} aria-label={`Supprimer la ligne ${i + 1}`} tabIndex={-1}
                      className="w-[38px] h-[38px] justify-self-center rounded-lg flex items-center justify-center hover:bg-[var(--pos-alert-soft)] hover:text-[var(--pos-alert)]"
                      style={secondaire}>
                <Icon name="corbeille" size={18} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex-none flex items-center gap-[22px] h-11 px-[18px] border-t border-line-soft text-[12px] font-semibold text-ink-label"
           style={{ background: 'var(--surface-sunken)' }}>
        <span><b className="money text-ink">{lignes.length}</b> ligne{lignes.length > 1 ? 's' : ''} · <b className="money text-ink">{fmtQte(articles)}</b> article{articles > 1 ? 's' : ''}</span>
        <span>Remises lignes <b className="money text-ink">{fmtMoney(remisesTtc)}</b></span>
        {tuilesMasquees && (
          <button type="button" onClick={onAfficherTuiles} className="font-bold text-brand-900">Afficher les tuiles</button>
        )}
        <span className="ml-auto flex gap-3.5" style={secondaire}>
          <span className="flex items-center gap-1.5"><Kbd>↑ ↓</Kbd> ligne</span>
          <span className="flex items-center gap-1.5"><Kbd>+ −</Kbd> quantité</span>
          <span className="flex items-center gap-1.5"><Kbd>Suppr</Kbd> retirer</span>
        </span>
      </div>
    </div>
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Remise de la ligne en montant TTC (le champ canonique reste le % sur le HT). */
const remiseTtc = (l: LigneDoc) => remiseMontantLigne(l) * (1 + (l.tva || 0) / 100);

/** « 2027-03-31 » → « 03/2027 » (format de la maquette). */
function fmtMoisAnnee(d: string): string {
  const f = fmtDate(d);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(f);
  return m ? `${m[2]}/${m[3]}` : f;
}
