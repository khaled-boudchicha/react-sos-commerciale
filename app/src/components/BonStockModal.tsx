import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { CREATE_BON_ENTREE, CREATE_BON_SORTIE, REFERENTIELS } from '../api/queries';
import { Article } from '../api/types';
import { fmtMoney, fmtQte, isoToday } from '../lib/format';
import { useSession } from '../store/session';
import ArticleSearch from './ArticleSearch';
import { useToast } from './ui/Toast';

export type SensBon = 'entree' | 'sortie';

/** Ligne en cours de saisie (valeurs texte tant que l'utilisateur tape). */
type LigneSaisie = { article: Article; qte: string; prix: string };

/** Nom affichable d'un dépôt de REFERENTIELS ({id, code, designation}, forme variable selon l'agent). */
export function nomDepot(d: any): string {
  return String(d?.designation ?? d?.nom ?? d?.depot ?? d?.code ?? d?.name ?? d ?? '');
}

/** Coût unitaire par défaut d'une entrée : PMP, sinon dernier prix d'achat. */
function coutDefaut(a: Article): number {
  const pmp = Number(a.pmp ?? 0);
  return pmp > 0 ? pmp : Number(a.prix_achat_ht ?? 0);
}

/**
 * Saisie d'un bon d'entrée (réception hors achat, retour, production…) ou d'un
 * bon de sortie (casse, consommation interne…). Le stock est recalculé côté
 * serveur ; une sortie est refusée si le stock est insuffisant.
 */
