import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLazyQuery } from '@apollo/client';
import { CLIENTS, ARTICLES, FOURNISSEURS } from '../api/queries';
import { Client, Article, Fournisseur } from '../api/types';
import { fmtMoney, fmtQte } from '../lib/format';
import { useDebouncedValue } from '../lib/useDebounce';
import { D, useDroits } from '../lib/droits';

type Item = {
  id: string;
  groupe: string;
  titre: string;
  sous?: string;
  droite?: string;
  action: () => void;
};

/** Commandes statiques : navigation + créations rapides (équivalent du ruban Delphi). */
type Droit = (d: ReturnType<typeof useDroits>) => boolean;
const STATIQUES: { groupe: string; titre: string; sous?: string; to: string; si?: Droit }[] = [
  { groupe: 'Aller à', titre: 'Tableau de bord', to: '/' },
  { groupe: 'Aller à', titre: 'Vente au comptoir', sous: 'Caisse / POS (tickets, retours)', to: '/comptoir', si: (d) => d.peutDoc('vente', 'BCT', 'creer') || d.peutDoc('vente', 'BRT', 'creer') },
  { groupe: 'Aller à', titre: 'Ventes', sous: 'Documents de vente', to: '/ventes', si: (d) => d.aModule('vente') },
  { groupe: 'Aller à', titre: 'Achats', sous: "Documents d'achat", to: '/achats', si: (d) => d.aModule('achat') },
  { groupe: 'Aller à', titre: 'Stock', sous: 'Articles & stock', to: '/stock', si: (d) => d.peut('stock', D.stock.article) },
  { groupe: 'Aller à', titre: 'Mouvements de stock', sous: "Bons d'entrée, de sortie, transferts", to: '/stock/mouvements', si: (d) => d.peutUn('stock', [D.stock.bonEntree, D.stock.bonSortie]) },
  { groupe: 'Aller à', titre: 'Inventaires', to: '/stock/inventaires', si: (d) => d.peut('stock', D.stock.inventaire) },
  { groupe: 'Aller à', titre: 'Tiers', sous: 'Clients, fournisseurs, débiteurs', to: '/tiers', si: (d) => d.peutUn('tiers', [D.tiers.clients, D.tiers.fournisseurs]) },
  { groupe: 'Aller à', titre: 'Trésorerie', to: '/tresorerie', si: (d) => d.peut('autre', D.autre.tresorerie) },
  { groupe: 'Aller à', titre: 'Statistiques', to: '/statistiques', si: (d) => d.peut('autre', D.autre.statistiques) },
  { groupe: 'Aller à', titre: 'Référentiels', to: '/referentiels', si: (d) => d.aModule('tiers') },
  { groupe: 'Aller à', titre: 'Paramètres', to: '/parametres', si: (d) => d.peut('autre', D.autre.parametres) },
  { groupe: 'Aller à', titre: 'Utilisateurs & droits', to: '/parametres/utilisateurs', si: (d) => d.peut('autre', D.autre.droitsAcces) },
  { groupe: 'Créer', titre: 'Nouvelle facture', sous: 'Vente FA', to: '/ventes/nouvelle?type=FA', si: (d) => d.peutDoc('vente', 'FA', 'creer') },
  { groupe: 'Créer', titre: 'Nouveau bon de livraison', sous: 'Vente BL', to: '/ventes/nouvelle?type=BL', si: (d) => d.peutDoc('vente', 'BL', 'creer') },
  { groupe: 'Créer', titre: 'Nouveau devis', sous: 'Proforma FP', to: '/ventes/nouvelle?type=FP', si: (d) => d.peutDoc('vente', 'FP', 'creer') },
  { groupe: 'Créer', titre: 'Nouveau bon de réception', sous: 'Achat BR', to: '/achats/nouvelle?type=BR', si: (d) => d.peutDoc('achat', 'BR', 'creer') },
  { groupe: 'Créer', titre: "Nouvelle facture d'achat", sous: 'Achat FA', to: '/achats/nouvelle?type=FA', si: (d) => d.peutDoc('achat', 'FA', 'creer') },
  { groupe: 'Créer', titre: 'Nouvel inventaire', to: '/stock/inventaires', si: (d) => d.peut('stock', D.stock.inventaire) },
];

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Palette de commandes (⌘K / Ctrl+K) : navigation, créations rapides et
 * recherche live des clients, fournisseurs et articles.
 */
