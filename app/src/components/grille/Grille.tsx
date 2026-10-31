import { Fragment, KeyboardEvent as KE, MouseEvent as ME, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ConfirmDialog from '../ui/ConfirmDialog';
import Dialog from '../ui/Dialog';
import { Button, IconButton } from '../ui/Button';
import { CONTROL, SearchField, Select } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Menu, type MenuItem } from '../ui/Menu';
import { TextInput } from '../ui/Field';
import { Alert, EmptyState, Loading, LoadingOverlay, Skeleton } from '../ui/States';
import PrintPreview from '../../print/engine/PrintPreview';
import { PrintDocument } from '../../print/engine/types';
import { isoDate } from '../../lib/format';
import {
  aplatir, calculerResume, colonnesEffectives, colonnesVisibles, ElementAffiche, filtrer, grouper,
  LIBELLES_RESUME, NoeudGroupe, operateurDefaut, paginer, texteDe, trier, valeurDe, valeursDistinctes, valider,
} from './moteur';
import {
  EntreeMenu, FiltreEntete, LIBELLES_OPERATEURS, MenuContextuel, operateursPour, SelecteurColonnes, SYMBOLES_OPERATEURS, Flottant,
} from './Popups';
import { documentPdfGrille, exporterGrilleCsv, exporterGrilleExcel } from './exportGrille';
import { ColonneGrille, DensiteGrille, DispositionGrille, EtatGrille, FiltreColonne, GrilleProps, Resume, VueGrille } from './types';
import { useEtatGrille } from './useEtatGrille';
import { useSourceDistante } from './useSourceDistante';