export default function BonStockModal({ sens, onClose, onDone }: {
  sens: SensBon; onClose: () => void; onDone: () => void;
}) {
  const user = useSession((s) => s.dossierUser);
  const toast = useToast();
  const [date, setDate] = useState(isoToday());
  const [depotId, setDepotId] = useState('');
  const [motif, setMotif] = useState('');
  const [observation, setObservation] = useState('');
  const [lignes, setLignes] = useState<LigneSaisie[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: refs } = useQuery(REFERENTIELS);
  const depots: any[] = Array.isArray(refs?.depots) ? refs.depots : [];
  const [creer, { loading }] = useMutation(sens === 'entree' ? CREATE_BON_ENTREE : CREATE_BON_SORTIE);

  const entree = sens === 'entree';
  const titre = entree ? "Nouveau bon d'entrée" : 'Nouveau bon de sortie';

  function ajouter(a: Article) {
    setLignes((ls) => {
      // Article déjà présent : on incrémente plutôt que dupliquer (cas du scan répété).
      const i = ls.findIndex((l) => l.article.id === a.id);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qte: String((parseFloat(l.qte) || 0) + 1) } : l));
      return [...ls, { article: a, qte: '1', prix: String(coutDefaut(a)) }];
    });
  }
  const maj = (i: number, patch: Partial<LigneSaisie>) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const retirer = (i: number) => setLignes((ls) => ls.filter((_, j) => j !== i));

  const total = lignes.reduce((s, l) => s + (parseFloat(l.qte) || 0) * (entree ? (parseFloat(l.prix) || 0) : coutDefaut(l.article)), 0);
  const depassements = entree ? [] : lignes.filter((l) => (parseFloat(l.qte) || 0) > Number(l.article.qte_reale ?? 0));

  async function valider() {
    setError(null);
    if (lignes.length === 0) { setError('Ajoutez au moins un article.'); return; }
    if (lignes.some((l) => !(parseFloat(l.qte) > 0))) { setError('Toutes les quantités doivent être positives.'); return; }
    const d = depots.find((x) => String(x.id) === depotId);
    try {
      const { data } = await creer({ variables: { input: {
        date,
        motif: motif || undefined,
        observation: observation || undefined,
        depot: d ? nomDepot(d) : undefined,
        depot_id: d?.id != null ? Number(d.id) : undefined,
        agent: user?.username,
        lignes: lignes.map((l) => ({
          id_article: l.article.id,
          qte: parseFloat(l.qte),
          // Sortie : le serveur valorise au PMP ; on ne force pas de prix.
          prix_unitaire: entree ? (parseFloat(l.prix) || 0) : undefined,
        })),
      } } });
      const bon = entree ? data?.createBonEntree : data?.createBonSortie;
      toast.success(`${entree ? "Bon d'entrée" : 'Bon de sortie'} ${bon?.numero ?? ''} enregistré.`);
      onDone();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Erreur.');
    }
  }

  const inputCls = 'mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgb(15 26 46 / .45)' }}>
      <div className="w-[860px] max-h-full flex flex-col bg-surface border border-line-soft rounded-lg shadow-lifted">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft flex-none">
          <div className="font-extrabold text-[15px]">{titre}</div>
          <button onClick={onClose} className="text-ink-muted text-[18px] px-2">✕</button>
        </div>

        <div className="px-5 py-4 overflow-auto flex flex-col gap-3.5">
          {error && (
            <div className="text-[12px] rounded-md px-3 py-2"
                 style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>{error}</div>
          )}

          <div className="grid grid-cols-12 gap-3">
            <label className="col-span-3 text-[11px] font-bold text-ink-label">Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </label>
            <label className="col-span-4 text-[11px] font-bold text-ink-label">Dépôt
              <select value={depotId} onChange={(e) => setDepotId(e.target.value)} className={inputCls}>
                <option value="">— défaut —</option>
                {depots.map((d, i) => <option key={d?.id ?? i} value={String(d?.id ?? '')}>{nomDepot(d)}</option>)}
              </select>
            </label>
            <label className="col-span-5 text-[11px] font-bold text-ink-label">Motif
              <input value={motif} onChange={(e) => setMotif(e.target.value)}
                     placeholder={entree ? 'Réception, retour, production…' : 'Casse, consommation interne…'} className={inputCls} />
            </label>
            <label className="col-span-12 text-[11px] font-bold text-ink-label">Observation
              <input value={observation} onChange={(e) => setObservation(e.target.value)} className={inputCls} />
            </label>
          </div>

          <ArticleSearch onSelect={ajouter} autoFocus />

          <div className="border border-line-soft rounded-md overflow-hidden">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr>
                  {['Article', 'Stock', 'Quantité', entree ? 'Coût unitaire' : 'PMP', 'Total', ''].map((h, i) => (
                    <th key={i} className={`text-[10px] font-bold uppercase tracking-wider text-ink-muted bg-bg border-b border-line-soft px-3 py-2 ${i >= 1 && i <= 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-muted">Recherchez un article pour l'ajouter.</td></tr>
                )}
                {lignes.map((l, i) => {
                  const q = parseFloat(l.qte) || 0;
                  const stock = Number(l.article.qte_reale ?? 0);
                  const insuffisant = !entree && q > stock;
                  const pu = entree ? (parseFloat(l.prix) || 0) : coutDefaut(l.article);
                  return (
                    <tr key={l.article.id} className="border-b border-line-soft last:border-b-0">
                      <td className="px-3 py-1">
                        <b>{l.article.designation}</b>
                        <span className="block money text-[10.5px] text-ink-muted">{l.article.code}{l.article.unite_mesure ? ` · ${l.article.unite_mesure}` : ''}</span>
                      </td>
                      <td className="px-3 py-1 text-right money" style={{ color: insuffisant ? 'var(--danger)' : 'var(--text-muted)' }}>{fmtQte(stock)}</td>
                      <td className="w-[110px] px-2">
                        <input type="number" step="any" min="0" value={l.qte} onChange={(e) => maj(i, { qte: e.target.value })}
                               className="w-full border border-line rounded-sm px-2 py-1.5 bg-surface text-right money text-[12px]"
                               style={insuffisant ? { borderColor: 'var(--danger)' } : undefined} />
                      </td>
                      <td className="w-[130px] px-2 text-right">
                        {entree ? (
                          <input type="number" step="0.01" min="0" value={l.prix} onChange={(e) => maj(i, { prix: e.target.value })}
                                 className="w-full border border-line rounded-sm px-2 py-1.5 bg-surface text-right money text-[12px]" />
                        ) : <span className="money text-ink-muted">{fmtMoney(pu)}</span>}
                      </td>
                      <td className="px-3 py-1 text-right money font-semibold">{fmtMoney(q * pu)}</td>
                      <td className="w-[40px] px-2 text-right">
                        <button onClick={() => retirer(i)} title="Retirer"
                                className="px-1.5 py-0.5 rounded-sm border border-line text-[11px]" style={{ color: 'var(--danger)' }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {lignes.length > 0 && (
                <tbody>
                  <tr className="bg-bg font-bold">
                    <td className="px-3 py-2" colSpan={4}>{lignes.length} ligne(s)</td>
                    <td className="px-3 py-2 text-right money">{fmtMoney(total)}</td>
                    <td />
                  </tr>
                </tbody>
              )}
            </table>
          </div>

          {depassements.length > 0 && (
            <div className="text-[12px] rounded-md px-3 py-2"
                 style={{ background: 'color-mix(in srgb, var(--warning) 12%, transparent)', color: 'var(--warning)' }}>
              Stock insuffisant pour {depassements.length} article(s) : la sortie sera refusée par le serveur.
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end px-5 py-3.5 border-t border-line-soft flex-none">
          <button onClick={onClose} disabled={loading}
                  className="px-4 py-2 rounded-md border border-line text-ink-label font-bold text-[12px] disabled:opacity-60">Annuler</button>
          <button onClick={() => void valider()} disabled={loading || lignes.length === 0}
                  className="px-5 py-2 rounded-md bg-brand-700 text-white font-bold text-[12px] disabled:opacity-60">
            {loading ? 'Enregistrement…' : 'Enregistrer le bon'}
          </button>
        </div>
      </div>
    </div>
  );
}
