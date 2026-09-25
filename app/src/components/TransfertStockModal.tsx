import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { TRANSFERT_STOCK, REFERENTIELS } from '../api/queries';
import { Article } from '../api/types';
import { fmtQte, isoToday } from '../lib/format';
import { useSession } from '../store/session';
import ArticleSearch from './ArticleSearch';
import { nomDepot } from './BonStockModal';
import { useToast } from './ui/Toast';

type LigneSaisie = { article: Article; qte: string };

/**
 * Transfert de marchandise d'un dépôt à un autre. Côté serveur, il produit un
 * bon de sortie (dépôt source) et un bon d'entrée (dépôt destination) liés par
 * un même code : supprimer l'un supprime l'autre.
 */
export default function TransfertStockModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const user = useSession((s) => s.dossierUser);
  const toast = useToast();
  const [date, setDate] = useState(isoToday());
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [observation, setObservation] = useState('');
  const [lignes, setLignes] = useState<LigneSaisie[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: refs } = useQuery(REFERENTIELS);
  const depots: any[] = Array.isArray(refs?.depots) ? refs.depots : [];
  // Sans dépôt paramétré, on laisse la saisie libre (dossiers mono-dépôt anciens).
  const saisieLibre = depots.length === 0;
  const [transferer, { loading }] = useMutation(TRANSFERT_STOCK);

  function ajouter(a: Article) {
    setLignes((ls) => {
      const i = ls.findIndex((l) => l.article.id === a.id);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qte: String((parseFloat(l.qte) || 0) + 1) } : l));
      return [...ls, { article: a, qte: '1' }];
    });
  }
  const maj = (i: number, qte: string) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, qte } : l)));
  const retirer = (i: number) => setLignes((ls) => ls.filter((_, j) => j !== i));
  const depassements = lignes.filter((l) => (parseFloat(l.qte) || 0) > Number(l.article.qte_reale ?? 0));

  // Résout le nom + l'id d'un dépôt à partir de la valeur du champ (id en mode liste, texte en saisie libre).
  function resoudre(v: string): { nom: string; id?: number } {
    if (saisieLibre) return { nom: v.trim() };
    const d = depots.find((x) => String(x.id) === v);
    return { nom: d ? nomDepot(d) : v, id: d?.id != null ? Number(d.id) : undefined };
  }

  async function valider() {
    setError(null);
    const src = resoudre(source);
    const dst = resoudre(destination);
    if (!src.nom || !dst.nom) { setError('Choisissez les dépôts source et destination.'); return; }
    if (src.nom === dst.nom) { setError('Les deux dépôts doivent être différents.'); return; }
    if (lignes.length === 0) { setError('Ajoutez au moins un article.'); return; }
    if (lignes.some((l) => !(parseFloat(l.qte) > 0))) { setError('Toutes les quantités doivent être positives.'); return; }
    try {
      const { data } = await transferer({ variables: { input: {
        date,
        depot_source: src.nom, depot_destination: dst.nom,
        depot_source_id: src.id, depot_destination_id: dst.id,
        observation: observation || undefined,
        agent: user?.username,
        lignes: lignes.map((l) => ({ id_article: l.article.id, qte: parseFloat(l.qte) })),
      } } });
      toast.success(`Transfert ${data?.transfertStock?.code ?? ''} enregistré.`);
      onDone();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Erreur.');
    }
  }

  const inputCls = 'mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal';

  function champDepot(value: string, onChange: (v: string) => void, exclure?: string) {
    if (saisieLibre) {
      return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Nom du dépôt" className={inputCls} />;
    }
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">— choisir —</option>
        {depots.filter((d) => String(d?.id) !== exclure).map((d, i) => (
          <option key={d?.id ?? i} value={String(d?.id ?? '')}>{nomDepot(d)}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgb(15 26 46 / .45)' }}>
      <div className="w-[760px] max-h-full flex flex-col bg-surface border border-line-soft rounded-lg shadow-lifted">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft flex-none">
          <div>
            <div className="font-extrabold text-[15px]">Nouveau transfert entre dépôts</div>
            <div className="text-[11px] text-ink-muted">Génère un bon de sortie et un bon d'entrée liés</div>
          </div>
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
            <label className="col-span-4 text-[11px] font-bold text-ink-label">Dépôt source
              {champDepot(source, setSource)}
            </label>
            <label className="col-span-5 text-[11px] font-bold text-ink-label">Dépôt destination
              {champDepot(destination, setDestination, saisieLibre ? undefined : source)}
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
                  {['Article', 'Stock actuel', 'Quantité', ''].map((h, i) => (
                    <th key={i} className={`text-[10px] font-bold uppercase tracking-wider text-ink-muted bg-bg border-b border-line-soft px-3 py-2 ${i === 1 || i === 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-ink-muted">Recherchez un article pour l'ajouter.</td></tr>
                )}
                {lignes.map((l, i) => {
                  const stock = Number(l.article.qte_reale ?? 0);
                  const insuffisant = (parseFloat(l.qte) || 0) > stock;
                  return (
                    <tr key={l.article.id} className="border-b border-line-soft last:border-b-0">
                      <td className="px-3 py-1">
                        <b>{l.article.designation}</b>
                        <span className="block money text-[10.5px] text-ink-muted">{l.article.code}{l.article.depot ? ` · ${l.article.depot}` : ''}</span>
                      </td>
                      <td className="px-3 py-1 text-right money" style={{ color: insuffisant ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {fmtQte(stock)}{insuffisant ? ' ⚠' : ''}
                      </td>
                      <td className="w-[120px] px-2">
                        <input type="number" step="any" min="0" value={l.qte} onChange={(e) => maj(i, e.target.value)}
                               className="w-full border border-line rounded-sm px-2 py-1.5 bg-surface text-right money text-[12px]"
                               style={insuffisant ? { borderColor: 'var(--danger)' } : undefined} />
                      </td>
                      <td className="w-[40px] px-2 text-right">
                        <button onClick={() => retirer(i)} title="Retirer"
                                className="px-1.5 py-0.5 rounded-sm border border-line text-[11px]" style={{ color: 'var(--danger)' }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {depassements.length > 0 && (
            <div className="text-[12px] rounded-md px-3 py-2"
                 style={{ background: 'color-mix(in srgb, var(--warning) 12%, transparent)', color: 'var(--warning)' }}>
              Quantité supérieure au stock pour {depassements.length} article(s) : le transfert risque d'être refusé.
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end px-5 py-3.5 border-t border-line-soft flex-none">
          <button onClick={onClose} disabled={loading}
                  className="px-4 py-2 rounded-md border border-line text-ink-label font-bold text-[12px] disabled:opacity-60">Annuler</button>
          <button onClick={() => void valider()} disabled={loading || lignes.length === 0}
                  className="px-5 py-2 rounded-md bg-brand-700 text-white font-bold text-[12px] disabled:opacity-60">
            {loading ? 'Enregistrement…' : 'Valider le transfert'}
          </button>
        </div>
      </div>
    </div>
  );
}
