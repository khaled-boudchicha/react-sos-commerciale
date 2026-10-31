import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DependencyList } from 'react';
import { ColonneId, Sens, colonnesPour } from './lignesDocument';

/**
 * Présentation de l'éditeur de lignes (LignesTable) : densité, modèles de colonnes,
 * largeurs et défilement horizontal. AUCUN calcul métier ici — les colonnes restent
 * celles de `lignesDocument.ts` (mêmes `ColonneId`, même persistance `gc.lignes.colonnes.<sens>`).
 */

/* ─── Densité (préférence du poste) ────────────────────────────────────────── */

export type Densite = 'compacte' | 'confort';
const CLE_DENSITE = 'gc.lignes.densite';

/** Densité des lignes, persistée dans localStorage (tolérant : stockage indisponible → compacte). */
export function useDensiteLignes(): [Densite, (d: Densite) => void] {
  const [densite, setDensite] = useState<Densite>(() => {
    try {
      const v = localStorage.getItem(CLE_DENSITE);
      if (v === 'compacte' || v === 'confort') return v;
    } catch { /* stockage indisponible */ }
    return 'compacte';
  });
  const changer = useCallback((d: Densite) => {
    setDensite(d);
    try { localStorage.setItem(CLE_DENSITE, d); } catch { /* ignore */ }
  }, []);
  return [densite, changer];
}

/* ─── Colonnes de base masquables (extension rétrocompatible) ──────────────── */

/**
 * « Remise % » et « TVA % » étaient toujours affichées : elles deviennent masquables SANS toucher au
 * catalogue `ColonneId` ni à la clé `gc.lignes.colonnes.<sens>`. Une clé dédiée mémorise celles qui
 * sont MASQUÉES (absente = toutes visibles = comportement historique).
 */
export type ColonneBaseId = 'remise' | 'tva';
export const COLONNES_BASE: { id: ColonneBaseId; label: string }[] = [
  { id: 'remise', label: 'Remise %' },
  { id: 'tva', label: 'TVA %' },
];