export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const droits = useDroits();
  const [term, setTerm] = useState('');
  const termDiffere = useDebouncedValue(term, 220);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [searchClients, { data: cData, loading: cLoad }] = useLazyQuery(CLIENTS, { fetchPolicy: 'network-only' });
  const [searchArticles, { data: aData, loading: aLoad }] = useLazyQuery(ARTICLES, { fetchPolicy: 'network-only' });
  const [searchFourn, { data: fData, loading: fLoad }] = useLazyQuery(FOURNISSEURS, { fetchPolicy: 'network-only' });

  useEffect(() => {
    if (!open) { setTerm(''); setHi(0); return; }
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Recherche distante à partir de 2 caractères (valeur différée)
  useEffect(() => {
    const t = termDiffere.trim();
    if (!open || t.length < 2) return;
    const vars = { search: t, limit: 5, offset: 0 };
    void searchClients({ variables: vars });
    void searchArticles({ variables: vars });
    void searchFourn({ variables: vars });
  }, [termDiffere, open, searchClients, searchArticles, searchFourn]);

  const items: Item[] = useMemo(() => {
    const go = (to: string) => () => { onClose(); navigate(to); };
    const q = norm(term.trim());

    const statiques: Item[] = STATIQUES
      .filter((c) => !c.si || c.si(droits))
      .filter((s) => !q || norm(s.titre).includes(q) || norm(s.sous ?? '').includes(q))
      .map((s, i) => ({ id: `s${i}`, groupe: s.groupe, titre: s.titre, sous: s.sous, action: go(s.to) }));

    if (q.length < 2) return statiques;

    const clients: Item[] = ((cData?.clients?.data ?? []) as Client[]).map((c) => ({
      id: `c${c.id}`, groupe: 'Clients', titre: c.nom || c.code, sous: c.code,
      droite: c.credit != null ? `${fmtMoney(c.credit)} DA` : undefined,
      action: go(`/tiers/client/${encodeURIComponent(c.code)}`),
    }));
    const fournisseurs: Item[] = ((fData?.fournisseurs?.data ?? []) as Fournisseur[]).map((f) => ({
      id: `f${f.id}`, groupe: 'Fournisseurs', titre: f.nom || f.code, sous: f.code,
      droite: f.credit_initial != null ? `${fmtMoney(f.credit_initial)} DA` : undefined,
      action: go(`/tiers/fournisseur/${encodeURIComponent(f.code)}`),
    }));
    const articles: Item[] = ((aData?.articles?.data ?? []) as Article[]).map((a) => ({
      id: `a${a.id}`, groupe: 'Articles', titre: a.designation, sous: a.code,
      droite: `stock ${fmtQte(a.qte_reale)}`,
      action: go(`/stock/article/${a.id}`),
    }));

    return [...statiques, ...clients, ...fournisseurs, ...articles];
  }, [term, cData, aData, fData, navigate, onClose, droits.droits]);

  useEffect(() => { setHi(0); }, [term]);

  // Garde la ligne surlignée visible
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${hi}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [hi]);

  if (!open) return null;

  const loading = cLoad || aLoad || fLoad;

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); items[hi]?.action(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  }

  let dernierGroupe = '';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
         style={{ background: 'rgb(15 26 46 / .45)' }} onClick={onClose}>
      <div className="w-[620px] max-h-[70vh] bg-surface border border-line-soft rounded-lg shadow-lifted flex flex-col overflow-hidden"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line-soft">
          <span className="text-ink-muted">🔍</span>
          <input ref={inputRef} value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={onKey}
                 placeholder="Rechercher un client, un article, une action…"
                 className="flex-1 bg-transparent text-ink text-[14px] outline-none" />
          {loading && <span className="text-[11px] text-ink-muted">…</span>}
          <span className="font-mono text-[10px] border border-line rounded px-1.5 text-ink-muted">Échap</span>
        </div>

        <div ref={listRef} className="overflow-auto">
          {items.length === 0 && (
            <div className="px-4 py-6 text-center text-[12.5px] text-ink-muted">Aucun résultat.</div>
          )}
          {items.map((it, i) => {
            const nouveauGroupe = it.groupe !== dernierGroupe;
            dernierGroupe = it.groupe;
            return (
              <div key={it.id}>
                {nouveauGroupe && (
                  <div className="px-4 pt-2.5 pb-1 text-[9.5px] font-bold uppercase tracking-wider text-ink-muted">
                    {it.groupe}
                  </div>
                )}
                <button data-idx={i} onMouseEnter={() => setHi(i)} onClick={it.action}
                        className={`w-full text-left px-4 py-2 flex items-center gap-3 ${i === hi ? 'bg-brand-50' : ''}`}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold truncate">{it.titre}</span>
                    {it.sous && <span className="block text-[10.5px] text-ink-muted truncate money">{it.sous}</span>}
                  </span>
                  {it.droite && <span className="money text-[11px] text-ink-muted flex-none">{it.droite}</span>}
                  {i === hi && <span className="font-mono text-[10px] text-ink-muted flex-none">↵</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
