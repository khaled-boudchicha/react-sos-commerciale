import { useCallback, useEffect, useMemo, useState } from 'react';
import { ColonneGrille, DensiteGrille, DispositionGrille, EtatGrille, FiltreColonne } from './types';

const PREFIXE = 'gc.grille.';

function etatInitial<T>(colonnes: ColonneGrille<T>[], taillePage: number): EtatGrille {
  return {
    ordreColonnes: colonnes.map((c) => c.champ),
    largeurs: {},
    masquees: colonnes.filter((c) => c.visible === false).map((c) => c.champ),
    tri: colonnes.filter((c) => c.triInitial).map((c) => ({ champ: c.champ, sens: c.triInitial! })),
    groupes: colonnes.filter((c) => c.groupeInitial != null)
      .sort((a, b) => (a.groupeInitial ?? 0) - (b.groupeInitial ?? 0)).map((c) => c.champ),
    filtres: {},
    filtresEntete: {},
    recherche: '',
    taillePage,
    page: 0,
    groupesBascules: [],
    tousReplies: false,
  };
}

function lire(cle?: string): Partial<EtatGrille> | null {
  if (!cle) return null;
  try {
    const brut = localStorage.getItem(PREFIXE + cle);
    return brut ? JSON.parse(brut) : null;
  } catch { return null; }
}

/**
 * État de la grille (colonnes, tri, filtres, groupes, pagination, groupes repliés).
 * Avec `cleEtat`, il est mémorisé dans localStorage (préférences du poste — voir
 * « Browser storage » : lecture/écriture protégées, repli sur l'état initial).
 */
