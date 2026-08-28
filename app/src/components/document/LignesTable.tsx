import { useEffect, useRef, useState } from 'react';
import { fmtMoney, fmtQte } from '../../lib/format';
import {
  LigneDoc, Sens, ColonneId, colonnesPour, useColonnesConfig,
  netHtLigne, totalTtcLigne, prixTtcUnitaire, remiseMontantLigne,
  depuisPrixTtc, depuisRemiseMontant,
} from './lignesDocument';
import LotCell from './LotCell';

const cellNum = 'w-full bg-transparent text-right money text-[12px] px-2 py-1.5 border border-transparent rounded-sm focus:border-brand-500 focus:bg-surface';

/** Nombre édité sans imposer un 0 collant : champ vide toléré pendant la saisie. */
function num(v: string): number { return parseFloat(v) || 0; }

export default function LignesTable({ sens, lignes, patch, remove }: {
  sens: Sens;
  lignes: LigneDoc[];
  patch: (key: number, p: Partial<LigneDoc>) => void;
  remove: (key: number) => void;
}) {
  const { visibles, basculer, reinitialiser } = useColonnesConfig(sens);
  const vis = (id: ColonneId) => visibles.has(id);
  const prixLabel = sens === 'achat' ? 'Coût HT' : 'P.U. HT';

  // Colonnes visibles → nb pour le colSpan du message vide
  const nbCol = 3 /* article, qté, prix_ht */ + 2 /* tva, total_ttc */ + 1 /* suppr */
    + [...visibles].length;

  return (
    <div className="bg-surface border border-line-soft rounded-md shadow-soft">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-line-soft">
        <span className="text-[11px] font-bold text-ink-muted">{lignes.length} ligne(s)</span>
        <SelecteurColonnes sens={sens} visibles={visibles} basculer={basculer} reinitialiser={reinitialiser} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr>
              <Th>Article</Th>
              {vis('tarif') && <Th right>Tarif</Th>}
              <Th right>Qté</Th>
              {vis('colis') && <Th right>Colis</Th>}
              <Th right>{prixLabel}</Th>
              {vis('prix_ttc') && <Th right>P.U. TTC</Th>}
              <Th right>Rem. %</Th>
              {vis('remise_montant') && <Th right>Rem. montant</Th>}
              <Th right>TVA %</Th>
              {vis('lot') && <Th>N° lot</Th>}
              {vis('peremption') && <Th>Péremption</Th>}
              {vis('total_ht') && <Th right>Total HT</Th>}
              <Th right>Total TTC</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 && (
              <tr><td colSpan={nbCol} className="px-3 py-8 text-center text-ink-muted">
                Recherchez un article ci-dessus, ou scannez un code-barres. Entrée pour l'ajouter.
              </td></tr>
            )}
            {lignes.map((l) => (
              <tr key={l.key} className="border-b border-line-soft last:border-b-0">
                <td className="px-3 py-1">
                  <b>{l.designation}</b>
                  <span className="money text-[10.5px] text-ink-muted"> · {l.code_article}</span>
                  {l.stock !== undefined && (() => {
                    const rupture = sens === 'vente' && l.qte > l.stock!;
                    return (
                      <span className={`text-[10.5px] ml-1 ${rupture ? 'font-semibold' : 'text-ink-muted'}`}
                            style={rupture ? { color: 'var(--danger)' } : undefined}>
                        · stock {fmtQte(l.stock)}{rupture ? ' ⚠ dépasse le stock' : ''}
                      </span>
                    );
                  })()}
                </td>

                {vis('tarif') && (
                  <td className="w-[70px]">
                    <select value={l.tarif ?? 1}
                            onChange={(e) => {
                              const t = Number(e.target.value);
                              const prix = l.prixTiers?.[t - 1];
                              patch(l.key, { tarif: t, ...(prix ? { prix_ht: prix } : {}) });
                            }}
                            className="w-full bg-transparent text-[11px] px-1 py-1.5 border border-transparent rounded-sm focus:border-brand-500 focus:bg-surface">
                      {[1, 2, 3, 4].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                )}

                <td className="w-[74px]"><input type="number" min="0" step="any" value={l.qte}
                  onChange={(e) => patch(l.key, { qte: num(e.target.value) })} className={cellNum} /></td>

                {vis('colis') && (
                  <td className="w-[70px]"><input type="number" min="0" step="1" value={l.colis ?? ''}
                    placeholder="—" onChange={(e) => patch(l.key, { colis: num(e.target.value) })} className={cellNum} /></td>
                )}

                <td className="w-[100px]"><input type="number" min="0" step="0.01" value={l.prix_ht}
                  onChange={(e) => patch(l.key, { prix_ht: num(e.target.value) })} className={cellNum} /></td>

                {vis('prix_ttc') && (
                  <td className="w-[100px]"><input type="number" min="0" step="0.01" value={round2(prixTtcUnitaire(l))}
                    onChange={(e) => patch(l.key, depuisPrixTtc(l, num(e.target.value)))} className={cellNum} /></td>
                )}

                <td className="w-[72px]"><input type="number" min="0" max="100" step="0.5" value={l.remise}
                  onChange={(e) => patch(l.key, { remise: num(e.target.value) })} className={cellNum} /></td>

                {vis('remise_montant') && (
                  <td className="w-[100px]"><input type="number" min="0" step="0.01" value={round2(remiseMontantLigne(l))}
                    onChange={(e) => patch(l.key, depuisRemiseMontant(l, num(e.target.value)))} className={cellNum} /></td>
                )}

                <td className="w-[62px] text-right money px-3">{fmtQte(l.tva)}</td>

                {vis('lot') && (
                  <td className="w-[150px]"><LotCell sens={sens} line={l} patch={patch} /></td>
                )}

                {vis('peremption') && (
                  <td className="w-[130px]"><input type="date" value={l.date_peremption ?? ''}
                    onChange={(e) => patch(l.key, { date_peremption: e.target.value })}
                    className="w-full bg-transparent text-[11px] px-2 py-1.5 border border-transparent rounded-sm focus:border-brand-500 focus:bg-surface" /></td>
                )}

                {vis('total_ht') && (
                  <td className="w-[105px] text-right money px-3">{fmtMoney(netHtLigne(l))}</td>
                )}

                <td className="w-[110px] text-right money font-semibold px-3">{fmtMoney(totalTtcLigne(l))}</td>

                <td className="w-[34px] text-center">
                  <button onClick={() => remove(l.key)} title="Supprimer la ligne"
                          className="text-ink-muted hover:text-[color:var(--danger)] font-bold">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th className={`text-[10px] font-bold uppercase tracking-wider text-ink-muted bg-bg border-b border-line-soft px-3 py-2 ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

/** Bouton engrenage + popover de sélection des colonnes visibles. */
function SelecteurColonnes({ sens, visibles, basculer, reinitialiser }: {
  sens: Sens; visibles: Set<ColonneId>; basculer: (id: ColonneId) => void; reinitialiser: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [ouvert]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOuvert((v) => !v)}
              title="Choisir les colonnes affichées"
              className="rounded-md px-2.5 py-1 text-[11px] font-semibold border border-line-soft bg-surface hover:bg-surface-alt">
        ⚙ Colonnes
      </button>
      {ouvert && (
        <div className="absolute right-0 mt-1 z-20 w-56 bg-surface border border-line-soft rounded-md shadow-lifted p-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted px-1 pb-1">Colonnes affichées</div>
          {colonnesPour(sens).map((c) => (
            <label key={c.id} className="flex items-center gap-2 px-1 py-1 text-[12px] cursor-pointer hover:bg-surface-alt rounded-sm">
              <input type="checkbox" checked={visibles.has(c.id)} onChange={() => basculer(c.id)} />
              {c.label}
            </label>
          ))}
          <button type="button" onClick={reinitialiser}
                  className="mt-1 w-full text-left px-1 py-1 text-[11px] font-semibold text-brand-700 hover:underline">
            Réinitialiser
          </button>
        </div>
      )}
    </div>
  );
}