type Cle = string | number;
const CLE_NOUVELLE = '__nouvelle__';
const L_SELECTION = 36;
const L_DETAIL = 30;
const L_COMMANDES = 84;
const TYPE_DND = 'text/x-grille-colonne';
const HAUTEURS: Record<DensiteGrille, number> = { compacte: 28, normale: 34, confort: 42 };
const PADDING_CELLULE: Record<DensiteGrille, string> = { compacte: 'py-1', normale: 'py-1.5', confort: 'py-2.5' };
const LIBELLES_DENSITE: Record<DensiteGrille, string> = { compacte: 'Compacte', normale: 'Normale', confort: 'Confort' };
const PREFIXE_VUES = 'gc.vues.';
type VueUtilisateur = { id: string; libelle: string; etat: DispositionGrille };
function lireVues(cle?: string): VueUtilisateur[] {
  if (!cle) return [];
  try { const v = JSON.parse(localStorage.getItem(PREFIXE_VUES + cle) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function ecrireVues(cle: string, vues: VueUtilisateur[]) {
  try { localStorage.setItem(PREFIXE_VUES + cle, JSON.stringify(vues)); } catch { /* stockage indisponible */ }
}
/** Disposition capturée par une vue (colonnes, ordre, largeurs, figées, tri, densité, retour). */
function disposition(e: EtatGrille): DispositionGrille {
  return { ordreColonnes: e.ordreColonnes, masquees: e.masquees, largeurs: e.largeurs, figees: e.figees ?? {}, tri: e.tri, densite: e.densite, retour: e.retour };
}

function largeurDefaut<T>(c: ColonneGrille<T>): number {
  if (c.largeur) return c.largeur;
  return c.type === 'money' ? 130 : c.type === 'number' ? 100 : c.type === 'date' ? 110 : c.type === 'boolean' ? 80 : 170;
}
const estNum = (t?: string) => t === 'number' || t === 'money';

/**
 * Grille de données complète (inspirée du DataGrid DevExtreme) : tri multiple,
 * filtres (ligne, en-tête, recherche, panneau), groupes multi-niveaux par
 * glisser-déposer, totaux, pagination ou défilement virtuel, colonnes
 * (ordre, largeur, figées, bandes, sélecteur), sélection, ligne active, édition
 * (ligne, cellule, lot, formulaire) avec validation, maître-détail, export Excel /
 * CSV / PDF, persistance de l'état, navigation clavier. Voir components/grille/README.md.
 */
export default function Grille<T>(props: GrilleProps<T>) {
  const {
    donnees, cle, colonnes: colonnesProp, hauteur, chargement, erreur, titre, messageVide = 'Aucune donnée.',
    barreOutils, rechercheGlobale = true, ligneFiltre = true, panneauFiltre = true, panneauGroupes = true,
    selecteurColonnes = true, reorganisationColonnes = true, redimensionnementColonnes = true, lignesAlternees = true,
    bordures = false, retourLigne = false, rtl = false, pagination = true, defilementVirtuel = false, hauteurLigne = 34,
    selection = 'aucune', toutSelectionner = 'tout', ligneActive = true, edition, resumes, resumesGroupe, detail,
    cleEtat, styleLigne, vues,
  } = props;

  const colonnes = useMemo(() => colonnesEffectives(colonnesProp, donnees),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colonnesProp, donnees.length > 0 ? Object.keys(donnees[0] as object).join() : '']);
  const optPagination = typeof pagination === 'object' ? pagination : {};
  const taillesPage = optPagination.tailles ?? [10, 20, 50, 100];
  const { etat, actions } = useEtatGrille(colonnes, optPagination.taille ?? 20, cleEtat);
  // Colonnes figées par l'utilisateur (prime sur la définition de la colonne)
  const colonnesAff = useMemo(() => (etat.figees ? colonnes.map((c) => {
    const f = etat.figees![c.champ];
    return f ? { ...c, figee: f === 'aucune' ? undefined : f } : c;
  }) : colonnes), [colonnes, etat.figees]);
  const visibles = useMemo(() => colonnesVisibles(colonnesAff, etat), [colonnesAff, etat]);
  // Densité et retour à la ligne (préférences de l'utilisateur, sinon props)
  const densite: DensiteGrille = etat.densite ?? 'normale';
  const hLigne = etat.densite ? HAUTEURS[densite] : hauteurLigne;
  const padCellule = PADDING_CELLULE[densite];
  const retour = etat.retour ?? retourLigne;
  const largeur = (c: ColonneGrille<T>) => etat.largeurs[c.champ] ?? largeurDefaut(c);
  // Mode distant : le serveur trie, filtre, pagine, regroupe et totalise
  const distant = useSourceDistante(props.source, colonnes, etat, resumes, resumesGroupe);
  // Autre source (onglet, autre liste) : on repart à la première page, sinon la page
  // de l'onglet précédent (ex. 6 des BL) donne « Aucun résultat » sur un petit ensemble.
  const cleSource = props.source?.cle ?? '';
  const cleSourcePrec = useRef(cleSource);
  useEffect(() => {
    if (cleSourcePrec.current === cleSource) return;
    cleSourcePrec.current = cleSource;
    actions.page(0);
  }, [cleSource, actions]);
  const sourceDonnees = distant.actif ? distant.lignes : donnees;

  // ─── Édition (lot : changements en attente fusionnés à l'affichage) ─────────
  const [lot, setLot] = useState<{ modifiees: Record<string, Partial<T>>; ajoutees: T[]; supprimees: Cle[] }>({ modifiees: {}, ajoutees: [], supprimees: [] });
  const [ligneEditee, setLigneEditee] = useState<{ cle: Cle; valeurs: Record<string, unknown>; nouvelle: boolean; erreurs: Record<string, string> } | null>(null);
  const [celluleEditee, setCelluleEditee] = useState<{ cle: Cle; champ: string; valeur: unknown; erreur?: string } | null>(null);
  const [formulaire, setFormulaire] = useState<{ ligne: T | null; valeurs: Record<string, unknown>; erreurs: Record<string, string> } | null>(null);
  const [aSupprimer, setASupprimer] = useState<T | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);
  const modeEdition = edition?.mode;
  const compteurNouvelles = useRef(0);

  const cleDe = useCallback((l: T): Cle => {
    const k = (l as Record<string, unknown>).__cleTemp as Cle | undefined;
    return k ?? cle(l);
  }, [cle]);

  const donneesAffichees = useMemo(() => {
    const fusion = sourceDonnees.map((d) => {
      const m = lot.modifiees[String(cle(d))];
      return m ? ({ ...d, ...m }) as T : d;
    });
    return edition?.positionNouvelle === 'fin' ? [...fusion, ...lot.ajoutees] : [...lot.ajoutees, ...fusion];
  }, [sourceDonnees, lot, cle, edition?.positionNouvelle]);

  // ─── Chaîne de données ────────────────────────────────────────────────────
  // En mode distant, les lignes reçues sont déjà filtrées, triées et paginées
  const filtrees = useMemo(() => (distant.actif ? donneesAffichees : filtrer(donneesAffichees, colonnes, etat)), [distant.actif, donneesAffichees, colonnes, etat]);
  const triees = useMemo(() => (distant.actif ? filtrees : trier(filtrees, colonnes, etat.tri)), [distant.actif, filtrees, colonnes, etat.tri]);
  const arbre = useMemo(() => (!distant.actif && etat.groupes.length ? grouper(triees, colonnes, etat.groupes) : null), [distant.actif, triees, colonnes, etat.groupes]);
  const elements: ElementAffiche<T>[] = useMemo(
    () => distant.elements ?? (arbre ? aplatir(arbre, etat) : triees.map((ligne) => ({ type: 'ligne' as const, ligne }))),
    [distant.elements, arbre, triees, etat],
  );
  /** Nombre de lignes du résultat (serveur : total filtré, toutes pages) */
  const nbResultat = distant.actif ? distant.total : triees.length;
  const groupeDistant = distant.actif && etat.groupes.length > 0;
  const pagine = !defilementVirtuel && pagination !== false && !groupeDistant;
  const { elements: elementsPage, pages, page } = useMemo(() => {
    if (!pagine) return { elements, pages: 1, page: 0 };
    if (distant.actif) {
      const nb = Math.max(1, Math.ceil(distant.total / Math.max(1, etat.taillePage)));
      return { elements, pages: nb, page: Math.min(etat.page, nb - 1) };
    }
    return paginer(elements, etat.page, etat.taillePage);
  }, [elements, pagine, distant.actif, distant.total, etat.page, etat.taillePage]);

  // ─── Sélection, ligne active, détail ──────────────────────────────────────
  const [selectionnees, setSelectionnees] = useState<Set<Cle>>(() => new Set(props.selectionnees ?? []));
  const derniereCliquee = useRef<Cle | null>(null);
  const [active, setActive] = useState<Cle | null>(null);
  const [focus, setFocus] = useState<{ index: number; col: number }>({ index: 0, col: 0 });
  const [details, setDetails] = useState<Set<Cle>>(new Set());

  // Sélection pilotée par l'écran (ex. « Effacer la sélection ») : la prop prime quand elle change
  const selectionProp = props.selectionnees;
  useEffect(() => {
    if (!selectionProp) return;
    setSelectionnees((cur) => (cur.size === selectionProp.length && selectionProp.every((k) => cur.has(k)) ? cur : new Set(selectionProp)));
  }, [selectionProp]);

  const changerSelection = (s: Set<Cle>) => {
    setSelectionnees(s);
    props.surSelection?.([...s], donneesAffichees.filter((l) => s.has(cleDe(l))));
  };
  const lignesPage = elementsPage.filter((e): e is { type: 'ligne'; ligne: T } => e.type === 'ligne').map((e) => e.ligne);
  const perimetreTout = toutSelectionner === 'page' ? lignesPage : triees;
  const toutCoche = perimetreTout.length > 0 && perimetreTout.every((l) => selectionnees.has(cleDe(l)));
  const partielCoche = !toutCoche && perimetreTout.some((l) => selectionnees.has(cleDe(l)));

  function cliquerLigne(e: ME, ligne: T) {
    const k = cleDe(ligne);
    setActive(k);
    props.surLigneActive?.(ligne);
    props.surClicLigne?.(ligne);
    if (selection === 'simple') changerSelection(new Set([k]));
    else if (selection === 'multiple' && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      const s = new Set(selectionnees);
      if (e.shiftKey && derniereCliquee.current != null) {
        // Plage Maj+clic sur les lignes dans l'ordre affiché
        const ordre = triees.map(cleDe);
        const [a, b] = [ordre.indexOf(derniereCliquee.current), ordre.indexOf(k)].sort((x, y) => x - y);
        if (a >= 0) ordre.slice(a, b + 1).forEach((x) => s.add(x));
      } else if (s.has(k)) s.delete(k); else s.add(k);
      changerSelection(s);
    }
    derniereCliquee.current = k;
  }

  // ─── Édition : validation & enregistrement ────────────────────────────────
  const editables = visibles.filter((c) => c.editable !== false && !c.valeur);
  const validerValeurs = (valeurs: Record<string, unknown>, ligne: T) => {
    const erreurs: Record<string, string> = {};
    for (const c of colonnes.filter((x) => x.editable !== false && !x.valeur)) {
      const m = valider(c, valeurs[c.champ], { ...ligne, ...valeurs } as T);
      if (m) erreurs[c.champ] = m;
    }
    return erreurs;
  };
  const differences = (ligne: T, valeurs: Record<string, unknown>) => {
    const d: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valeurs)) if ((ligne as Record<string, unknown>)[k] !== v) d[k] = v;
    return d as Partial<T>;
  };
  async function executer(fn: () => Promise<void> | void) {
    setEnCours(true); setErreurEdition(null);
    // Mode distant : la vérité est côté serveur, on relit la page / les groupes après écriture
    try { await fn(); distant.recharger(); return true; }
    catch (e: any) { setErreurEdition(e?.message ?? 'Enregistrement impossible.'); return false; }
    finally { setEnCours(false); }
  }

  function commencerAjout() {
    const base = { ...(edition?.nouvelleLigne?.() ?? {}) } as Record<string, unknown>;
    if (modeEdition === 'formulaire') { setFormulaire({ ligne: null, valeurs: base, erreurs: {} }); return; }
    if (modeEdition === 'lot') {
      const nouvelle = { ...base, __cleTemp: `${CLE_NOUVELLE}${++compteurNouvelles.current}` } as unknown as T;
      setLot((l) => ({ ...l, ajoutees: [...l.ajoutees, nouvelle] }));
      return;
    }
    setLigneEditee({ cle: CLE_NOUVELLE, valeurs: base, nouvelle: true, erreurs: {} });
  }
  function commencerModification(ligne: T) {
    if (modeEdition === 'formulaire') {
      setFormulaire({ ligne, valeurs: Object.fromEntries(colonnes.map((c) => [c.champ, (ligne as Record<string, unknown>)[c.champ]])), erreurs: {} });
      return;
    }
    setLigneEditee({ cle: cleDe(ligne), valeurs: Object.fromEntries(colonnes.map((c) => [c.champ, (ligne as Record<string, unknown>)[c.champ]])), nouvelle: false, erreurs: {} });
  }
  async function enregistrerLigne() {
    if (!ligneEditee) return;
    const ligne = (donneesAffichees.find((l) => cleDe(l) === ligneEditee.cle) ?? {}) as T;
    const erreurs = validerValeurs(ligneEditee.valeurs, ligne);
    if (Object.keys(erreurs).length) { setLigneEditee({ ...ligneEditee, erreurs }); return; }
    const ok = await executer(() => (ligneEditee.nouvelle
      ? edition?.surAjout?.({ ...ligneEditee.valeurs } as T)
      : edition?.surModification?.(ligneEditee.cle, differences(ligne, ligneEditee.valeurs), ligne)));
    if (ok) setLigneEditee(null);
  }
  async function enregistrerFormulaire() {
    if (!formulaire) return;
    const base = (formulaire.ligne ?? {}) as T;
    const erreurs = validerValeurs(formulaire.valeurs, base);
    if (Object.keys(erreurs).length) { setFormulaire({ ...formulaire, erreurs }); return; }
    const ok = await executer(() => (formulaire.ligne
      ? edition?.surModification?.(cleDe(formulaire.ligne), differences(formulaire.ligne, formulaire.valeurs), formulaire.ligne)
      : edition?.surAjout?.({ ...formulaire.valeurs } as T)));
    if (ok) setFormulaire(null);
  }
  /** Validation d'une cellule (mode cellule : immédiat ; mode lot : mis en attente). */
  async function validerCellule() {
    if (!celluleEditee) return;
    const ligne = donneesAffichees.find((l) => cleDe(l) === celluleEditee.cle);
    const col = colonnes.find((c) => c.champ === celluleEditee.champ);
    if (!ligne || !col) { setCelluleEditee(null); return; }
    const m = valider(col, celluleEditee.valeur, ligne);
    if (m) { setCelluleEditee({ ...celluleEditee, erreur: m }); return; }
    if ((ligne as Record<string, unknown>)[col.champ] === celluleEditee.valeur) { setCelluleEditee(null); return; }
    if (modeEdition === 'lot') {
      const k = String(celluleEditee.cle);
      if (k.startsWith(CLE_NOUVELLE)) {
        setLot((l) => ({ ...l, ajoutees: l.ajoutees.map((a) => (cleDe(a) === celluleEditee.cle ? { ...a, [col.champ]: celluleEditee.valeur } : a)) }));
      } else {
        setLot((l) => ({ ...l, modifiees: { ...l.modifiees, [k]: { ...(l.modifiees[k] ?? {}), [col.champ]: celluleEditee.valeur } as Partial<T> } }));
      }
      setCelluleEditee(null);
      return;
    }
    const ok = await executer(() => edition?.surModification?.(celluleEditee.cle, { [col.champ]: celluleEditee.valeur } as Partial<T>, ligne));
    if (ok) setCelluleEditee(null);
  }
  const lotModifie = Object.keys(lot.modifiees).length + lot.ajoutees.length + lot.supprimees.length > 0;
  async function enregistrerLot() {
    const ok = await executer(async () => {
      for (const l of lot.ajoutees) {
        const { __cleTemp: _t, ...propre } = l as Record<string, unknown>;
        const erreurs = validerValeurs(propre, propre as T);
        if (Object.keys(erreurs).length) throw new Error(`Nouvelle ligne : ${Object.values(erreurs)[0]}`);
        await edition?.surAjout?.(propre as T);
      }
      for (const [k, changements] of Object.entries(lot.modifiees)) {
        const ligne = sourceDonnees.find((d) => String(cle(d)) === k);
        if (ligne && !lot.supprimees.some((s) => String(s) === k)) await edition?.surModification?.(cle(ligne), changements, ligne);
      }
      for (const k of lot.supprimees) {
        const ligne = sourceDonnees.find((d) => cle(d) === k);
        if (ligne) await edition?.surSuppression?.(k, ligne);
      }
    });
    if (ok) setLot({ modifiees: {}, ajoutees: [], supprimees: [] });
  }
  async function supprimer(ligne: T) {
    const k = cleDe(ligne);
    if (modeEdition === 'lot') {
      if (String(k).startsWith(CLE_NOUVELLE)) setLot((l) => ({ ...l, ajoutees: l.ajoutees.filter((a) => cleDe(a) !== k) }));
      else setLot((l) => ({ ...l, supprimees: l.supprimees.includes(k) ? l.supprimees.filter((s) => s !== k) : [...l.supprimees, k] }));
      return;
    }
    if (edition?.confirmerSuppression !== false && !aSupprimer) { setASupprimer(ligne); return; }
    const ok = await executer(() => edition?.surSuppression?.(k, ligne));
    if (ok) setASupprimer(null);
  }

  // ─── Colonnes : glisser-déposer, redimensionnement, menus ─────────────────
  const [flottant, setFlottant] = useState<ReactNode>(null);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [glisseEnTete, setGlisseEnTete] = useState(false);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [pdf, setPdf] = useState<PrintDocument | null>(null);
  const [survolGroupes, setSurvolGroupes] = useState(false);
  const redim = useRef<{ champ: string; x: number; l: number } | null>(null);
  const [largeurTemp, setLargeurTemp] = useState<{ champ: string; l: number } | null>(null);
  const largeurTempRef = useRef<{ champ: string; l: number } | null>(null);

  useEffect(() => {
    const bouger = (e: MouseEvent) => {
      if (!redim.current) return;
      const col = colonnes.find((c) => c.champ === redim.current!.champ);
      const delta = (e.clientX - redim.current.x) * (rtl ? -1 : 1);
      const l = { champ: redim.current.champ, l: Math.max(col?.largeurMin ?? 50, redim.current.l + delta) };
      largeurTempRef.current = l; // lu au lâcher, même si le rendu n'a pas encore eu lieu
      setLargeurTemp(l);
    };
    const lacher = () => {
      if (redim.current && largeurTempRef.current) actions.redimensionner(largeurTempRef.current.champ, largeurTempRef.current.l);
      redim.current = null; largeurTempRef.current = null; setLargeurTemp(null);
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', bouger);
    window.addEventListener('mouseup', lacher);
    return () => { window.removeEventListener('mousemove', bouger); window.removeEventListener('mouseup', lacher); };
  }, [colonnes, actions, rtl]);
  const largeurEff = (c: ColonneGrille<T>) => (largeurTemp?.champ === c.champ ? largeurTemp.l : largeur(c));

  function menuEntete(e: ME, c: ColonneGrille<T>) {
    e.preventDefault();
    const ancre = new DOMRect(e.clientX, e.clientY, 0, 0);
    const tri = etat.tri.find((t) => t.champ === c.champ);
    const groupe = etat.groupes.includes(c.champ);
    const cote = colonnesAff.find((x) => x.champ === c.champ)?.figee;
    const entrees: EntreeMenu[] = [
      { libelle: 'Tri croissant', action: () => actions.trierSens(c.champ, 'asc'), actif: tri?.sens === 'asc', desactive: c.triable === false },
      { libelle: 'Tri décroissant', action: () => actions.trierSens(c.champ, 'desc'), actif: tri?.sens === 'desc', desactive: c.triable === false },
      { libelle: 'Effacer le tri', action: () => actions.trier(c.champ, 'retrait'), desactive: !tri },
      { libelle: groupe ? 'Ne plus grouper' : 'Grouper par cette colonne', separateur: true, desactive: c.groupable === false,
        action: () => (groupe ? actions.degrouper(c.champ) : actions.grouper(c.champ)) },
      ...(etat.groupes.length ? [
        ...(distant.actif ? [] : [{ libelle: 'Tout déplier', action: actions.toutDeplier }]),
        { libelle: 'Tout replier', action: actions.toutReplier },
      ] : []),
      { libelle: 'Figer à gauche', separateur: true, action: () => actions.figer(c.champ, 'gauche'), actif: cote === 'gauche' },
      { libelle: 'Figer à droite', action: () => actions.figer(c.champ, 'droite'), actif: cote === 'droite' },
      { libelle: 'Libérer la colonne', action: () => actions.figer(c.champ, 'aucune'), desactive: !cote },
      { libelle: 'Masquer la colonne', separateur: true, action: () => actions.basculerVisibilite(c.champ), desactive: c.masquable === false },
      { libelle: 'Ajuster au contenu', action: () => ajusterAuContenu(c.champ) },
      { libelle: 'Ajuster toutes les colonnes', action: ajusterTout },
      { libelle: 'Largeur par défaut', action: () => actions.redimensionner(c.champ, largeurDefaut(c)) },
    ];
    setFlottant(<MenuContextuel ancre={ancre} entrees={entrees} onFermer={() => setFlottant(null)} />);
  }
  function ouvrirFiltreEntete(e: ME, c: ColonneGrille<T>) {
    e.stopPropagation();
    const ancre = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ouvrir = (valeurs: { cle?: string; texte: string; nombre: number }[]) => setFlottant(
      <FiltreEntete ancre={ancre} valeurs={valeurs}
                    retenues={etat.filtresEntete[c.champ]} onAppliquer={(v) => actions.filtrerEntete(c.champ, v)}
                    onFermer={() => setFlottant(null)} />);
    // Mode distant : valeurs et effectifs calculés par le serveur (GROUP BY)
    if (distant.actif) {
      setFlottant(<Flottant ancre={ancre} onFermer={() => setFlottant(null)} largeur={260}><Loading className="p-3" /></Flottant>);
      distant.valeursEntete(c.champ, c).then(ouvrir).catch((err) => {
        setFlottant(null);
        setErreurEdition(err?.message ?? 'Valeurs indisponibles.');
      });
      return;
    }
    // Valeurs possibles compte tenu des AUTRES filtres (comme DevExtreme)
    const { [c.champ]: _moi, ...autres } = etat.filtresEntete;
    const base = filtrer(donneesAffichees, colonnes, { ...etat, filtresEntete: autres });
    ouvrir(valeursDistinctes(base, c));
  }
  function ouvrirOperateur(e: ME, c: ColonneGrille<T>) {
    const courant = etat.filtres[c.champ];
    setFlottant(
      <Flottant ancre={(e.currentTarget as HTMLElement).getBoundingClientRect()} onFermer={() => setFlottant(null)} largeur={190}>
        <div className="py-1">
          {operateursPour(c.type).map((op) => (
            <button key={op} onClick={() => {
              actions.filtrer(c.champ, { operateur: op, valeur: courant?.valeur, valeur2: courant?.valeur2 });
              setFlottant(null);
            }} className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-ink">
              <span className="w-6 text-center money text-ink-muted">{SYMBOLES_OPERATEURS[op]}</span>
              <span className={(courant?.operateur ?? operateurDefaut(c.type)) === op ? 'font-bold text-brand-text' : ''}>{LIBELLES_OPERATEURS[op]}</span>
            </button>
          ))}
          <div className="border-t border-line-soft my-1" />
          <button onClick={() => { actions.filtrer(c.champ, null); setFlottant(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-ink-label">
            <span className="w-6 inline-flex justify-center text-ink-muted"><Icon name="refresh" size={14} /></span>Réinitialiser
          </button>
        </div>
      </Flottant>,
    );
  }

  // ─── Défilement virtuel ───────────────────────────────────────────────────
  const corpsRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ haut: 0, hauteur: 600 });
  useEffect(() => {
    const el = corpsRef.current;
    if (!el) return;
    const maj2 = () => setScroll({ haut: el.scrollTop, hauteur: el.clientHeight });
    maj2();
    const ro = new ResizeObserver(maj2);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const tampon = 8;
  const debutVirtuel = defilementVirtuel ? Math.max(0, Math.floor(scroll.haut / hLigne) - tampon) : 0;
  const finVirtuel = defilementVirtuel ? Math.min(elementsPage.length, Math.ceil((scroll.haut + scroll.hauteur) / hLigne) + tampon) : elementsPage.length;
  const elementsRendus = elementsPage.slice(debutVirtuel, finVirtuel);
  /** Premier chargement (aucune ligne encore affichée) : squelette de lignes au lieu d'un voile sur une table vide */
  const premierChargement = (!!chargement || distant.chargement) && elementsPage.length === 0 && !ligneEditee?.nouvelle;

  // ─── Géométrie des colonnes (figées : positions « sticky ») ───────────────
  const aSelection = selection === 'multiple';
  const aDetail = !!detail;
  // Colonne de commandes : suppression, ou bouton Modifier (modes ligne / formulaire)
  const aCommandes = !!edition && (edition.suppression !== false
    || (edition.modification !== false && (modeEdition === 'ligne' || modeEdition === 'formulaire')));
  const debutGauche = (aSelection ? L_SELECTION : 0) + (aDetail ? L_DETAIL : 0) + etat.groupes.length * 18;
  const positions = useMemo(() => {
    const p: Record<string, { left?: number; right?: number }> = {};
    let g = debutGauche;
    for (const c of visibles.filter((x) => x.figee === 'gauche')) { p[c.champ] = { left: g }; g += largeurEff(c); }
    let d = aCommandes ? L_COMMANDES : 0;
    for (const c of [...visibles.filter((x) => x.figee === 'droite')].reverse()) { p[c.champ] = { right: d }; d += largeurEff(c); }
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibles, etat.largeurs, largeurTemp, debutGauche, aCommandes]);
  const styleFige = (c: ColonneGrille<T>, fond: string): React.CSSProperties => {
    const p = positions[c.champ];
    if (!p) return {};
    return { position: 'sticky', ...(rtl ? { right: p.left, left: p.right } : p), zIndex: 2, background: fond };
  };
  const largeurTotale = debutGauche + visibles.reduce((s, c) => s + largeurEff(c), 0) + (aCommandes ? L_COMMANDES : 0);

  // ─── Défilement horizontal : ombres de bord (colonnes cachées à gauche / à droite) ─
  const [bords, setBords] = useState({ gauche: false, droite: false });
  const majBords = useCallback(() => {
    const el = corpsRef.current;
    if (!el) return;
    const gauche = el.scrollLeft > 1;
    const droite = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setBords((b) => (b.gauche === gauche && b.droite === droite ? b : { gauche, droite }));
  }, []);
  useEffect(() => {
    const el = corpsRef.current;
    if (!el) return;
    majBords();
    const ro = new ResizeObserver(majBords);
    ro.observe(el);
    return () => ro.disconnect();
  }, [majBords, largeurTotale, elementsPage.length]);
  // Les ombres commencent après les colonnes figées (elles restent visibles au défilement)
  const bordGauche = Math.max(aSelection ? L_SELECTION : 0,
    ...visibles.filter((c) => positions[c.champ]?.left != null).map((c) => positions[c.champ].left! + largeurEff(c)));
  const bordDroit = Math.max(aCommandes ? L_COMMANDES : 0,
    ...visibles.filter((c) => positions[c.champ]?.right != null).map((c) => positions[c.champ].right! + largeurEff(c)));

  // ─── Ajustement des largeurs au contenu (double-clic sur la poignée, menus) ──
  function mesurer(champ: string): number | null {
    const el = corpsRef.current;
    if (!el) return null;
    const sel = `[data-champ="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(champ) : champ}"]`;
    let max = 0;
    el.querySelectorAll<HTMLElement>(`th${sel}`).forEach((th) => {
      const texte = th.querySelector<HTMLElement>('.truncate');
      max = Math.max(max, (texte?.scrollWidth ?? 0) + 58);   // padding + icônes de tri / filtre
    });
    el.querySelectorAll<HTMLElement>(`td${sel}`).forEach((td) => { max = Math.max(max, td.scrollWidth + 4); });
    return max > 0 ? Math.min(640, Math.max(56, Math.ceil(max))) : null;
  }
  function ajusterAuContenu(champ: string) {
    const l = mesurer(champ);
    if (l) actions.redimensionner(champ, l);
  }
  function ajusterTout() {
    for (const c of visibles) if (c.redimensionnable !== false) ajusterAuContenu(c.champ);
  }

  // ─── Vues (modèles de liste) : prédéfinies + enregistrées sur le poste ─────
  const [vuesPerso, setVuesPerso] = useState<VueUtilisateur[]>(() => lireVues(cleEtat));
  const [nommerVue, setNommerVue] = useState<string | null>(null);
  const toutesVues: VueGrille[] = [...(vues ?? []), ...vuesPerso];
  const memeDisposition = (v: VueGrille) => {
    const d = v.etat;
    const ordre = d.ordreColonnes ?? colonnes.map((c) => c.champ);
    const cachees = d.masquees ?? colonnes.filter((c) => c.visible === false).map((c) => c.champ);
    const visiblesVue = ordre.filter((c) => !cachees.includes(c)).join('|');
    const visiblesEtat = etat.ordreColonnes.filter((c) => !etat.masquees.includes(c)).join('|');
    return visiblesVue === visiblesEtat;
  };
  // Vue courante : celle appliquée, sinon la première vue prédéfinie si la disposition y correspond (vue par défaut)
  const vueCourante = toutesVues.find((v) => v.id === etat.vue)
    ?? (!etat.vue && vues?.[0] && memeDisposition(vues[0]) ? vues[0] : undefined);
  const vueModifiee = !!vueCourante && !memeDisposition(vueCourante);
  function enregistrerVue(libelle: string) {
    if (!cleEtat) return;
    const v: VueUtilisateur = { id: `u:${Date.now().toString(36)}`, libelle, etat: disposition(etat) };
    const liste = [...vuesPerso, v];
    setVuesPerso(liste);
    ecrireVues(cleEtat, liste);
    actions.appliquerVue(v.id, v.etat);
  }
  function supprimerVue(id: string) {
    if (!cleEtat) return;
    const liste = vuesPerso.filter((v) => v.id !== id);
    setVuesPerso(liste);
    ecrireVues(cleEtat, liste);
  }
  const avecMenuVue = selecteurColonnes && (!!cleEtat || (vues?.length ?? 0) > 0);
  const elementsVue: MenuItem[] = [
    ...(toutesVues.length ? [{ heading: 'Vues' } as MenuItem] : []),
    ...toutesVues.map<MenuItem>((v) => ({
      label: v.libelle, icon: v.id === vueCourante?.id ? 'check' : undefined, hint: v.id.startsWith('u:') ? 'perso' : undefined,
      onSelect: () => actions.appliquerVue(v.id, v.etat),
    })),
    ...(cleEtat ? [
      { label: 'Enregistrer la vue actuelle…', icon: 'save', onSelect: () => setNommerVue('') } as MenuItem,
      ...(etat.vue?.startsWith('u:') ? [{ label: `Supprimer la vue « ${vueCourante?.libelle ?? ''} »`, icon: 'trash', tone: 'danger', onSelect: () => supprimerVue(etat.vue!) } as MenuItem] : []),
    ] : []),
    'separator',
    { heading: 'Densité des lignes' },
    ...(['compacte', 'normale', 'confort'] as DensiteGrille[]).map<MenuItem>((d) => ({
      label: LIBELLES_DENSITE[d], icon: densite === d ? 'check' : undefined, onSelect: () => actions.densite(d),
    })),
    'separator',
    { label: 'Retour à la ligne dans les cellules', icon: retour ? 'check' : undefined, onSelect: () => actions.basculerRetour(retourLigne) },
    { label: 'Ajuster les colonnes au contenu', icon: 'columns', onSelect: ajusterTout },
    { label: 'Rétablir la disposition par défaut', icon: 'refresh', onSelect: actions.reinitialiser },
  ];
  const menuVue = avecMenuVue ? (
    <Menu size="sm" icon="layers" width={290} items={elementsVue}
          label={<span className="inline-flex items-center gap-1.5"><Icon name="layers" size={16} />{vueCourante ? vueCourante.libelle : 'Vue'}{vueModifiee && <span className="text-warning-text" title="Disposition modifiée depuis l'application de la vue">•</span>}</span>} />
  ) : null;

  // ─── Navigation clavier ───────────────────────────────────────────────────
  function clavier(e: KE) {
    if (celluleEditee || ligneEditee || formulaire || (e.target as HTMLElement).closest('input,select,textarea')) return;
    const max = elementsPage.length - 1;
    let { index, col } = focus;
    const el = elementsPage[index];
    switch (e.key) {
      case 'ArrowDown': index = Math.min(max, index + 1); break;
      case 'ArrowUp': index = Math.max(0, index - 1); break;
      case 'ArrowRight': if (el?.type === 'groupe' && el.replie) { actions.basculerGroupe(el.noeud.cle); break; } col = Math.min(visibles.length - 1, col + (rtl ? -1 : 1)); break;
      case 'ArrowLeft': if (el?.type === 'groupe' && !el.replie) { actions.basculerGroupe(el.noeud.cle); break; } col = Math.max(0, col - (rtl ? -1 : 1)); break;
      case 'Home': index = 0; break;
      case 'End': index = max; break;
      case 'PageDown': if (pagine && page < pages - 1) actions.page(page + 1); else index = Math.min(max, index + 10); break;
      case 'PageUp': if (pagine && page > 0) actions.page(page - 1); else index = Math.max(0, index - 10); break;
      case 'Enter':
      case 'F2': {
        if (el?.type === 'groupe') { actions.basculerGroupe(el.noeud.cle); break; }
        if (el?.type === 'info') { el.action?.(); break; }
        if (el?.type === 'ligne') {
          const c = visibles[col];
          if ((modeEdition === 'cellule' || modeEdition === 'lot') && c && c.editable !== false && !c.valeur)
            setCelluleEditee({ cle: cleDe(el.ligne), champ: c.champ, valeur: valeurDe(c, el.ligne) });
          else if (modeEdition && edition?.modification !== false && e.key === 'F2') commencerModification(el.ligne);
          else (props.surDoubleClicLigne ?? props.surClicLigne)?.(el.ligne);
        }
        break;
      }
      case ' ':
        if (el?.type === 'ligne' && aSelection) {
          const s = new Set(selectionnees); const k = cleDe(el.ligne);
          if (s.has(k)) s.delete(k); else s.add(k);
          changerSelection(s);
        }
        break;
      case 'Delete':
        if (el?.type === 'ligne' && modeEdition && edition?.suppression !== false) void supprimer(el.ligne);
        break;
      default: return;
    }
    e.preventDefault();
    setFocus({ index, col });
    const cible = elementsPage[index];
    if (cible?.type === 'ligne') { setActive(cleDe(cible.ligne)); props.surLigneActive?.(cible.ligne); }
    // Défilement pour garder la ligne visible
    corpsRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  // ─── Rendu : cellules ─────────────────────────────────────────────────────
  function editeur(c: ColonneGrille<T>, valeur: unknown, changer: (v: unknown) => void, valider2: () => void, annuler: () => void, ligne: T, autoFocus = false) {
    if (c.editeur) return c.editeur({ valeur, ligne, changer, valider: valider2, annuler });
    const touches = (e: KE) => { if (e.key === 'Enter') { e.preventDefault(); valider2(); } if (e.key === 'Escape') { e.preventDefault(); annuler(); } };
    const cls = 'w-full border border-brand-500 rounded-sm px-1.5 py-0.5 bg-surface text-ink text-sm outline-none';
    if (c.choix) return (
      <select autoFocus={autoFocus} value={String(valeur ?? '')} onKeyDown={touches}
              onChange={(e) => changer(c.choix!.find((x) => String(x.valeur) === e.target.value)?.valeur ?? e.target.value)} className={cls}>
        <option value="">—</option>
        {c.choix.map((x) => <option key={String(x.valeur)} value={String(x.valeur)}>{x.libelle}</option>)}
      </select>
    );
    if (c.type === 'boolean') return <input autoFocus={autoFocus} type="checkbox" checked={!!valeur} onKeyDown={touches} onChange={(e) => changer(e.target.checked)} />;
    if (c.type === 'date') return <input autoFocus={autoFocus} type="date" value={isoDate(valeur)} onKeyDown={touches} onChange={(e) => changer(e.target.value)} className={cls} />;
    if (estNum(c.type)) return (
      <input autoFocus={autoFocus} type="number" step="any" value={valeur === null || valeur === undefined ? '' : String(valeur)} onKeyDown={touches}
             onChange={(e) => changer(e.target.value === '' ? null : Number(e.target.value))} className={`${cls} text-right money`} />
    );
    return <input autoFocus={autoFocus} value={String(valeur ?? '')} onKeyDown={touches} onChange={(e) => changer(e.target.value)} className={cls} />;
  }

  function contenuCellule(c: ColonneGrille<T>, ligne: T): ReactNode {
    const v = valeurDe(c, ligne);
    if (c.rendu) return c.rendu(ligne, v);
    if (c.type === 'boolean') return <input type="checkbox" checked={!!v} readOnly tabIndex={-1} className="pointer-events-none" />;
    return texteDe(c, v);
  }

  const alignement = (c: ColonneGrille<T>) => c.alignement ?? (estNum(c.type) ? 'right' : c.type === 'boolean' ? 'center' : 'left');
  // Fonds de ligne (jetons v2, thémés clair / sombre) : sélection = surface-active, ligne active = brand-soft,
  // alternance = surface-sunken. Les cellules figées lisent `--fond-ligne` (défini sur le <tr>) pour suivre le survol.
  const fondLigne = (i: number, estActive: boolean, estSel: boolean) =>
    estSel ? 'var(--surface-active)' : estActive && ligneActive ? 'var(--brand-soft)'
      : lignesAlternees && i % 2 ? 'var(--surface-sunken)' : 'var(--surface)';
  /** Liseré de début de ligne : sélection (brand-line) ou ligne active (brand-500, plus marqué). */
  const lisereLigne = (estActive: boolean, estSel: boolean): React.CSSProperties => {
    const couleur = estActive && ligneActive ? 'var(--brand-500)' : estSel ? 'var(--brand-line)' : null;
    return couleur ? { boxShadow: `inset ${rtl ? -3 : 3}px 0 0 ${couleur}` } : {};
  };

  function rendreLigne(ligne: T, indexPage: number) {
    const k = cleDe(ligne);
    const enEdition = ligneEditee && ligneEditee.cle === k;
    const estSel = selectionnees.has(k);
    const estActive = active === k;
    // Le fond réel est porté par `--fond-ligne` : il vaut le fond calculé, ou --surface-hover au survol
    // (hors ligne sélectionnée / active), et les cellules figées le lisent aussi.
    const fondCalcule = fondLigne(indexPage, estActive, estSel);
    const fond = 'var(--fond-ligne)';
    const survolable = !estSel && !(estActive && ligneActive);
    const lisere = lisereLigne(estActive, estSel);
    const supprimee = lot.supprimees.includes(k);
    const nouvelle = String(k).startsWith(CLE_NOUVELLE);
    const modifs = lot.modifiees[String(k)];
    return (
      <Fragment key={String(k)}>
        <tr data-index={indexPage} onClick={(e) => cliquerLigne(e, ligne)}
            onDoubleClick={() => { if (modeEdition === 'ligne' || modeEdition === 'formulaire') { if (edition?.modification !== false) commencerModification(ligne); } else props.surDoubleClicLigne?.(ligne); }}
            className={`${supprimee ? 'line-through opacity-50' : ''} ${bordures ? '' : 'border-b border-line-soft'} ${props.surClicLigne ? 'cursor-pointer' : ''} [--fond-ligne:var(--fond-base)] ${survolable ? 'hover:[--fond-ligne:var(--surface-hover)]' : ''}`}
            style={{ '--fond-base': fondCalcule, background: fond, height: defilementVirtuel ? hLigne : undefined, ...(props.styleLigne?.(ligne) ?? {}) } as React.CSSProperties}>
          {etat.groupes.map((g, gi) => <td key={g} style={{ width: 18, ...(gi === 0 ? lisere : {}) }} />)}
          {aSelection && (
            <td className="text-center" style={{ width: L_SELECTION, position: 'sticky', left: 0, zIndex: 2, background: fond, ...(etat.groupes.length ? {} : lisere) }} onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" className="accent-[var(--brand-700)] align-middle" aria-label="Sélectionner la ligne" checked={estSel} onChange={(e) => {
                const s = new Set(selectionnees);
                if ((e.nativeEvent as MouseEvent).shiftKey && derniereCliquee.current != null) {
                  const ordre = triees.map(cleDe);
                  const [a, b] = [ordre.indexOf(derniereCliquee.current), ordre.indexOf(k)].sort((x, y) => x - y);
                  if (a >= 0) ordre.slice(a, b + 1).forEach((x) => s.add(x));
                } else if (s.has(k)) s.delete(k); else s.add(k);
                derniereCliquee.current = k;
                changerSelection(s);
              }} />
            </td>
          )}
          {aDetail && (
            <td className="text-center" style={{ width: L_DETAIL, ...(etat.groupes.length || aSelection ? {} : lisere) }}>
              <IconButton size="xs" icon={details.has(k) ? 'chevronDown' : 'chevronRight'} label="Détail" aria-expanded={details.has(k)}
                          onClick={(e) => { e.stopPropagation(); setDetails((d) => { const n = new Set(d); if (n.has(k)) n.delete(k); else n.add(k); return n; }); }}
                          className="!h-5 !w-5 align-middle text-ink-muted hover:!text-brand-text" />
            </td>
          )}
          {visibles.map((c, ci) => {
            const enCellule = celluleEditee && celluleEditee.cle === k && celluleEditee.champ === c.champ;
            const editable = c.editable !== false && !c.valeur && !supprimee;
            const focusIci = focus.index === indexPage && focus.col === ci;
            const modifiee = modifs && c.champ in (modifs as object);
            return (
              <td key={c.champ} data-champ={c.champ}
                  onClick={() => {
                    setFocus({ index: indexPage, col: ci });
                    if ((modeEdition === 'cellule' || modeEdition === 'lot') && editable && edition?.modification !== false && !enCellule) {
                      if (celluleEditee) void validerCellule();
                      setCelluleEditee({ cle: k, champ: c.champ, valeur: valeurDe(c, ligne) });
                    }
                  }}
                  className={`px-2.5 ${padCellule} ${retour ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'} ${estNum(c.type) ? 'money' : ''} ${bordures ? 'border border-line-soft' : ''}`}
                  style={{
                    textAlign: alignement(c), ...styleFige(c, fond),
                    ...(ci === 0 && !etat.groupes.length && !aSelection && !aDetail ? lisere : {}),
                    outline: focusIci ? '2px solid var(--brand-500)' : undefined, outlineOffset: -2,
                    background: modifiee || (nouvelle && modeEdition === 'lot') ? 'var(--success-soft)' : styleFige(c, fond).background,
                  }}>
                {enEdition && editable ? (
                  <>
                    {editeur(c, ligneEditee!.valeurs[c.champ], (v) => setLigneEditee((le) => le && ({ ...le, valeurs: { ...le.valeurs, [c.champ]: v } })),
                      () => void enregistrerLigne(), () => setLigneEditee(null), ligne, ci === visibles.findIndex((x) => x.editable !== false && !x.valeur))}
                    {ligneEditee!.erreurs[c.champ] && <div className="text-xs font-semibold text-danger-text">{ligneEditee!.erreurs[c.champ]}</div>}
                  </>
                ) : enCellule ? (
                  <>
                    {editeur(c, celluleEditee!.valeur, (v) => setCelluleEditee((ce) => ce && ({ ...ce, valeur: v, erreur: undefined })),
                      () => void validerCellule(), () => setCelluleEditee(null), ligne, true)}
                    {celluleEditee!.erreur && <div className="text-xs font-semibold text-danger-text">{celluleEditee!.erreur}</div>}
                  </>
                ) : contenuCellule(c, ligne)}
              </td>
            );
          })}
          {aCommandes && (
            <td className="text-center whitespace-nowrap" style={{ width: L_COMMANDES, position: 'sticky', right: 0, zIndex: 2, background: fond }} onClick={(e) => e.stopPropagation()}>
              <span className="inline-flex items-center justify-center gap-0.5 align-middle">
                {enEdition ? (
                  <>
                    <IconButton size="xs" icon="check" tone="brand" label="Enregistrer" onClick={() => void enregistrerLigne()} disabled={enCours} />
                    <IconButton size="xs" icon="close" label="Annuler" onClick={() => setLigneEditee(null)} />
                  </>
                ) : (
                  <>
                    {edition?.modification !== false && modeEdition !== 'lot' && modeEdition !== 'cellule' && (
                      <IconButton size="xs" icon="edit" label="Modifier" onClick={() => commencerModification(ligne)} className="text-ink-muted hover:!text-brand-text" />
                    )}
                    {edition?.suppression !== false && (
                      <IconButton size="xs" icon={supprimee ? 'return' : 'trash'} tone="danger" label={supprimee ? 'Rétablir' : 'Supprimer'}
                                  onClick={() => void supprimer(ligne)} />
                    )}
                  </>
                )}
              </span>
            </td>
          )}
        </tr>
        {aDetail && details.has(k) && (
          <tr>
            <td colSpan={visibles.length + etat.groupes.length + (aSelection ? 1 : 0) + 1 + (aCommandes ? 1 : 0)}
                className="px-4 py-3 border-b border-line-soft bg-sunken">
              {detail!(ligne)}
            </td>
          </tr>
        )}
      </Fragment>
    );
  }

  /** Total affiché : calculé sur `lignes`, ou fourni par le serveur (mode distant, clés `champ:type`) */
  function valeurResume(r: Resume<T>, lignes: T[], serveur?: Record<string, number | null>): ReactNode {
    const v = serveur && r.type !== 'custom' ? serveur[`${r.colonne}:${r.type}`] ?? null : calculerResume(r, lignes, colonnes);
    if (v === null) return null;
    const col = colonnes.find((c) => c.champ === r.colonne);
    const texte = r.format ? r.format(v) : typeof v === 'number' && col && r.type !== 'count' ? texteDe(col, v) : String(v);
    return <span><span className="text-ink-muted font-normal">{r.libelle ?? LIBELLES_RESUME[r.type]} : </span>{texte}</span>;
  }

  function rendreGroupe(n: NoeudGroupe<T>, replie: boolean, indexPage: number) {
    const col = colonnes.find((c) => c.champ === n.champ);
    const resumesTexte = (resumesGroupe ?? []).map((r, i) => <span key={i} className="ml-3">{valeurResume(r, n.lignes, n.resumesDistants)}</span>);
    return (
      <tr key={n.cle} data-index={indexPage} className="border-b border-line-soft cursor-pointer select-none"
          onClick={() => { actions.basculerGroupe(n.cle); setFocus({ index: indexPage, col: focus.col }); }}
          style={{ background: 'var(--brand-soft)', height: defilementVirtuel ? hLigne : undefined,
                   outline: focus.index === indexPage ? '2px solid var(--brand-500)' : undefined, outlineOffset: -2 }}
          aria-expanded={!replie}>
        <td colSpan={visibles.length + etat.groupes.length + (aSelection ? 1 : 0) + (aDetail ? 1 : 0) + (aCommandes ? 1 : 0)}
            className="px-2.5 py-1.5 font-bold text-sm text-ink" style={{ paddingInlineStart: 10 + n.niveau * 18 }}>
          <span className="inline-flex w-4 align-middle -mt-0.5 text-brand-text"><Icon name={replie ? 'chevronRight' : 'chevronDown'} size={14} /></span>
          {col?.titre ?? n.champ} : {n.texte}
          <span className="text-ink-muted font-normal"> ({n.nombre ?? n.lignes.length})</span>
          {resumesTexte}
        </td>
      </tr>
    );
  }

  /** Mode distant : « Chargement… », erreur ou « Afficher plus » sous un groupe ouvert */
  function rendreInfo(el: Extract<ElementAffiche<T>, { type: 'info' }>, indexPage: number) {
    return (
      <tr key={el.cle} data-index={indexPage} className="border-b border-line-soft"
          style={{ height: defilementVirtuel ? hLigne : undefined,
                   outline: focus.index === indexPage ? '2px solid var(--brand-500)' : undefined, outlineOffset: -2 }}>
        <td colSpan={visibles.length + etat.groupes.length + (aSelection ? 1 : 0) + (aDetail ? 1 : 0) + (aCommandes ? 1 : 0)}
            className="px-2.5 py-1.5 text-xs" style={{ paddingInlineStart: 28 + el.niveau * 18 }}>
          {el.action
            ? <button onClick={el.action} className="font-bold text-brand-text hover:underline">{el.texte}</button>
            : <span className="text-ink-muted">{el.texte}</span>}
        </td>
      </tr>
    );
  }

  // ─── Export ───────────────────────────────────────────────────────────────
  const opts = props.export;
  // Colonnes sans titre (boutons d'action) exclues de l'export
  const colonnesExport = opts?.colonnes ?? visibles.filter((c) => c.titre !== '');
  // Mode distant : tout le résultat filtré et trié est redemandé au serveur (pas seulement la page)
  const lignesExport = async (): Promise<T[]> => {
    if (opts?.selectionSeule && selectionnees.size) return triees.filter((l) => selectionnees.has(cleDe(l)));
    if (!distant.actif) return triees;
    setExportEnCours(true);
    try { return await distant.chargerTout(); } finally { setExportEnCours(false); }
  };
  function menuExport(e: ME) {
    const nom = opts?.nom ?? 'export';
    const entrees: EntreeMenu[] = [
      ...(opts?.excel !== false ? [{ libelle: 'Excel (.xlsx)', action: () => void lignesExport().then((l) => exporterGrilleExcel(nom, colonnesExport, l, { groupes: opts?.colonnes ? undefined : arbre ?? undefined, resumes })).catch((e) => setErreurEdition(e?.message ?? 'Export impossible.')) }] : []),
      ...(opts?.csv !== false ? [{ libelle: 'CSV (Excel FR)', action: () => void lignesExport().then((l) => exporterGrilleCsv(nom, colonnesExport, l)).catch((e) => setErreurEdition(e?.message ?? 'Export impossible.')) }] : []),
      ...(opts?.pdf !== false ? [{ libelle: 'PDF / Imprimer', action: () => void lignesExport().then((l) => setPdf(documentPdfGrille(typeof titre === 'string' ? titre : nom, colonnesExport, l, resumes))).catch((e) => setErreurEdition(e?.message ?? 'Export impossible.')) }] : []),
      ...(selectionnees.size ? [{ libelle: `Sélection seule (${selectionnees.size})`, separateur: true, actif: !!opts?.selectionSeule, action: () => void 0, desactive: true }] : []),
    ];
    setFlottant(<MenuContextuel ancre={(e.currentTarget as HTMLElement).getBoundingClientRect()} entrees={entrees} onFermer={() => setFlottant(null)} />);
  }

  // ─── Filtres actifs (panneau) ─────────────────────────────────────────────
  const filtresActifs = [
    ...Object.entries(etat.filtres).filter(([, f]) => f.operateur === 'vide' || f.operateur === 'non_vide' || (f.valeur !== undefined && f.valeur !== ''))
      .map(([champ, f]) => {
        const c = colonnes.find((x) => x.champ === champ);
        const v = f.operateur === 'entre' ? `${f.valeur ?? ''} et ${f.valeur2 ?? ''}` : f.valeur === undefined ? '' : ` « ${f.valeur} »`;
        return `[${c?.titre ?? champ}] ${LIBELLES_OPERATEURS[f.operateur].toLowerCase()}${f.operateur === 'entre' ? ' ' + v : v}`;
      }),
    ...Object.entries(etat.filtresEntete).map(([champ, vals]) => `[${colonnes.find((x) => x.champ === champ)?.titre ?? champ}] parmi (${vals.map((v) => v || '(vide)').join(', ')})`),
    ...(etat.recherche ? [`Recherche « ${etat.recherche} »`] : []),
  ];

  // ─── En-têtes à bandes ────────────────────────────────────────────────────
  const aBandes = visibles.some((c) => c.bande);
  const bandes: { titre: string | null; n: number }[] = [];
  for (const c of visibles) {
    const b = c.bande ?? null;
    if (bandes.length && bandes[bandes.length - 1].titre === b && b !== null) bandes[bandes.length - 1].n++;
    else bandes.push({ titre: b, n: 1 });
  }
  const debutColonnesSysteme = etat.groupes.length + (aSelection ? 1 : 0) + (aDetail ? 1 : 0);

  const thBase = 'px-2.5 py-2 text-xs font-semibold text-ink-label bg-sunken border-b border-line select-none';
  /** Fond des cellules d'en-tête / de pied figées (identique à `bg-sunken`). */
  const FOND_ENTETE = 'var(--surface-sunken)';

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} className="bg-surface border border-line-soft rounded-md shadow-soft flex flex-col min-w-0"
         style={{ height: hauteur }}>
      {/* Barre d'outils */}
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-line-soft">
        {titre && <div className="font-bold text-base text-ink mr-2">{titre}</div>}
        {barreOutils}
        <div className="ms-auto flex items-center gap-1.5 flex-wrap">
          {lotModifie && (
            <>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning-text">
                <Icon name="alertCircle" size={14} />Modifications en attente
              </span>
              <Button size="sm" variant="primary" icon="save" onClick={() => void enregistrerLot()} disabled={enCours}>Enregistrer</Button>
              <Button size="sm" variant="ghost" onClick={() => setLot({ modifiees: {}, ajoutees: [], supprimees: [] })}>Annuler</Button>
            </>
          )}
          {edition?.ajout !== false && edition && (
            <Button size="sm" variant={lotModifie ? 'secondary' : 'primary'} icon="plus" onClick={commencerAjout} title="Ajouter une ligne">Ajouter</Button>
          )}
          {etat.groupes.length > 0 && (
            <>
              {!distant.actif && <IconButton size="sm" variant="secondary" icon="plus" label="Tout déplier" onClick={actions.toutDeplier} />}
              <IconButton size="sm" variant="secondary" icon="minus" label="Tout replier" onClick={actions.toutReplier} />
            </>
          )}
          {rechercheGlobale && (
            <SearchField size="sm" width={200} value={etat.recherche} onChange={(v) => actions.rechercher(v)}
                         placeholder="Rechercher…" label="Rechercher dans la liste" />
          )}
          {ligneFiltre === 'bascule' && (
            <Button size="sm" icon="filter" pressed={filtresOuverts} onClick={() => setFiltresOuverts((o) => !o)} title="Afficher la ligne de filtre">
              Filtres{Object.keys(etat.filtres).length ? ` (${Object.keys(etat.filtres).length})` : ''}
            </Button>
          )}
          {menuVue}
          {selecteurColonnes && (
            <Button size="sm" icon="columns" title="Colonnes" onClick={(e) => setFlottant(
              <SelecteurColonnes ancre={e.currentTarget.getBoundingClientRect()}
                                 colonnes={colonnes.map((c) => ({ champ: c.champ, titre: c.titre ?? c.champ, masquable: c.masquable !== false }))}
                                 masquees={etat.masquees} onBasculer={actions.basculerVisibilite} onReinitialiser={actions.reinitialiser}
                                 figees={Object.fromEntries(colonnesAff.map((c) => [c.champ, c.figee]))} onFiger={actions.figer}
                                 onFermer={() => setFlottant(null)} />,
            )}>Colonnes</Button>
          )}
          {opts && (
            <Button size="sm" icon="download" iconRight="chevronDown" onClick={menuExport} title="Exporter" disabled={exportEnCours} loading={exportEnCours}>
              {exportEnCours ? 'Export…' : 'Exporter'}
            </Button>
          )}
        </div>
      </div>

      {/* Zone de regroupement (glisser un en-tête ici) */}
      {(panneauGroupes === true || (panneauGroupes === 'auto' && (glisseEnTete || etat.groupes.length > 0))) && (
        <div onDragOver={(e) => { if (e.dataTransfer.types.includes(TYPE_DND)) { e.preventDefault(); setSurvolGroupes(true); } }}
             onDragLeave={() => setSurvolGroupes(false)}
             onDrop={(e) => { const champ = e.dataTransfer.getData(TYPE_DND); setSurvolGroupes(false); setGlisseEnTete(false); if (champ && colonnes.find((c) => c.champ === champ)?.groupable !== false) actions.grouper(champ); }}
             className={`flex items-center gap-1.5 flex-wrap px-3 py-1.5 border-b border-line-soft min-h-[34px] text-xs ${survolGroupes ? 'bg-brand-soft' : 'bg-sunken'}`}
             style={survolGroupes ? { boxShadow: 'inset 0 0 0 1px var(--brand-line)' } : undefined}>
          {etat.groupes.length === 0 && (
            <span className="inline-flex items-center gap-1.5 text-ink-muted"><Icon name="layers" size={14} />Glissez un en-tête de colonne ici pour grouper par cette colonne</span>
          )}
          {etat.groupes.map((g, i) => {
            const c = colonnes.find((x) => x.champ === g);
            const t = etat.tri.find((x) => x.champ === g);
            return (
              <Fragment key={g}>
                {i > 0 && <Icon name="chevronRight" size={14} className="text-ink-muted" />}
                <span draggable onDragStart={(e) => e.dataTransfer.setData(TYPE_DND, g)}
                      className="inline-flex items-center gap-1 h-6 border border-brand-line rounded-sm bg-brand-soft ps-2 pe-0.5 font-semibold text-brand-text cursor-grab">
                  <button onClick={() => actions.trier(g, 'simple')} title="Trier les groupes" className="inline-flex items-center gap-1">
                    {c?.titre ?? g}
                    {t && <Icon name={t.sens === 'asc' ? 'arrowUp' : 'arrowDown'} size={12} label={t.sens === 'asc' ? 'croissant' : 'décroissant'} />}
                  </button>
                  <button onClick={() => actions.degrouper(g)} title="Retirer" aria-label={`Retirer le groupe ${c?.titre ?? g}`}
                          className="inline-flex items-center justify-center h-5 w-5 rounded-xs text-ink-muted hover:text-ink hover:bg-hover">
                    <Icon name="close" size={12} />
                  </button>
                </span>
              </Fragment>
            );
          })}
        </div>
      )}

      {erreurEdition && (
        <Alert tone="danger" compact onClose={() => setErreurEdition(null)} className="mx-3 my-2">{erreurEdition}</Alert>
      )}

      {/* Tableau (ombres de bord : il reste des colonnes à gauche / à droite) */}
      <div className="relative flex-1 min-h-[120px] flex flex-col">
      {!rtl && bords.gauche && (
        <span aria-hidden="true" className="pointer-events-none absolute top-0 bottom-0 z-[6] w-3"
              style={{ left: bordGauche, background: 'linear-gradient(to right, var(--scroll-shadow), transparent)' }} />
      )}
      {!rtl && bords.droite && (
        <span aria-hidden="true" className="pointer-events-none absolute top-0 bottom-0 z-[6] w-3"
              style={{ right: bordDroit, background: 'linear-gradient(to left, var(--scroll-shadow), transparent)' }} />
      )}
      <div ref={corpsRef} tabIndex={0} onKeyDown={clavier}
           onScroll={(e) => { if (defilementVirtuel) setScroll({ haut: e.currentTarget.scrollTop, hauteur: e.currentTarget.clientHeight }); majBords(); }}
           className="flex-1 overflow-auto outline-none relative min-h-[120px]">
        <table className="text-sm text-ink" style={{ tableLayout: 'fixed', width: Math.max(largeurTotale, 0), minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <colgroup>
            {etat.groupes.map((g) => <col key={g} style={{ width: 18 }} />)}
            {aSelection && <col style={{ width: L_SELECTION }} />}
            {aDetail && <col style={{ width: L_DETAIL }} />}
            {visibles.map((c) => <col key={c.champ} style={{ width: c.flexible && !etat.largeurs[c.champ] && largeurTemp?.champ !== c.champ ? undefined : largeurEff(c) }} />)}
            {aCommandes && <col style={{ width: L_COMMANDES }} />}
          </colgroup>
          <thead className="sticky top-0 z-[3]">
            {aBandes && (
              <tr>
                {debutColonnesSysteme > 0 && <th colSpan={debutColonnesSysteme} className={thBase} />}
                {bandes.map((b, i) => (
                  <th key={i} colSpan={b.n} className={`${thBase} text-center ${b.titre ? 'border-x border-line-soft' : ''}`}>{b.titre ?? ''}</th>
                ))}
                {aCommandes && <th className={thBase} />}
              </tr>
            )}
            <tr>
              {etat.groupes.map((g) => <th key={g} className={thBase} />)}
              {aSelection && (
                <th className={`${thBase} text-center`} style={{ position: 'sticky', left: 0, zIndex: 4 }}>
                  <input type="checkbox" className="accent-[var(--brand-700)] align-middle" aria-label="Tout sélectionner" checked={toutCoche} ref={(el) => { if (el) el.indeterminate = partielCoche; }}
                         title={toutSelectionner === 'page' ? 'Toute la page' : 'Toutes les lignes filtrées'}
                         onChange={() => {
                           const s = new Set(selectionnees);
                           perimetreTout.forEach((l) => (toutCoche ? s.delete(cleDe(l)) : s.add(cleDe(l))));
                           changerSelection(s);
                         }} />
                </th>
              )}
              {aDetail && <th className={thBase} />}
              {visibles.map((c) => {
                const t = etat.tri.findIndex((x) => x.champ === c.champ);
                const tri = t >= 0 ? etat.tri[t] : null;
                const filtreEnt = !!etat.filtresEntete[c.champ]?.length;
                return (
                  <th key={c.champ} data-champ={c.champ} draggable={reorganisationColonnes || !!panneauGroupes}
                      onDragStart={(e) => { e.dataTransfer.setData(TYPE_DND, c.champ); e.dataTransfer.effectAllowed = 'move'; setGlisseEnTete(true); }}
                      onDragEnd={() => setGlisseEnTete(false)}
                      onDragOver={(e) => { if (reorganisationColonnes && e.dataTransfer.types.includes(TYPE_DND)) e.preventDefault(); }}
                      onDrop={(e) => {
                        const champ = e.dataTransfer.getData(TYPE_DND);
                        if (!champ || champ === c.champ) return;
                        // Comme DevExpress : une colonne ne quitte pas sa bande (l'en-tête bandé resterait scindé)
                        if ((colonnes.find((x) => x.champ === champ)?.bande ?? '') !== (c.bande ?? '')) return;
                        actions.degrouper(champ); actions.deplacerColonne(champ, c.champ);
                      }}
                      onContextMenu={(e) => menuEntete(e, c)}
                      onClick={(e) => { if (c.triable === false) return; actions.trier(c.champ, e.ctrlKey || e.metaKey ? 'retrait' : e.shiftKey ? 'ajout' : 'simple'); }}
                      className={`${thBase} relative group ${c.triable === false ? '' : 'cursor-pointer hover:text-ink'}`}
                      style={{ textAlign: alignement(c), ...styleFige(c, FOND_ENTETE), zIndex: positions[c.champ] ? 4 : undefined }}
                      aria-sort={tri && etat.tri.length === 1 ? (tri.sens === 'asc' ? 'ascending' : 'descending') : undefined}
                      title="Clic : trier · Maj+clic : tri multiple · Ctrl+clic : retirer · Clic droit : menu">
                    <span className="inline-flex items-center gap-1 max-w-full align-middle">
                      <span className="truncate">{c.titre ?? c.champ}</span>
                      {tri && (
                        <span className="inline-flex items-center text-brand-text">
                          <Icon name={tri.sens === 'asc' ? 'arrowUp' : 'arrowDown'} size={12} label={tri.sens === 'asc' ? 'Tri croissant' : 'Tri décroissant'} />
                          {etat.tri.length > 1 ? <sub className="text-2xs font-bold">{t + 1}</sub> : null}
                        </span>
                      )}
                      {c.filtreEntete !== false && (
                        <button onClick={(e) => ouvrirFiltreEntete(e, c)} title="Filtrer par valeurs" aria-label={`Filtrer ${c.titre ?? c.champ} par valeurs`}
                                className={`inline-flex flex-none items-center justify-center h-5 w-5 rounded-xs hover:bg-hover focus-visible:opacity-100 ${filtreEnt ? 'text-brand-text bg-brand-soft' : 'text-ink-muted opacity-0 group-hover:opacity-100'}`}>
                          <Icon name="filter" size={12} />
                        </button>
                      )}
                    </span>
                    {redimensionnementColonnes && c.redimensionnable !== false && (
                      <span onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); redim.current = { champ: c.champ, x: e.clientX, l: largeurEff(c) }; document.body.style.cursor = 'col-resize'; }}
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => { e.stopPropagation(); ajusterAuContenu(c.champ); }}
                            title="Glisser : redimensionner · Double-clic : ajuster au contenu"
                            className="absolute top-0 h-full w-1.5 cursor-col-resize hover:bg-brand-line" style={{ [rtl ? 'left' : 'right']: 0 }} />
                    )}
                  </th>
                );
              })}
              {aCommandes && <th className={thBase} style={{ position: 'sticky', right: 0, zIndex: 4 }} />}
            </tr>
            {(ligneFiltre === true || (ligneFiltre === 'bascule' && filtresOuverts)) && (
              <tr>
                {debutColonnesSysteme > 0 && <th colSpan={debutColonnesSysteme} className="bg-surface border-b border-line-soft" />}
                {visibles.map((c) => {
                  const f = etat.filtres[c.champ];
                  const op = f?.operateur ?? operateurDefaut(c.type);
                  const fixer = (patch: Partial<FiltreColonne>) => {
                    const suivant = { operateur: op, valeur: f?.valeur, valeur2: f?.valeur2, ...patch };
                    const videF = (suivant.valeur === undefined || suivant.valeur === '' || suivant.valeur === null) && suivant.operateur !== 'vide' && suivant.operateur !== 'non_vide';
                    actions.filtrer(c.champ, videF && !f ? null : suivant);
                  };
                  const cls = `${CONTROL} min-w-0 h-6 px-1.5 font-normal text-xs`;
                  const type = c.type === 'date' ? 'date' : estNum(c.type) ? 'number' : 'text';
                  return (
                    <th key={c.champ} className="px-1.5 py-1 bg-surface border-b border-line-soft font-normal" style={styleFige(c, 'var(--surface)')}>
                      {c.filtrable === false ? null : (
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => ouvrirOperateur(e, c)} title={LIBELLES_OPERATEURS[op]} aria-label={`Opérateur : ${LIBELLES_OPERATEURS[op]}`}
                                  className={`w-6 h-6 flex-none text-center money text-xs rounded-sm hover:bg-hover ${f ? 'text-brand-text font-bold bg-brand-soft' : 'text-ink-muted'}`}>
                            {SYMBOLES_OPERATEURS[op]}
                          </button>
                          {op === 'vide' || op === 'non_vide' ? null : c.type === 'boolean' ? (
                            <select value={f?.valeur === undefined ? '' : String(f.valeur)} className={cls}
                                    onChange={(e) => fixer({ valeur: e.target.value === '' ? undefined : e.target.value === 'true' })}>
                              <option value="">(tous)</option><option value="true">Oui</option><option value="false">Non</option>
                            </select>
                          ) : c.choix ? (
                            <select value={f?.valeur === undefined ? '' : String(f.valeur)} className={cls}
                                    onChange={(e) => fixer({ operateur: '=', valeur: e.target.value === '' ? undefined : c.choix!.find((x) => String(x.valeur) === e.target.value)?.valeur })}>
                              <option value="">(tous)</option>
                              {c.choix.map((x) => <option key={String(x.valeur)} value={String(x.valeur)}>{x.libelle}</option>)}
                            </select>
                          ) : (
                            <>
                              <input type={type} value={f?.valeur === undefined || f?.valeur === null ? '' : String(f.valeur)} className={cls}
                                     onChange={(e) => fixer({ valeur: e.target.value === '' ? undefined : type === 'number' ? Number(e.target.value) : e.target.value })} />
                              {op === 'entre' && (
                                <input type={type} value={f?.valeur2 === undefined || f?.valeur2 === null ? '' : String(f.valeur2)} className={cls}
                                       onChange={(e) => fixer({ valeur2: e.target.value === '' ? undefined : type === 'number' ? Number(e.target.value) : e.target.value })} />
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
                {aCommandes && <th className="bg-surface border-b border-line-soft" style={{ position: 'sticky', right: 0 }} />}
              </tr>
            )}
          </thead>
          <tbody>
            {ligneEditee?.nouvelle && (edition?.positionNouvelle !== 'fin') && rendreNouvelle()}
            {defilementVirtuel && debutVirtuel > 0 && <tr style={{ height: debutVirtuel * hLigne }} />}
            {elementsRendus.map((el, i) => (el.type === 'groupe'
              ? rendreGroupe(el.noeud, el.replie, debutVirtuel + i)
              : el.type === 'info' ? rendreInfo(el, debutVirtuel + i)
              : rendreLigne(el.ligne, debutVirtuel + i)))}
            {defilementVirtuel && finVirtuel < elementsPage.length && <tr style={{ height: (elementsPage.length - finVirtuel) * hLigne }} />}
            {ligneEditee?.nouvelle && edition?.positionNouvelle === 'fin' && rendreNouvelle()}
            {premierChargement && Array.from({ length: 8 }, (_, i) => (
              <tr key={`squelette-${i}`} aria-hidden="true" style={{ height: hLigne }}>
                {debutColonnesSysteme > 0 && <td colSpan={debutColonnesSysteme} />}
                {visibles.map((c, ci) => (
                  <td key={c.champ} className={`px-2.5 ${padCellule}`} style={{ textAlign: alignement(c) }}>
                    <Skeleton height={10} width={`${estNum(c.type) ? 50 : 45 + ((i * 17 + ci * 23) % 45)}%`} />
                  </td>
                ))}
                {aCommandes && <td />}
              </tr>
            ))}
          </tbody>
          {resumes?.length ? (
            <tfoot className="sticky bottom-0 z-[3]">
              <tr className="font-bold">
                {debutColonnesSysteme > 0 && <td colSpan={debutColonnesSysteme} className="bg-sunken border-t border-line" />}
                {visibles.map((c) => {
                  const rs = resumes.filter((r) => (r.afficherDans ?? r.colonne) === c.champ);
                  return (
                    <td key={c.champ} className="px-2.5 py-2 bg-sunken border-t border-line whitespace-nowrap money text-xs"
                        style={{ textAlign: alignement(c), ...styleFige(c, FOND_ENTETE) }}>
                      {rs.map((r, i) => <div key={i}>{valeurResume(r, triees, distant.actif ? distant.resumes : undefined)}</div>)}
                    </td>
                  );
                })}
                {aCommandes && <td className="bg-sunken border-t border-line" style={{ position: 'sticky', right: 0 }} />}
              </tr>
            </tfoot>
          ) : props.pied && nbResultat > 0 ? (
            <tfoot className="sticky bottom-0 z-[3]">
              <tr className="font-bold">
                {debutColonnesSysteme > 0 && <td colSpan={debutColonnesSysteme} className="bg-sunken border-t border-line" />}
                {visibles.map((c, i) => (
                  <td key={c.champ} className="px-2.5 py-2 bg-sunken border-t border-line whitespace-nowrap text-xs"
                      style={{ textAlign: alignement(c), ...styleFige(c, FOND_ENTETE) }}>
                    {i === 0 && props.pied!._label !== undefined ? props.pied!._label : props.pied![c.champ]}
                  </td>
                ))}
                {aCommandes && <td className="bg-sunken border-t border-line" style={{ position: 'sticky', right: 0 }} />}
              </tr>
            </tfoot>
          ) : null}
        </table>
        {!chargement && !distant.chargement && elementsPage.length === 0 && !ligneEditee?.nouvelle && (
          (erreur ?? distant.erreur)
            ? <div className="sticky left-0 p-4 max-w-full"><Alert tone="danger">{erreur ?? distant.erreur}</Alert></div>
            : <div className="sticky left-0 max-w-full"><EmptyState icon="inbox" size="sm" title={messageVide} /></div>
        )}
        {distant.erreur && elementsPage.length > 0 && (
          <div className="sticky left-0 px-3 py-2 max-w-full"><Alert tone="danger" compact>{distant.erreur}</Alert></div>
        )}
        {(chargement || distant.chargement) && !premierChargement && <LoadingOverlay />}
      </div>
      </div>

      {nommerVue !== null && (
        <Dialog title="Enregistrer la vue" subtitle="Colonnes, ordre, largeurs, colonnes figées, tri et densité" icon="save" size="sm"
                onClose={() => setNommerVue(null)} closeOnOverlay={false}
                footer={(
                  <>
                    <Button onClick={() => setNommerVue(null)}>Annuler</Button>
                    <Button variant="primary" icon="check" disabled={!nommerVue.trim()}
                            onClick={() => { enregistrerVue(nommerVue.trim()); setNommerVue(null); }}>Enregistrer</Button>
                  </>
                )}>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-label">Nom de la vue
            <TextInput autoFocus value={nommerVue} onChange={(e) => setNommerVue(e.target.value)} placeholder="Ex. Recouvrement du mois"
                       onKeyDown={(e) => { if (e.key === 'Enter' && nommerVue.trim()) { enregistrerVue(nommerVue.trim()); setNommerVue(null); } }} />
          </label>
        </Dialog>
      )}

      {/* Panneau des filtres actifs */}
      {panneauFiltre && filtresActifs.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-line-soft text-xs bg-brand-soft">
          <Icon name="filter" size={14} className="text-brand-text" />
          <span className="flex-1 truncate text-ink-label" title={filtresActifs.join(' et ')}>{filtresActifs.join(' et ')}</span>
          <Button size="xs" variant="link" icon="close" onClick={actions.effacerFiltres}>Effacer les filtres</Button>
        </div>
      )}

      {/* Pagination */}
      {pagine && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-line-soft text-xs text-ink-label flex-wrap">
          <span>Lignes par page</span>
          <Select size="sm" value={etat.taillePage} onChange={(e) => actions.taillePage(Number(e.target.value))}
                  aria-label="Lignes par page" className="!w-auto">
            {taillesPage.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <span className="ms-auto">
            Page {page + 1} sur {pages} ({nbResultat} ligne{nbResultat > 1 ? 's' : ''}{!distant.actif && triees.length !== donneesAffichees.length ? ` sur ${donneesAffichees.length}` : ''})
          </span>
          <nav className="flex items-center gap-0.5" aria-label="Pagination">
            <IconButton size="sm" variant="secondary" icon="chevronsLeft" label="Première page" disabled={page === 0} onClick={() => actions.page(0)} />
            <IconButton size="sm" variant="secondary" icon="chevronLeft" label="Page précédente" disabled={page === 0} onClick={() => actions.page(page - 1)} />
            {pagesVisibles(page, pages).map((p, i) => (p < 0 ? <span key={`e${i}`} className="px-1 text-ink-muted">…</span> : (
              <Button key={p} size="sm" variant={p === page ? 'primary' : 'ghost'} onClick={() => actions.page(p)}
                      aria-current={p === page ? 'page' : undefined} className="min-w-[28px] !px-1.5 money">{p + 1}</Button>
            )))}
            <IconButton size="sm" variant="secondary" icon="chevronRight" label="Page suivante" disabled={page >= pages - 1} onClick={() => actions.page(page + 1)} />
            <IconButton size="sm" variant="secondary" icon="chevronsRight" label="Dernière page" disabled={page >= pages - 1} onClick={() => actions.page(pages - 1)} />
          </nav>
        </div>
      )}
      {!pagine && (
        <div className="px-3 py-1.5 border-t border-line-soft text-xs text-ink-muted">
          {nbResultat} ligne{nbResultat > 1 ? 's' : ''}{!distant.actif && triees.length !== donneesAffichees.length ? ` sur ${donneesAffichees.length}` : ''}{selectionnees.size ? ` · ${selectionnees.size} sélectionnée(s)` : ''}
        </div>
      )}

      {flottant}
      {pdf && <PrintPreview doc={pdf} onClose={() => setPdf(null)} />}
      {aSupprimer && (
        <ConfirmDialog title="Supprimer cette ligne ?" message="Cette action est définitive." confirmLabel="Supprimer" danger loading={enCours}
                       onConfirm={() => void supprimer(aSupprimer)} onCancel={() => setASupprimer(null)} />
      )}
      {formulaire && (
        <Dialog title={formulaire.ligne ? 'Modifier la ligne' : 'Nouvelle ligne'} size="md" closeOnOverlay={false}
                icon={formulaire.ligne ? 'edit' : 'plus'} onClose={() => setFormulaire(null)}
                footer={(
                  <>
                    <Button onClick={() => setFormulaire(null)}>Annuler</Button>
                    <Button variant="primary" icon="save" onClick={() => void enregistrerFormulaire()} disabled={enCours}>Enregistrer</Button>
                  </>
                )}>
          <div className="grid grid-cols-2 gap-3">
            {colonnes.filter((c) => c.editable !== false && !c.valeur).map((c, i) => (
              <label key={c.champ} className="flex flex-col gap-1 min-w-0 text-xs font-semibold text-ink-label">
                <span>
                  {c.titre ?? c.champ}
                  {c.validation?.some((r) => r.type === 'requis') && <span className="text-danger-text ml-0.5" aria-hidden="true">*</span>}
                </span>
                <div className="font-normal">
                  {editeur(c, formulaire.valeurs[c.champ], (v) => setFormulaire((f) => f && ({ ...f, valeurs: { ...f.valeurs, [c.champ]: v }, erreurs: { ...f.erreurs, [c.champ]: '' } })),
                    () => void enregistrerFormulaire(), () => setFormulaire(null), (formulaire.ligne ?? {}) as T, i === 0)}
                </div>
                {formulaire.erreurs[c.champ] && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-danger-text">
                    <Icon name="alertCircle" size={14} />{formulaire.erreurs[c.champ]}
                  </span>
                )}
              </label>
            ))}
          </div>
        </Dialog>
      )}
    </div>
  );

  function rendreNouvelle() {
    const vide = {} as T;
    return (
      <tr key={CLE_NOUVELLE} style={{ background: 'var(--success-soft)' }} className="border-b border-line-soft">
        {Array.from({ length: debutColonnesSysteme }).map((_, i) => <td key={i} />)}
        {visibles.map((c) => (
          <td key={c.champ} className="px-2.5 py-1.5" style={styleFige(c, 'var(--surface)')}>
            {c.editable !== false && !c.valeur ? (
              <>
                {editeur(c, ligneEditee!.valeurs[c.champ], (v) => setLigneEditee((le) => le && ({ ...le, valeurs: { ...le.valeurs, [c.champ]: v } })),
                  () => void enregistrerLigne(), () => setLigneEditee(null), vide, c === editables[0])}
                {ligneEditee!.erreurs[c.champ] && <div className="text-xs font-semibold text-danger-text">{ligneEditee!.erreurs[c.champ]}</div>}
              </>
            ) : null}
          </td>
        ))}
        {aCommandes && (
          <td className="text-center whitespace-nowrap" style={{ position: 'sticky', right: 0, background: 'var(--surface)' }}>
            <span className="inline-flex items-center justify-center gap-0.5 align-middle">
              <IconButton size="xs" icon="check" tone="brand" label="Enregistrer" onClick={() => void enregistrerLigne()} disabled={enCours} />
              <IconButton size="xs" icon="close" label="Annuler" onClick={() => setLigneEditee(null)} />
            </span>
          </td>
        )}
      </tr>
    );
  }
}

/** Numéros de page affichés : première, dernière, voisines de la courante (−1 = ellipse). */
function pagesVisibles(page: number, pages: number): number[] {
  const set = new Set([0, pages - 1, page - 1, page, page + 1].filter((p) => p >= 0 && p < pages));
  const tri = [...set].sort((a, b) => a - b);
  const sortie: number[] = [];
  tri.forEach((p, i) => { if (i && p - tri[i - 1] > 1) sortie.push(-1); sortie.push(p); });
  return sortie;
}

export type { GrilleProps, ColonneGrille } from './types';