export function useColonnesBase(sens: Sens) {
  const cle = `gc.lignes.colonnesBase.${sens}`;
  const [masquees, setMasquees] = useState<Set<ColonneBaseId>>(() => {
    try {
      const brut = localStorage.getItem(cle);
      if (brut) {
        const ids = JSON.parse(brut);
        if (Array.isArray(ids)) return new Set(ids.filter((id): id is ColonneBaseId => id === 'remise' || id === 'tva'));
      }
    } catch { /* stockage indisponible → toutes visibles */ }
    return new Set();
  });
  useEffect(() => {
    try { localStorage.setItem(cle, JSON.stringify([...masquees])); } catch { /* ignore */ }
  }, [cle, masquees]);
  const basculer = useCallback((id: ColonneBaseId) => setMasquees((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);
  const definir = useCallback((ids: ColonneBaseId[]) => setMasquees(new Set(ids)), []);
  return { masquees, basculer, definir };
}

/* ─── Modèles de colonnes (≈ « modèles de saisie » Sage) ──────────────────── */

export type ModeleId = 'rapide' | 'standard' | 'complete';

export const MODELES: { id: ModeleId; label: string; description: string }[] = [
  { id: 'rapide', label: 'Saisie rapide', description: 'Article, quantité, prix, total' },
  { id: 'standard', label: 'Standard', description: 'Disposition par défaut' },
  { id: 'complete', label: 'Complète', description: 'Toutes les colonnes' },
];

/** Colonnes d'un modèle : optionnelles visibles (mêmes ids que la configuration persistée) + base masquées. */
export function colonnesDuModele(id: ModeleId, sens: Sens): { visibles: Set<ColonneId>; masquees: ColonneBaseId[] } {
  const toutes = colonnesPour(sens);
  if (id === 'rapide') return { visibles: new Set(), masquees: ['remise', 'tva'] };
  if (id === 'complete') return { visibles: new Set(toutes.map((c) => c.id)), masquees: [] };
  return {
    visibles: new Set(toutes.filter((c) => (sens === 'vente' ? c.defautVente : c.defautAchat)).map((c) => c.id)),
    masquees: [],
  };
}

/** Modèle correspondant exactement aux colonnes affichées, sinon null (« personnalisé »). */
export function modeleActif(visibles: Set<ColonneId>, masquees: Set<ColonneBaseId>, sens: Sens): ModeleId | null {
  const egal = <T,>(a: Set<T>, b: Set<T>) => a.size === b.size && [...a].every((x) => b.has(x));
  for (const m of MODELES) {
    const cible = colonnesDuModele(m.id, sens);
    if (egal(cible.visibles, visibles) && egal(new Set(cible.masquees), masquees)) return m.id;
  }
  return null;
}

/* ─── Largeurs (px) : colonnes numériques fixes, désignation flexible ─────── */

export const LARGEUR = {
  numero: 44,
  article_min: 220,
  tarif: 60,
  qte: 80,
  colis: 72,
  prix_ht: 100,
  prix_ttc: 100,
  remise: 72,
  remise_montant: 104,
  tva: 64,
  lot: 156,
  peremption: 132,
  total_ht: 112,
  total_ttc: 120,
  suppr: 40,
} as const;

/* ─── Défilement horizontal : ombres de bord + focus jamais masqué ─────────── */

/** Zone occupée par les parties figées (en-tête collant, colonnes figées à gauche / à droite).
 *  Somme des LARGEURS (contiguës depuis le bord) : l'`offsetLeft` d'une cellule sticky suit le défilement. */
function zonesFigees(el: HTMLElement) {
  let gauche = 0, droite = 0;
  el.querySelectorAll<HTMLElement>('thead [data-fige]').forEach((th) => {
    if (th.dataset.fige === 'gauche') gauche += th.offsetWidth;
    else droite += th.offsetWidth;
  });
  const haut = el.querySelector<HTMLElement>('thead')?.offsetHeight ?? 0;
  return { gauche, droite, haut };
}

/**
 * Suit le défilement horizontal d'un conteneur : `gauche` / `droite` indiquent qu'il reste
 * des colonnes cachées de ce côté (ombres de bord). Une cellule qui reçoit le focus (Tab) n'est
 * jamais laissée sous les parties figées : `scroll-padding` du conteneur = leur emprise (le
 * navigateur en tient compte en amenant le champ à l'écran), et `onFocusCapture` corrige après coup
 * si nécessaire. Les colonnes figées sont repérées par `data-fige="gauche|droite"` dans l'en-tête.
 */
export function useDefilementHorizontal(deps: DependencyList) {
  const ref = useRef<HTMLDivElement>(null);
  const [bords, setBords] = useState({ gauche: false, droite: false });

  const mesurer = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const gauche = el.scrollLeft > 1;
    const droite = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setBords((b) => (b.gauche === gauche && b.droite === droite ? b : { gauche, droite }));
  }, []);

  const mesurerZones = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const z = zonesFigees(el);
    el.style.scrollPaddingLeft = `${z.gauche}px`;
    el.style.scrollPaddingRight = `${z.droite}px`;
    el.style.scrollPaddingTop = `${z.haut}px`;
    mesurer();
  }, [mesurer]);

  useLayoutEffect(mesurerZones, [mesurerZones, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(mesurerZones);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [mesurerZones]);

  const onFocusCapture = useCallback((e: React.FocusEvent) => {
    const el = ref.current;
    const cellule = (e.target as HTMLElement).closest('td,th') as HTMLTableCellElement | null;
    if (!el || !cellule || cellule.dataset.fige) return;
    // après le défilement natif du navigateur vers l'élément focalisé
    requestAnimationFrame(() => {
      const z = zonesFigees(el);
      const debut = cellule.offsetLeft, fin = debut + cellule.offsetWidth;
      if (debut < el.scrollLeft + z.gauche) el.scrollLeft = debut - z.gauche;
      else if (fin > el.scrollLeft + el.clientWidth - z.droite) el.scrollLeft = fin - el.clientWidth + z.droite;
    });
  }, []);

  return { ref, ...bords, onScroll: mesurer, onFocusCapture };
}
