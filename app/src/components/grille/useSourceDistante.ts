import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ElementAffiche, NoeudGroupe, texteDe } from './moteur';
import { ColonneGrille, EtatGrille, GroupeDistant, RequeteDistante, Resume, SourceDistante } from './types';

/** Effectif maximal chargé à la fois sous un groupe ouvert (« Afficher plus » pour la suite). */
const LOT_GROUPE = 100;
/** Plafond de l'export en mode distant (le serveur plafonne aussi). */
const MAX_EXPORT = 10000;

type NoeudCharge<T> = { groupes?: GroupeDistant[]; lignes?: T[]; total: number; chargement: boolean; erreur?: string };

const typeServeur = (t?: string): RequeteDistante['types'][string] =>
  t === 'number' || t === 'money' ? 'number' : t === 'date' ? 'date' : t === 'boolean' ? 'boolean' : 'string';

/**
 * Mode distant de la grille (équivalent du CustomStore DevExtreme) : l'état
 * (tri, filtres, recherche, page, groupes) devient une requête serveur. Sans
 * groupes, une page de lignes ; avec groupes, les en-têtes du premier niveau
 * puis, à l'ouverture d'un groupe, ses sous-groupes ou ses lignes (par lots).
 */
export function useSourceDistante<T>(
  source: SourceDistante<T> | undefined,
  colonnes: ColonneGrille<T>[],
  etat: EtatGrille,
  resumes: Resume<T>[] | undefined,
  resumesGroupe: Resume<T>[] | undefined,
) {
  const actif = !!source;
  const sourceRef = useRef(source);
  sourceRef.current = source;

  // ─── Partie commune de la requête (tout sauf pagination et chemin de groupe) ───
  const base = useMemo(() => {
    const types: RequeteDistante['types'] = {};
    for (const c of colonnes) types[c.champ] = typeServeur(c.type);
    const filtres: RequeteDistante['filtres'] = {};
    for (const [champ, f] of Object.entries(etat.filtres)) {
      if (f.operateur === 'vide' || f.operateur === 'non_vide' || (f.valeur !== undefined && f.valeur !== '')) filtres[champ] = f;
    }
    const filtresEntete: RequeteDistante['filtresEntete'] = {};
    for (const [champ, vals] of Object.entries(etat.filtresEntete)) filtresEntete[champ] = vals.map((v) => (v === '' ? null : v));
    const aResumer = (liste?: Resume<T>[]) => (liste ?? [])
      .filter((r) => r.type !== 'custom')
      .map((r) => ({ champ: r.colonne, type: r.type as Exclude<Resume<T>['type'], 'custom'> }));
    return {
      tri: etat.tri,
      filtres,
      filtresEntete,
      recherche: etat.recherche.trim(),
      champsRecherche: colonnes.filter((c) => c.filtrable !== false && typeServeur(c.type) !== 'boolean').map((c) => c.champ),
      types,
      resumes: aResumer(resumes),
      resumesGroupe: aResumer(resumesGroupe),
    };
  }, [colonnes, etat.filtres, etat.filtresEntete, etat.recherche, etat.tri, resumes, resumesGroupe]);

  const cleBase = actif ? JSON.stringify([base, etat.groupes, source?.cle ?? '']) : '';
  // Anti-rebond : la saisie d'un filtre ou d'une recherche ne lance qu'une requête
  const [cleStable, setCleStable] = useState(cleBase);
  useEffect(() => {
    if (cleBase === cleStable) return;
    const t = setTimeout(() => setCleStable(cleBase), 250);
    return () => clearTimeout(t);
  }, [cleBase, cleStable]);
  const baseRef = useRef(base);
  baseRef.current = base;
  // Critères en cours de saisie (anti-rebond pas écoulé) : on attend la version stable
  const enAttente = useRef(false);
  enAttente.current = cleBase !== cleStable;

  const requete = useCallback((suite: Partial<RequeteDistante>): RequeteDistante => {
    const b = baseRef.current;
    return {
      skip: 0, take: etat.taillePage, tri: b.tri, filtres: b.filtres, filtresEntete: b.filtresEntete,
      recherche: b.recherche, champsRecherche: b.champsRecherche, types: b.types,
      groupe: null, resumes: b.resumes, ...suite,
    };
  }, [etat.taillePage]);
  /** Totaux demandés sur un niveau de groupes : ceux des groupes + les totaux généraux */
  const resumesNiveau = () => {
    const b = baseRef.current;
    return [...b.resumesGroupe, ...b.resumes.filter((r) => !b.resumesGroupe.some((x) => x.champ === r.champ && x.type === r.type))];
  };
  const [version, setVersion] = useState(0);

  // ─── Sans groupes : une page de lignes ───────────────────────────────────────
  const [page, setPage] = useState<{ lignes: T[]; total: number; resumes: Record<string, number | null> }>({ lignes: [], total: 0, resumes: {} });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const numero = useRef(0);
  const groupe = etat.groupes.length > 0;

  useEffect(() => {
    if (!actif || groupe || enAttente.current) return;
    const n = ++numero.current;
    setChargement(true);
    sourceRef.current!.charger(requete({ skip: etat.page * etat.taillePage, take: etat.taillePage }))
      .then((r) => {
        if (n !== numero.current) return; // réponse périmée
        setPage({ lignes: r.data ?? [], total: Number(r.total ?? 0), resumes: r.resumes ?? {} });
        setErreur(null);
        sourceRef.current?.surReponse?.(r);
      })
      .catch((e) => { if (n === numero.current) setErreur(e?.message ?? 'Chargement impossible.'); })
      .finally(() => { if (n === numero.current) setChargement(false); });
  }, [actif, groupe, cleStable, version, etat.page, etat.taillePage, requete]);

  // ─── Avec groupes : arbre chargé à la demande ────────────────────────────────
  const [noeuds, setNoeuds] = useState<Map<string, NoeudCharge<T>>>(new Map());
  const noeudsRef = useRef(noeuds);
  noeudsRef.current = noeuds;
  const generation = useRef(0);

  const chargerNoeud = useCallback((chemin: unknown[], ajout = false) => {
    const cle = JSON.stringify(chemin);
    const gen = generation.current;
    const feuille = chemin.length >= etat.groupes.length;
    const dejaCharge = ajout ? noeudsRef.current.get(cle)?.lignes?.length ?? 0 : 0;
    setNoeuds((m) => new Map(m).set(cle, { ...(m.get(cle) ?? { total: 0 }), chargement: true }));
    const req = requete({
      groupe: { champs: etat.groupes, chemin },
      skip: feuille ? dejaCharge : 0,
      take: feuille ? LOT_GROUPE : 1,
      resumes: feuille ? [] : resumesNiveau(),
    });
    sourceRef.current!.charger(req)
      .then((r) => {
        if (gen !== generation.current) return;
        setNoeuds((m) => {
          const courant = m.get(cle);
          const lignes = feuille ? [...(ajout ? courant?.lignes ?? [] : []), ...(r.data ?? [])] : undefined;
          return new Map(m).set(cle, { groupes: feuille ? undefined : r.groupes ?? [], lignes, total: Number(r.total ?? 0), chargement: false });
        });
        if (chemin.length === 0) {
          setPage((p) => ({ ...p, total: Number(r.total ?? 0), resumes: r.resumes ?? {} }));
          sourceRef.current?.surReponse?.(r);
        }
      })
      .catch((e) => {
        if (gen !== generation.current) return;
        setNoeuds((m) => new Map(m).set(cle, { total: 0, chargement: false, erreur: e?.message ?? 'Chargement impossible.' }));
      });
  }, [etat.groupes, requete]);

  // Nouveaux critères : on repart de la racine
  useEffect(() => {
    if (!actif || !groupe || enAttente.current) return;
    generation.current++;
    setNoeuds(new Map());
    chargerNoeud([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, groupe, cleStable, version]);

  // Groupes ouverts pas encore chargés
  useEffect(() => {
    if (!actif || !groupe) return;
    for (const cle of etat.groupesBascules) {
      if (noeuds.has(cle)) continue;
      let chemin: unknown[];
      try { chemin = JSON.parse(cle); } catch { continue; }
      if (!Array.isArray(chemin) || chemin.length === 0 || chemin.length > etat.groupes.length) continue;
      if (!noeuds.get(JSON.stringify(chemin.slice(0, -1)))?.groupes) continue; // parent pas encore là
      chargerNoeud(chemin);
    }
  }, [actif, groupe, etat.groupesBascules, etat.groupes.length, noeuds, chargerNoeud]);

  const elements = useMemo<ElementAffiche<T>[] | null>(() => {
    if (!actif || !groupe) return null;
    const sortie: ElementAffiche<T>[] = [];
    const parcourir = (chemin: unknown[]) => {
      const cle = JSON.stringify(chemin);
      const n = noeuds.get(cle);
      const niveau = chemin.length;
      if (!n || (n.chargement && !n.groupes && !n.lignes)) {
        if (niveau > 0) sortie.push({ type: 'info', cle: `${cle}~chargement`, niveau, texte: 'Chargement…' });
        return;
      }
      if (n.erreur) { sortie.push({ type: 'info', cle: `${cle}~erreur`, niveau, texte: n.erreur, action: () => chargerNoeud(chemin) }); return; }
      if (n.groupes) {
        const champ = etat.groupes[niveau];
        const col = colonnes.find((c) => c.champ === champ);
        for (const g of n.groupes) {
          const cheminEnfant = [...chemin, g.cle];
          const cleEnfant = JSON.stringify(cheminEnfant);
          const vide = g.cle === null || g.cle === undefined || g.cle === '';
          const noeud: NoeudGroupe<T> = {
            type: 'groupe', cle: cleEnfant, niveau, champ,
            texte: vide ? '(vide)' : col ? texteDe(col, g.cle) : String(g.cle),
            lignes: [], enfants: null, nombre: g.nombre, resumesDistants: g.resumes ?? {},
          };
          const replie = !etat.groupesBascules.includes(cleEnfant);
          sortie.push({ type: 'groupe', noeud, replie });
          if (!replie) parcourir(cheminEnfant);
        }
        return;
      }
      for (const l of n.lignes ?? []) sortie.push({ type: 'ligne', ligne: l });
      const reste = n.total - (n.lignes?.length ?? 0);
      if (reste > 0) {
        sortie.push({
          type: 'info', cle: `${cle}~plus`, niveau,
          texte: n.chargement ? 'Chargement…' : `Afficher plus (${reste} restante${reste > 1 ? 's' : ''})`,
          action: n.chargement ? undefined : () => chargerNoeud(chemin, true),
        });
      }
    };
    parcourir([]);
    return sortie;
  }, [actif, groupe, noeuds, etat.groupes, etat.groupesBascules, colonnes, chargerNoeud]);

  const racine = noeuds.get('[]');

  /** Toutes les lignes correspondant aux critères (export). */
  const chargerTout = useCallback(async (): Promise<T[]> => {
    const r = await sourceRef.current!.charger(requete({ skip: 0, take: MAX_EXPORT }));
    return r.data ?? [];
  }, [requete]);

  /** Valeurs possibles d'une colonne (filtre d'en-tête), compte tenu des autres filtres. */
  const valeursEntete = useCallback(async (champ: string, col: ColonneGrille<T> | undefined) => {
    const r = await sourceRef.current!.charger({ ...requete({ groupe: { champs: [champ], chemin: [] }, take: 1 }), resumes: [], sauf: champ });
    return (r.groupes ?? []).map((g) => {
      const vide = g.cle === null || g.cle === undefined || g.cle === '';
      return { cle: vide ? '' : String(g.cle), texte: vide ? '' : col ? texteDe(col, g.cle) : String(g.cle), nombre: g.nombre };
    });
  }, [requete]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  return {
    actif,
    lignes: page.lignes,
    total: page.total,
    resumes: page.resumes,
    elements,
    chargement: groupe ? !!racine?.chargement : chargement,
    erreur: groupe ? racine?.erreur ?? null : erreur,
    chargerTout,
    valeursEntete,
    recharger,
  };
}