export function useEtatGrille<T>(colonnes: ColonneGrille<T>[], taillePage: number, cleEtat?: string) {
  const [etat, setEtat] = useState<EtatGrille>(() => {
    const e: EtatGrille = { ...etatInitial(colonnes, taillePage), ...lire(cleEtat), page: 0 };
    // État mémorisé antérieur à des colonnes optionnelles : elles restent masquées dès le premier rendu
    const cachees = colonnes.filter((c) => c.visible === false && !e.ordreColonnes.includes(c.champ) && !e.masquees.includes(c.champ)).map((c) => c.champ);
    return cachees.length ? { ...e, masquees: [...e.masquees, ...cachees] } : e;
  });

  // Nouvelles colonnes (colonnes auto chargées après coup) : complète l'ordre
  const champs = colonnes.map((c) => c.champ).join('|');
  useEffect(() => {
    setEtat((e) => {
      const manquantes = colonnes.map((c) => c.champ).filter((c) => !e.ordreColonnes.includes(c));
      if (!manquantes.length) return e;
      // Colonnes optionnelles apparues depuis l'état mémorisé : elles restent masquées par défaut
      const cachees = colonnes.filter((c) => manquantes.includes(c.champ) && c.visible === false).map((c) => c.champ);
      return { ...e, ordreColonnes: [...e.ordreColonnes, ...manquantes], masquees: [...e.masquees, ...cachees.filter((c) => !e.masquees.includes(c))] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champs]);

  useEffect(() => {
    if (!cleEtat) return;
    try {
      const { page: _p, ...aMemoriser } = etat;
      localStorage.setItem(PREFIXE + cleEtat, JSON.stringify(aMemoriser));
    } catch { /* stockage indisponible : préférences non mémorisées */ }
  }, [etat, cleEtat]);

  const maj = useCallback((patch: Partial<EtatGrille> | ((e: EtatGrille) => Partial<EtatGrille>)) =>
    setEtat((e) => ({ ...e, ...(typeof patch === 'function' ? patch(e) : patch) })), []);

  const actions = useMemo(() => ({
    /** Clic : tri sur la seule colonne (asc → desc → aucun) ; Maj+clic : ajoute au tri multiple ; Ctrl+clic : retire. */
    trier: (champ: string, mode: 'simple' | 'ajout' | 'retrait') => maj((e) => {
      const actuel = e.tri.find((t) => t.champ === champ);
      if (mode === 'retrait') return { tri: e.tri.filter((t) => t.champ !== champ) };
      const suivant = !actuel ? 'asc' : actuel.sens === 'asc' ? 'desc' : null;
      if (mode === 'ajout') {
        // Tri multiple : la colonne garde son rang (bascule asc → desc → retirée), sinon s'ajoute en dernier
        if (!actuel) return { tri: [...e.tri, { champ, sens: 'asc' as const }] };
        return { tri: suivant ? e.tri.map((t) => (t.champ === champ ? { champ, sens: suivant } : t)) : e.tri.filter((t) => t.champ !== champ) };
      }
      return { tri: suivant ? [{ champ, sens: suivant }] : [] };
    }),
    trierSens: (champ: string, sens: 'asc' | 'desc' | null) => maj({ tri: sens ? [{ champ, sens }] : [] }),
    filtrer: (champ: string, f: FiltreColonne | null) => maj((e) => {
      const filtres = { ...e.filtres };
      if (f) filtres[champ] = f; else delete filtres[champ];
      return { filtres, page: 0 };
    }),
    filtrerEntete: (champ: string, valeurs: string[] | null) => maj((e) => {
      const filtresEntete = { ...e.filtresEntete };
      if (valeurs && valeurs.length) filtresEntete[champ] = valeurs; else delete filtresEntete[champ];
      return { filtresEntete, page: 0 };
    }),
    rechercher: (recherche: string) => maj({ recherche, page: 0 }),
    effacerFiltres: () => maj({ filtres: {}, filtresEntete: {}, recherche: '', page: 0 }),
    grouper: (champ: string, index?: number) => maj((e) => {
      const sans = e.groupes.filter((g) => g !== champ);
      const i = index == null ? sans.length : Math.min(index, sans.length);
      return { groupes: [...sans.slice(0, i), champ, ...sans.slice(i)], groupesBascules: [], page: 0 };
    }),
    degrouper: (champ: string) => maj((e) => ({ groupes: e.groupes.filter((g) => g !== champ), page: 0 })),
    basculerGroupe: (cle: string) => maj((e) => ({
      groupesBascules: e.groupesBascules.includes(cle) ? e.groupesBascules.filter((k) => k !== cle) : [...e.groupesBascules, cle],
    })),
    toutDeplier: () => maj({ tousReplies: false, groupesBascules: [] }),
    toutReplier: () => maj({ tousReplies: true, groupesBascules: [] }),
    deplacerColonne: (champ: string, avant: string | null) => maj((e) => {
      const sans = e.ordreColonnes.filter((c) => c !== champ);
      const i = avant ? sans.indexOf(avant) : sans.length;
      return { ordreColonnes: [...sans.slice(0, i < 0 ? sans.length : i), champ, ...sans.slice(i < 0 ? sans.length : i)] };
    }),
    redimensionner: (champ: string, largeur: number) => maj((e) => ({ largeurs: { ...e.largeurs, [champ]: Math.round(largeur) } })),
    basculerVisibilite: (champ: string) => maj((e) => ({
      masquees: e.masquees.includes(champ) ? e.masquees.filter((c) => c !== champ) : [...e.masquees, champ],
    })),
    /** Fige une colonne à gauche / à droite, ou la libère ('aucune'). */
    figer: (champ: string, cote: 'gauche' | 'droite' | 'aucune') => maj((e) => ({ figees: { ...(e.figees ?? {}), [champ]: cote } })),
    densite: (densite: DensiteGrille) => maj({ densite }),
    basculerRetour: (defaut: boolean) => maj((e) => ({ retour: !(e.retour ?? defaut) })),
    /** Applique une vue : disposition complète (colonnes, ordre, largeurs, figées, tri, densité) ; filtres conservés. */
    appliquerVue: (id: string, d: DispositionGrille) => maj((e) => ({
      ordreColonnes: d.ordreColonnes ?? colonnes.map((c) => c.champ),
      masquees: d.masquees ?? colonnes.filter((c) => c.visible === false).map((c) => c.champ),
      largeurs: d.largeurs ?? {},
      figees: d.figees ?? {},
      tri: d.tri ?? e.tri,
      densite: d.densite ?? e.densite,
      retour: d.retour ?? e.retour,
      vue: id,
      page: 0,
    })),
    page: (page: number) => maj({ page }),
    taillePage: (taillePage: number) => maj({ taillePage, page: 0 }),
    reinitialiser: () => setEtat(etatInitial(colonnes, taillePage)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [maj, champs, taillePage]);

  return { etat, maj, actions };
}
