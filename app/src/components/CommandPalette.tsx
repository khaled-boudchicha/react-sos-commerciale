import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLazyQuery } from '@apollo/client';
import { CLIENTS, ARTICLES, FOURNISSEURS } from '../api/queries';
import { Client, Article, Fournisseur } from '../api/types';
import { fmtMoney, fmtQte } from '../lib/format';
import { useDebouncedValue } from '../lib/useDebounce';
import { D, useDroits } from '../lib/droits';
import { LIBELLES_REFERENTIELS } from '../navigation/commandes';
import { Icon, IconBadge, Kbd, type IconName, type Tone } from './ui/Icon';
import { Spinner } from './ui/Button';
import { useRecents, ilYA } from '../navigation/recents';
import { applyTheme } from '../screens/Parametres';
import { PALETTES, applyPalette } from '../lib/apparence';
import { EmptyState } from './ui/States';

/** Icône et teinte par groupe de résultats. */
const GROUPES: Record<string, { icon: IconName; tone: Tone }> = {
  'Récents': { icon: 'history', tone: 'neutral' },
  'Actions': { icon: 'sparkles', tone: 'info' },
  'Aller à': { icon: 'arrowRight', tone: 'brand' },
  'Créer': { icon: 'plus', tone: 'success' },
  Clients: { icon: 'users', tone: 'violet' },
  Fournisseurs: { icon: 'building', tone: 'orange' },
  Articles: { icon: 'package', tone: 'teal' },
};

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
  { groupe: 'Aller à', titre: 'Échéances', sous: 'Factures à encaisser', to: '/echeances', si: (d) => d.aModule('vente') },
  { groupe: 'Aller à', titre: 'Référentiels', to: '/referentiels', si: (d) => d.peutUn('tiers', LIBELLES_REFERENTIELS) },
  { groupe: 'Aller à', titre: 'Modèles d’impression', to: '/modeles', si: (d) => d.peut('autre', D.autre.parametres) },
  { groupe: 'Aller à', titre: 'Diagnostic de connexion', sous: 'Internet, serveur, agent, cache hors ligne', to: '/diagnostic' },
  { groupe: 'Aller à', titre: 'Paramètres', to: '/parametres', si: (d) => d.peut('autre', D.autre.parametres) },
  { groupe: 'Aller à', titre: 'Utilisateurs & droits', to: '/parametres/utilisateurs', si: (d) => d.peut('autre', D.autre.droitsAcces) },
  { groupe: 'Créer', titre: 'Nouvelle facture', sous: 'Vente FA', to: '/ventes/nouvelle?type=FA', si: (d) => d.peutDoc('vente', 'FA', 'creer') },
  { groupe: 'Créer', titre: 'Nouveau bon de livraison', sous: 'Vente BL', to: '/ventes/nouvelle?type=BL', si: (d) => d.peutDoc('vente', 'BL', 'creer') },
  { groupe: 'Créer', titre: 'Nouveau devis', sous: 'Proforma FP', to: '/ventes/nouvelle?type=FP', si: (d) => d.peutDoc('vente', 'FP', 'creer') },
  { groupe: 'Créer', titre: 'Nouveau bon de réception', sous: 'Achat BR', to: '/achats/nouvelle?type=BR', si: (d) => d.peutDoc('achat', 'BR', 'creer') },
  { groupe: 'Créer', titre: "Nouvelle facture d'achat", sous: 'Achat FA', to: '/achats/nouvelle?type=FA', si: (d) => d.peutDoc('achat', 'FA', 'creer') },
  { groupe: 'Créer', titre: 'Nouvel inventaire', to: '/stock/inventaires?nouveau=1', si: (d) => d.peut('stock', D.stock.inventaire) },
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
  const recents = useRecents((s) => s.recents);
  const { pathname, search } = useLocation();
  const ici = `${pathname}${search}`;
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

    // Écrans récents (reprendre où l'on en était) et actions d'interface
    const recentsItems: Item[] = recents
      .filter((r) => r.chemin !== ici)
      .filter((r) => !q || norm(r.titre).includes(q) || norm(r.chemin).includes(q))
      .slice(0, q ? 5 : 4)
      .map((r, i) => ({ id: `r${i}`, groupe: 'Récents', titre: r.titre || r.chemin, sous: r.chemin, droite: ilYA(r.date), action: go(r.chemin) }));
    const sombre = document.documentElement.dataset.theme === 'dark';
    const actionsItems: Item[] = [
      { id: 'a-theme', groupe: 'Actions', titre: sombre ? 'Passer en mode clair' : 'Passer en mode sombre', sous: 'Thème de l’interface',
        action: () => { onClose(); applyTheme(sombre ? 'light' : 'dark'); } },
      { id: 'a-raccourcis', groupe: 'Actions', titre: 'Raccourcis clavier', sous: 'Ctrl+/',
        action: () => { onClose(); window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', ctrlKey: true })); } },
      { id: 'a-charte', groupe: 'Actions', titre: 'Charte graphique et composants', sous: 'Configuration › Outils', action: go('/outils/ui') },
      // Palettes : proposées seulement quand on les cherche (« palette », « couleur », nom de la palette)
      ...(q ? PALETTES.map((p) => ({ id: `a-pal-${p.id}`, groupe: 'Actions', titre: `Palette « ${p.libelle} »`, sous: `Couleurs de l’interface — ${p.description}`,
        action: () => { onClose(); applyPalette(p.id); } })) : []),
    ].filter((a) => !q || norm(a.titre).includes(q) || norm(a.sous ?? '').includes(q));

    const statiques: Item[] = STATIQUES
      .filter((c) => !c.si || c.si(droits))
      .filter((s) => !q || norm(s.titre).includes(q) || norm(s.sous ?? '').includes(q))
      .map((s, i) => ({ id: `s${i}`, groupe: s.groupe, titre: s.titre, sous: s.sous, action: go(s.to) }));

    if (q.length < 2) return [...recentsItems, ...statiques, ...actionsItems];

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

    return [...recentsItems, ...statiques, ...clients, ...fournisseurs, ...articles, ...actionsItems];
  }, [term, cData, aData, fData, navigate, onClose, droits.droits, recents, ici]);

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
    <div className="fixed inset-0 z-modal flex items-start justify-center pt-[12vh] animate-fade-in"
         style={{ background: 'var(--overlay)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Recherche globale"
           className="w-[640px] max-w-[calc(100vw-32px)] max-h-[70vh] bg-raised border border-line-soft rounded-lg shadow-modal flex flex-col overflow-hidden animate-pop-in"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 h-[54px] border-b border-line-soft">
          <Icon name="search" size={20} className="text-brand-text" />
          <input ref={inputRef} value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={onKey}
                 placeholder="Rechercher un client, un article, une action…"
                 role="combobox" aria-expanded="true" aria-controls="palette-liste" aria-activedescendant={`palette-${hi}`}
                 aria-autocomplete="list"
                 className="flex-1 bg-transparent text-ink text-md outline-none placeholder:text-ink-placeholder" />
          {loading && <Spinner size={16} className="text-brand-text" />}
          <Kbd>Échap</Kbd>
        </div>

        <div ref={listRef} id="palette-liste" role="listbox" aria-label="Résultats" className="overflow-auto py-1.5">
          {items.length === 0 && (
            <EmptyState size="sm" icon="search" title="Aucun résultat"
                        description={term.trim().length < 2 ? 'Tapez au moins deux caractères pour chercher clients, fournisseurs et articles.' : `Rien ne correspond à « ${term.trim()} ».`} />
          )}
          {items.map((it, i) => {
            const nouveauGroupe = it.groupe !== dernierGroupe;
            dernierGroupe = it.groupe;
            const g = GROUPES[it.groupe] ?? GROUPES['Aller à'];
            return (
              <div key={it.id}>
                {nouveauGroupe && (
                  <div className="px-4 pt-2.5 pb-1 text-2xs font-bold uppercase tracking-wider text-ink-muted">
                    {it.groupe}
                  </div>
                )}
                <button data-idx={i} id={`palette-${i}`} role="option" aria-selected={i === hi}
                        onMouseEnter={() => setHi(i)} onClick={it.action}
                        className={`w-[calc(100%-12px)] mx-1.5 text-left px-2.5 py-1.5 flex items-center gap-3 rounded-md transition-colors duration-fast ${i === hi ? 'bg-brand-soft' : ''}`}>
                  <IconBadge name={g.icon} tone={g.tone} size="sm" />
                  <span className="flex-1 min-w-0">
                    <span className={`block text-base font-semibold truncate ${i === hi ? 'text-brand-text' : 'text-ink'}`}>{it.titre}</span>
                    {it.sous && <span className="block text-xs text-ink-muted truncate money">{it.sous}</span>}
                  </span>
                  {it.droite && <span className="money text-xs text-ink-label flex-none">{it.droite}</span>}
                  {i === hi && <Kbd>Entrée</Kbd>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 px-4 h-9 border-t border-line-soft bg-sunken text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> naviguer</span>
          <span className="inline-flex items-center gap-1"><Kbd>Entrée</Kbd> ouvrir</span>
          <span className="inline-flex items-center gap-1"><Kbd>Échap</Kbd> fermer</span>
        </div>
      </div>
    </div>
  );
}
