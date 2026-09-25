import { Fragment, KeyboardEvent as KE, MouseEvent as ME, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ConfirmDialog from '../ui/ConfirmDialog';
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
import { ColonneGrille, FiltreColonne, GrilleProps, Resume } from './types';
import { useEtatGrille } from './useEtatGrille';

type Cle = string | number;
const CLE_NOUVELLE = '__nouvelle__';
const L_SELECTION = 36;
const L_DETAIL = 30;
const L_COMMANDES = 84;
const TYPE_DND = 'text/x-grille-colonne';

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
    cleEtat, styleLigne,
  } = props;

  const colonnes = useMemo(() => colonnesEffectives(colonnesProp, donnees),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colonnesProp, donnees.length > 0 ? Object.keys(donnees[0] as object).join() : '']);
  const optPagination = typeof pagination === 'object' ? pagination : {};
  const taillesPage = optPagination.tailles ?? [10, 20, 50, 100];
  const { etat, actions } = useEtatGrille(colonnes, optPagination.taille ?? 20, cleEtat);
  const visibles = useMemo(() => colonnesVisibles(colonnes, etat), [colonnes, etat]);
  const largeur = (c: ColonneGrille<T>) => etat.largeurs[c.champ] ?? largeurDefaut(c);

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
    const fusion = donnees.map((d) => {
      const m = lot.modifiees[String(cle(d))];
      return m ? ({ ...d, ...m }) as T : d;
    });
    return edition?.positionNouvelle === 'fin' ? [...fusion, ...lot.ajoutees] : [...lot.ajoutees, ...fusion];
  }, [donnees, lot, cle, edition?.positionNouvelle]);

  // ─── Chaîne de données ────────────────────────────────────────────────────
  const filtrees = useMemo(() => filtrer(donneesAffichees, colonnes, etat), [donneesAffichees, colonnes, etat]);
  const triees = useMemo(() => trier(filtrees, colonnes, etat.tri), [filtrees, colonnes, etat.tri]);
  const arbre = useMemo(() => (etat.groupes.length ? grouper(triees, colonnes, etat.groupes) : null), [triees, colonnes, etat.groupes]);
  const elements: ElementAffiche<T>[] = useMemo(
    () => (arbre ? aplatir(arbre, etat) : triees.map((ligne) => ({ type: 'ligne' as const, ligne }))),
    [arbre, triees, etat],
  );
  const pagine = !defilementVirtuel && pagination !== false;
  const { elements: elementsPage, pages, page } = useMemo(
    () => (pagine ? paginer(elements, etat.page, etat.taillePage) : { elements, pages: 1, page: 0 }),
    [elements, pagine, etat.page, etat.taillePage],
  );

  // ─── Sélection, ligne active, détail ──────────────────────────────────────
  const [selectionnees, setSelectionnees] = useState<Set<Cle>>(() => new Set(props.selectionnees ?? []));
  const derniereCliquee = useRef<Cle | null>(null);
  const [active, setActive] = useState<Cle | null>(null);
  const [focus, setFocus] = useState<{ index: number; col: number }>({ index: 0, col: 0 });
  const [details, setDetails] = useState<Set<Cle>>(new Set());

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
    try { await fn(); return true; }
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
        const ligne = donnees.find((d) => String(cle(d)) === k);
        if (ligne && !lot.supprimees.some((s) => String(s) === k)) await edition?.surModification?.(cle(ligne), changements, ligne);
      }
      for (const k of lot.supprimees) {
        const ligne = donnees.find((d) => cle(d) === k);
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
    const entrees: EntreeMenu[] = [
      { libelle: 'Tri croissant', action: () => actions.trierSens(c.champ, 'asc'), actif: tri?.sens === 'asc', desactive: c.triable === false },
      { libelle: 'Tri décroissant', action: () => actions.trierSens(c.champ, 'desc'), actif: tri?.sens === 'desc', desactive: c.triable === false },
      { libelle: 'Effacer le tri', action: () => actions.trier(c.champ, 'retrait'), desactive: !tri },
      { libelle: groupe ? 'Ne plus grouper' : 'Grouper par cette colonne', separateur: true, desactive: c.groupable === false,
        action: () => (groupe ? actions.degrouper(c.champ) : actions.grouper(c.champ)) },
      ...(etat.groupes.length ? [
        { libelle: 'Tout déplier', action: actions.toutDeplier },
        { libelle: 'Tout replier', action: actions.toutReplier },
      ] : []),
      { libelle: 'Masquer la colonne', separateur: true, action: () => actions.basculerVisibilite(c.champ), desactive: c.masquable === false },
      { libelle: 'Ajuster la largeur', action: () => actions.redimensionner(c.champ, largeurDefaut(c)) },
    ];
    setFlottant(<MenuContextuel ancre={ancre} entrees={entrees} onFermer={() => setFlottant(null)} />);
  }
  function ouvrirFiltreEntete(e: ME, c: ColonneGrille<T>) {
    e.stopPropagation();
    // Valeurs possibles compte tenu des AUTRES filtres (comme DevExtreme)
    const { [c.champ]: _moi, ...autres } = etat.filtresEntete;
    const base = filtrer(donneesAffichees, colonnes, { ...etat, filtresEntete: autres });
    setFlottant(<FiltreEntete ancre={(e.currentTarget as HTMLElement).getBoundingClientRect()} valeurs={valeursDistinctes(base, c)}
                              retenues={etat.filtresEntete[c.champ]} onAppliquer={(v) => actions.filtrerEntete(c.champ, v)}
                              onFermer={() => setFlottant(null)} />);
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
            }} className="w-full text-left px-3 py-1.5 hover:bg-line-soft flex gap-2">
              <span className="w-6 text-center money text-ink-muted">{SYMBOLES_OPERATEURS[op]}</span>
              <span className={(courant?.operateur ?? operateurDefaut(c.type)) === op ? 'font-bold text-brand-700' : ''}>{LIBELLES_OPERATEURS[op]}</span>
            </button>
          ))}
          <div className="border-t border-line-soft my-1" />
          <button onClick={() => { actions.filtrer(c.champ, null); setFlottant(null); }} className="w-full text-left px-3 py-1.5 hover:bg-line-soft">Réinitialiser</button>
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
  const debutVirtuel = defilementVirtuel ? Math.max(0, Math.floor(scroll.haut / hauteurLigne) - tampon) : 0;
  const finVirtuel = defilementVirtuel ? Math.min(elementsPage.length, Math.ceil((scroll.haut + scroll.hauteur) / hauteurLigne) + tampon) : elementsPage.length;
  const elementsRendus = elementsPage.slice(debutVirtuel, finVirtuel);

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
    const cls = 'w-full border border-brand-500 rounded-sm px-1.5 py-0.5 bg-surface text-ink text-[12px] outline-none';
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
  const fondLigne = (i: number, estActive: boolean, estSel: boolean) =>
    estSel ? 'var(--brand-50)' : estActive && ligneActive ? 'color-mix(in srgb, var(--brand-500) 10%, var(--surface))'
      : lignesAlternees && i % 2 ? 'color-mix(in srgb, var(--line-soft) 45%, var(--surface))' : 'var(--surface)';

  function rendreLigne(ligne: T, indexPage: number) {
    const k = cleDe(ligne);
    const enEdition = ligneEditee && ligneEditee.cle === k;
    const estSel = selectionnees.has(k);
    const estActive = active === k;
    const fond = fondLigne(indexPage, estActive, estSel);
    const supprimee = lot.supprimees.includes(k);
    const nouvelle = String(k).startsWith(CLE_NOUVELLE);
    const modifs = lot.modifiees[String(k)];
    return (
      <Fragment key={String(k)}>
        <tr data-index={indexPage} onClick={(e) => cliquerLigne(e, ligne)}
            onDoubleClick={() => { if (modeEdition === 'ligne' || modeEdition === 'formulaire') { if (edition?.modification !== false) commencerModification(ligne); } else props.surDoubleClicLigne?.(ligne); }}
            className={`${supprimee ? 'line-through opacity-50' : ''} ${bordures ? '' : 'border-b border-line-soft'} ${props.surClicLigne ? 'cursor-pointer' : ''} hover:brightness-[0.98]`}
            style={{ background: fond, height: defilementVirtuel ? hauteurLigne : undefined, ...(props.styleLigne?.(ligne) ?? {}) }}>
          {etat.groupes.map((g) => <td key={g} style={{ width: 18 }} />)}
          {aSelection && (
            <td className="text-center" style={{ width: L_SELECTION, position: 'sticky', left: 0, zIndex: 2, background: fond }} onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={estSel} onChange={(e) => {
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
            <td className="text-center" style={{ width: L_DETAIL }}>
              <button onClick={(e) => { e.stopPropagation(); setDetails((d) => { const n = new Set(d); if (n.has(k)) n.delete(k); else n.add(k); return n; }); }}
                      className="text-ink-muted hover:text-brand-700 w-5" title="Détail">{details.has(k) ? '▾' : '▸'}</button>
            </td>
          )}
          {visibles.map((c, ci) => {
            const enCellule = celluleEditee && celluleEditee.cle === k && celluleEditee.champ === c.champ;
            const editable = c.editable !== false && !c.valeur && !supprimee;
            const focusIci = focus.index === indexPage && focus.col === ci;
            const modifiee = modifs && c.champ in (modifs as object);
            return (
              <td key={c.champ}
                  onClick={() => {
                    setFocus({ index: indexPage, col: ci });
                    if ((modeEdition === 'cellule' || modeEdition === 'lot') && editable && edition?.modification !== false && !enCellule) {
                      if (celluleEditee) void validerCellule();
                      setCelluleEditee({ cle: k, champ: c.champ, valeur: valeurDe(c, ligne) });
                    }
                  }}
                  className={`px-2.5 py-1.5 ${retourLigne ? 'whitespace-normal' : 'whitespace-nowrap overflow-hidden text-ellipsis'} ${estNum(c.type) ? 'money' : ''} ${bordures ? 'border border-line-soft' : ''}`}
                  style={{
                    textAlign: alignement(c), ...styleFige(c, fond),
                    outline: focusIci ? '2px solid var(--brand-500)' : undefined, outlineOffset: -2,
                    background: modifiee || (nouvelle && modeEdition === 'lot') ? 'color-mix(in srgb, var(--success) 12%, var(--surface))' : styleFige(c, fond).background,
                  }}>
                {enEdition && editable ? (
                  <>
                    {editeur(c, ligneEditee!.valeurs[c.champ], (v) => setLigneEditee((le) => le && ({ ...le, valeurs: { ...le.valeurs, [c.champ]: v } })),
                      () => void enregistrerLigne(), () => setLigneEditee(null), ligne, ci === visibles.findIndex((x) => x.editable !== false && !x.valeur))}
                    {ligneEditee!.erreurs[c.champ] && <div className="text-[10.5px]" style={{ color: 'var(--danger)' }}>{ligneEditee!.erreurs[c.champ]}</div>}
                  </>
                ) : enCellule ? (
                  <>
                    {editeur(c, celluleEditee!.valeur, (v) => setCelluleEditee((ce) => ce && ({ ...ce, valeur: v, erreur: undefined })),
                      () => void validerCellule(), () => setCelluleEditee(null), ligne, true)}
                    {celluleEditee!.erreur && <div className="text-[10.5px]" style={{ color: 'var(--danger)' }}>{celluleEditee!.erreur}</div>}
                  </>
                ) : contenuCellule(c, ligne)}
              </td>
            );
          })}
          {aCommandes && (
            <td className="text-center whitespace-nowrap" style={{ width: L_COMMANDES, position: 'sticky', right: 0, zIndex: 2, background: fond }} onClick={(e) => e.stopPropagation()}>
              {enEdition ? (
                <>
                  <button onClick={() => void enregistrerLigne()} disabled={enCours} className="px-1.5 font-bold text-brand-700" title="Enregistrer">✓</button>
                  <button onClick={() => setLigneEditee(null)} className="px-1.5 text-ink-muted" title="Annuler">✕</button>
                </>
              ) : (
                <>
                  {edition?.modification !== false && modeEdition !== 'lot' && modeEdition !== 'cellule' && (
                    <button onClick={() => commencerModification(ligne)} className="px-1.5 text-ink-muted hover:text-brand-700" title="Modifier">✎</button>
                  )}
                  {edition?.suppression !== false && (
                    <button onClick={() => void supprimer(ligne)} className="px-1.5 hover:opacity-80" style={{ color: 'var(--danger)' }}
                            title={supprimee ? 'Rétablir' : 'Supprimer'}>{supprimee ? '↺' : '🗑'}</button>
                  )}
                </>
              )}
            </td>
          )}
        </tr>
        {aDetail && details.has(k) && (
          <tr>
            <td colSpan={visibles.length + etat.groupes.length + (aSelection ? 1 : 0) + 1 + (aCommandes ? 1 : 0)}
                className="px-4 py-3 border-b border-line-soft" style={{ background: 'color-mix(in srgb, var(--line-soft) 60%, var(--surface))' }}>
              {detail!(ligne)}
            </td>
          </tr>
        )}
      </Fragment>
    );
  }

  function valeurResume(r: Resume<T>, lignes: T[]): ReactNode {
    const v = calculerResume(r, lignes, colonnes);
    if (v === null) return null;
    const col = colonnes.find((c) => c.champ === r.colonne);
    const texte = r.format ? r.format(v) : typeof v === 'number' && col && r.type !== 'count' ? texteDe(col, v) : String(v);
    return <span><span className="text-ink-muted font-normal">{r.libelle ?? LIBELLES_RESUME[r.type]} : </span>{texte}</span>;
  }

  function rendreGroupe(n: NoeudGroupe<T>, replie: boolean, indexPage: number) {
    const col = colonnes.find((c) => c.champ === n.champ);
    const resumesTexte = (resumesGroupe ?? []).map((r, i) => <span key={i} className="ml-3">{valeurResume(r, n.lignes)}</span>);
    return (
      <tr key={n.cle} data-index={indexPage} className="border-b border-line-soft cursor-pointer select-none"
          onClick={() => { actions.basculerGroupe(n.cle); setFocus({ index: indexPage, col: focus.col }); }}
          style={{ background: 'color-mix(in srgb, var(--brand-100) 45%, var(--surface))', height: defilementVirtuel ? hauteurLigne : undefined,
                   outline: focus.index === indexPage ? '2px solid var(--brand-500)' : undefined, outlineOffset: -2 }}>
        <td colSpan={visibles.length + etat.groupes.length + (aSelection ? 1 : 0) + (aDetail ? 1 : 0) + (aCommandes ? 1 : 0)}
            className="px-2.5 py-1.5 font-bold text-[12px] text-ink" style={{ paddingInlineStart: 10 + n.niveau * 18 }}>
          <span className="inline-block w-4 text-brand-700">{replie ? '▸' : '▾'}</span>
          {col?.titre ?? n.champ} : {n.texte}
          <span className="text-ink-muted font-normal"> ({n.lignes.length})</span>
          {resumesTexte}
        </td>
      </tr>
    );
  }

  // ─── Export ───────────────────────────────────────────────────────────────
  const opts = props.export;
  // Colonnes sans titre (boutons d'action) exclues de l'export
  const colonnesExport = opts?.colonnes ?? visibles.filter((c) => c.titre !== '');
  const lignesExport = () => (opts?.selectionSeule && selectionnees.size ? triees.filter((l) => selectionnees.has(cleDe(l))) : triees);
  function menuExport(e: ME) {
    const nom = opts?.nom ?? 'export';
    const entrees: EntreeMenu[] = [
      ...(opts?.excel !== false ? [{ libelle: 'Excel (.xlsx)', action: () => void exporterGrilleExcel(nom, colonnesExport, lignesExport(), { groupes: opts?.colonnes ? undefined : arbre ?? undefined, resumes }) }] : []),
      ...(opts?.csv !== false ? [{ libelle: 'CSV (Excel FR)', action: () => exporterGrilleCsv(nom, colonnesExport, lignesExport()) }] : []),
      ...(opts?.pdf !== false ? [{ libelle: 'PDF / Imprimer', action: () => setPdf(documentPdfGrille(typeof titre === 'string' ? titre : nom, colonnesExport, lignesExport(), resumes)) }] : []),
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

  const thBase = 'px-2.5 py-2 text-[10.5px] font-bold uppercase tracking-wide text-ink-muted bg-surface border-b border-line-soft select-none';

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} className="bg-surface border border-line-soft rounded-md shadow-soft flex flex-col min-w-0"
         style={{ height: hauteur }}>
      {/* Barre d'outils */}
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-line-soft">
        {titre && <div className="font-bold text-[13px] text-ink mr-2">{titre}</div>}
        {barreOutils}
        <div className="ms-auto flex items-center gap-1.5 flex-wrap">
          {lotModifie && (
            <>
              <span className="text-[11px] text-ink-muted">Modifications en attente</span>
              <button onClick={() => void enregistrerLot()} disabled={enCours} className="rounded-sm px-2.5 py-1 font-bold text-[11.5px] text-white bg-brand-700 disabled:opacity-50">Enregistrer</button>
              <button onClick={() => setLot({ modifiees: {}, ajoutees: [], supprimees: [] })} className="rounded-sm px-2.5 py-1 font-bold text-[11.5px] border border-line text-ink-label">Annuler</button>
            </>
          )}
          {edition?.ajout !== false && edition && (
            <button onClick={commencerAjout} className="rounded-sm px-2.5 py-1 font-bold text-[11.5px] text-white bg-brand-700" title="Ajouter une ligne">＋ Ajouter</button>
          )}
          {etat.groupes.length > 0 && (
            <>
              <button onClick={actions.toutDeplier} className="rounded-sm px-2 py-1 text-[11.5px] border border-line text-ink-label" title="Tout déplier">⊞</button>
              <button onClick={actions.toutReplier} className="rounded-sm px-2 py-1 text-[11.5px] border border-line text-ink-label" title="Tout replier">⊟</button>
            </>
          )}
          {rechercheGlobale && (
            <input value={etat.recherche} onChange={(e) => actions.rechercher(e.target.value)} placeholder="Rechercher…"
                   className="border border-line rounded-sm px-2.5 py-1 bg-surface text-ink text-[12px] w-48" />
          )}
          {ligneFiltre === 'bascule' && (
            <button onClick={() => setFiltresOuverts((o) => !o)} title="Afficher la ligne de filtre"
                    className={`rounded-sm px-2 py-1 text-[11.5px] border ${filtresOuverts ? 'border-brand-500 text-brand-700' : 'border-line text-ink-label'}`}>
              ⏷ Filtres{Object.keys(etat.filtres).length ? ` (${Object.keys(etat.filtres).length})` : ''}
            </button>
          )}
          {selecteurColonnes && (
            <button onClick={(e) => setFlottant(
              <SelecteurColonnes ancre={e.currentTarget.getBoundingClientRect()}
                                 colonnes={colonnes.map((c) => ({ champ: c.champ, titre: c.titre ?? c.champ, masquable: c.masquable !== false }))}
                                 masquees={etat.masquees} onBasculer={actions.basculerVisibilite} onReinitialiser={actions.reinitialiser}
                                 onFermer={() => setFlottant(null)} />,
            )} className="rounded-sm px-2 py-1 text-[11.5px] border border-line text-ink-label" title="Colonnes">☰ Colonnes</button>
          )}
          {opts && <button onClick={menuExport} className="rounded-sm px-2 py-1 text-[11.5px] border border-line text-ink-label" title="Exporter">⬇ Exporter</button>}
        </div>
      </div>

      {/* Zone de regroupement (glisser un en-tête ici) */}
      {(panneauGroupes === true || (panneauGroupes === 'auto' && (glisseEnTete || etat.groupes.length > 0))) && (
        <div onDragOver={(e) => { if (e.dataTransfer.types.includes(TYPE_DND)) { e.preventDefault(); setSurvolGroupes(true); } }}
             onDragLeave={() => setSurvolGroupes(false)}
             onDrop={(e) => { const champ = e.dataTransfer.getData(TYPE_DND); setSurvolGroupes(false); setGlisseEnTete(false); if (champ && colonnes.find((c) => c.champ === champ)?.groupable !== false) actions.grouper(champ); }}
             className="flex items-center gap-1.5 flex-wrap px-3 py-1.5 border-b border-line-soft min-h-[34px] text-[11.5px]"
             style={{ background: survolGroupes ? 'var(--brand-50)' : 'color-mix(in srgb, var(--line-soft) 40%, var(--surface))' }}>
          {etat.groupes.length === 0 && <span className="text-ink-muted">Glissez un en-tête de colonne ici pour grouper par cette colonne</span>}
          {etat.groupes.map((g, i) => {
            const c = colonnes.find((x) => x.champ === g);
            const t = etat.tri.find((x) => x.champ === g);
            return (
              <Fragment key={g}>
                {i > 0 && <span className="text-ink-muted">›</span>}
                <span draggable onDragStart={(e) => e.dataTransfer.setData(TYPE_DND, g)}
                      className="inline-flex items-center gap-1 border border-line rounded-sm bg-surface px-2 py-0.5 font-semibold text-ink cursor-grab">
                  <button onClick={() => actions.trier(g, 'simple')} title="Trier les groupes">{c?.titre ?? g}{t ? (t.sens === 'asc' ? ' ▲' : ' ▼') : ''}</button>
                  <button onClick={() => actions.degrouper(g)} className="text-ink-muted hover:text-ink" title="Retirer">✕</button>
                </span>
              </Fragment>
            );
          })}
        </div>
      )}

      {erreurEdition && (
        <div className="px-3 py-1.5 text-[12px] flex items-center gap-2" style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>
          {erreurEdition}<button className="ms-auto" onClick={() => setErreurEdition(null)}>✕</button>
        </div>
      )}

      {/* Tableau */}
      <div ref={corpsRef} tabIndex={0} onKeyDown={clavier}
           onScroll={(e) => defilementVirtuel && setScroll({ haut: e.currentTarget.scrollTop, hauteur: e.currentTarget.clientHeight })}
           className="flex-1 overflow-auto outline-none relative min-h-[120px]">
        <table className="text-[12px] text-ink" style={{ tableLayout: 'fixed', width: Math.max(largeurTotale, 0), minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
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
                  <input type="checkbox" checked={toutCoche} ref={(el) => { if (el) el.indeterminate = partielCoche; }}
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
                  <th key={c.champ} draggable={reorganisationColonnes || !!panneauGroupes}
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
                      style={{ textAlign: alignement(c), ...styleFige(c, 'var(--surface)'), zIndex: positions[c.champ] ? 4 : undefined }}
                      title="Clic : trier · Maj+clic : tri multiple · Ctrl+clic : retirer · Clic droit : menu">
                    <span className="inline-flex items-center gap-1 max-w-full">
                      <span className="truncate">{c.titre ?? c.champ}</span>
                      {tri && <span className="text-brand-700">{tri.sens === 'asc' ? '▲' : '▼'}{etat.tri.length > 1 ? <sub>{t + 1}</sub> : null}</span>}
                      {c.filtreEntete !== false && (
                        <button onClick={(e) => ouvrirFiltreEntete(e, c)} title="Filtrer par valeurs"
                                className={`px-0.5 ${filtreEnt ? 'text-brand-700' : 'text-ink-muted opacity-0 group-hover:opacity-100'}`}>⏷</button>
                      )}
                    </span>
                    {redimensionnementColonnes && c.redimensionnable !== false && (
                      <span onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); redim.current = { champ: c.champ, x: e.clientX, l: largeurEff(c) }; document.body.style.cursor = 'col-resize'; }}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-0 h-full w-1.5 cursor-col-resize hover:bg-brand-300" style={{ [rtl ? 'left' : 'right']: 0 }} />
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
                  const cls = 'min-w-0 w-full border border-line rounded-sm px-1.5 py-0.5 bg-surface text-ink font-normal text-[11.5px]';
                  const type = c.type === 'date' ? 'date' : estNum(c.type) ? 'number' : 'text';
                  return (
                    <th key={c.champ} className="px-1.5 py-1 bg-surface border-b border-line-soft font-normal" style={styleFige(c, 'var(--surface)')}>
                      {c.filtrable === false ? null : (
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => ouvrirOperateur(e, c)} title={LIBELLES_OPERATEURS[op]}
                                  className={`w-6 flex-none text-center money text-[11px] rounded-sm ${f ? 'text-brand-700 font-bold' : 'text-ink-muted'}`}>
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
            {defilementVirtuel && debutVirtuel > 0 && <tr style={{ height: debutVirtuel * hauteurLigne }} />}
            {elementsRendus.map((el, i) => (el.type === 'groupe'
              ? rendreGroupe(el.noeud, el.replie, debutVirtuel + i)
              : rendreLigne(el.ligne, debutVirtuel + i)))}
            {defilementVirtuel && finVirtuel < elementsPage.length && <tr style={{ height: (elementsPage.length - finVirtuel) * hauteurLigne }} />}
            {ligneEditee?.nouvelle && edition?.positionNouvelle === 'fin' && rendreNouvelle()}
          </tbody>
          {resumes?.length ? (
            <tfoot className="sticky bottom-0 z-[3]">
              <tr className="font-bold">
                {debutColonnesSysteme > 0 && <td colSpan={debutColonnesSysteme} className="bg-surface border-t border-line" />}
                {visibles.map((c) => {
                  const rs = resumes.filter((r) => (r.afficherDans ?? r.colonne) === c.champ);
                  return (
                    <td key={c.champ} className="px-2.5 py-2 bg-surface border-t border-line whitespace-nowrap money text-[11.5px]"
                        style={{ textAlign: alignement(c), ...styleFige(c, 'var(--surface)') }}>
                      {rs.map((r, i) => <div key={i}>{valeurResume(r, triees)}</div>)}
                    </td>
                  );
                })}
                {aCommandes && <td className="bg-surface border-t border-line" style={{ position: 'sticky', right: 0 }} />}
              </tr>
            </tfoot>
          ) : props.pied && triees.length > 0 ? (
            <tfoot className="sticky bottom-0 z-[3]">
              <tr className="font-bold">
                {debutColonnesSysteme > 0 && <td colSpan={debutColonnesSysteme} className="bg-surface border-t border-line" />}
                {visibles.map((c, i) => (
                  <td key={c.champ} className="px-2.5 py-2 bg-surface border-t border-line whitespace-nowrap text-[11.5px]"
                      style={{ textAlign: alignement(c), ...styleFige(c, 'var(--surface)') }}>
                    {i === 0 && props.pied!._label !== undefined ? props.pied!._label : props.pied![c.champ]}
                  </td>
                ))}
                {aCommandes && <td className="bg-surface border-t border-line" style={{ position: 'sticky', right: 0 }} />}
              </tr>
            </tfoot>
          ) : null}
        </table>
        {!chargement && elementsPage.length === 0 && !ligneEditee?.nouvelle && (
          <div className="py-10 text-center text-[12px] text-ink-muted">{erreur ?? messageVide}</div>
        )}
        {chargement && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--surface) 60%, transparent)' }}>
            <span className="text-[12px] font-bold text-ink-label bg-surface border border-line-soft rounded-md px-3 py-2 shadow-soft">Chargement…</span>
          </div>
        )}
      </div>

      {/* Panneau des filtres actifs */}
      {panneauFiltre && filtresActifs.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-line-soft text-[11.5px]">
          <span className="text-brand-700">⏷</span>
          <span className="flex-1 truncate text-ink-label" title={filtresActifs.join(' et ')}>{filtresActifs.join(' et ')}</span>
          <button onClick={actions.effacerFiltres} className="font-bold text-brand-700">Effacer les filtres</button>
        </div>
      )}

      {/* Pagination */}
      {pagine && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-line-soft text-[11.5px] text-ink-label flex-wrap">
          <span>Lignes par page</span>
          <select value={etat.taillePage} onChange={(e) => actions.taillePage(Number(e.target.value))}
                  className="border border-line rounded-sm px-1.5 py-0.5 bg-surface text-ink">
            {taillesPage.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="ms-auto">
            Page {page + 1} sur {pages} ({triees.length} ligne{triees.length > 1 ? 's' : ''}{triees.length !== donneesAffichees.length ? ` sur ${donneesAffichees.length}` : ''})
          </span>
          <div className="flex gap-0.5">
            {[['«', 0], ['‹', page - 1]].map(([s, p]) => (
              <button key={String(s)} disabled={page === 0} onClick={() => actions.page(Number(p))} className="px-2 py-0.5 rounded-sm border border-line disabled:opacity-40">{s}</button>
            ))}
            {pagesVisibles(page, pages).map((p, i) => (p < 0 ? <span key={`e${i}`} className="px-1">…</span> : (
              <button key={p} onClick={() => actions.page(p)}
                      className={`px-2 py-0.5 rounded-sm border ${p === page ? 'bg-brand-700 text-white border-brand-700' : 'border-line'}`}>{p + 1}</button>
            )))}
            {[['›', page + 1], ['»', pages - 1]].map(([s, p]) => (
              <button key={String(s)} disabled={page >= pages - 1} onClick={() => actions.page(Number(p))} className="px-2 py-0.5 rounded-sm border border-line disabled:opacity-40">{s}</button>
            ))}
          </div>
        </div>
      )}
      {!pagine && (
        <div className="px-3 py-1.5 border-t border-line-soft text-[11.5px] text-ink-muted">
          {triees.length} ligne{triees.length > 1 ? 's' : ''}{triees.length !== donneesAffichees.length ? ` sur ${donneesAffichees.length}` : ''}{selectionnees.size ? ` · ${selectionnees.size} sélectionnée(s)` : ''}
        </div>
      )}

      {flottant}
      {pdf && <PrintPreview doc={pdf} onClose={() => setPdf(null)} />}
      {aSupprimer && (
        <ConfirmDialog title="Supprimer cette ligne ?" message="Cette action est définitive." confirmLabel="Supprimer" danger loading={enCours}
                       onConfirm={() => void supprimer(aSupprimer)} onCancel={() => setASupprimer(null)} />
      )}
      {formulaire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgb(15 26 46 / .45)' }}>
          <div className="w-[560px] max-h-[90vh] flex flex-col bg-surface border border-line-soft rounded-lg shadow-lifted">
            <div className="px-5 py-3.5 border-b border-line-soft font-extrabold text-[15px]">{formulaire.ligne ? 'Modifier la ligne' : 'Nouvelle ligne'}</div>
            <div className="p-5 grid grid-cols-2 gap-3 overflow-auto">
              {colonnes.filter((c) => c.editable !== false && !c.valeur).map((c, i) => (
                <label key={c.champ} className="text-[11px] font-bold text-ink-label">
                  {c.titre ?? c.champ}{c.validation?.some((r) => r.type === 'requis') ? ' *' : ''}
                  <div className="mt-1 font-normal">
                    {editeur(c, formulaire.valeurs[c.champ], (v) => setFormulaire((f) => f && ({ ...f, valeurs: { ...f.valeurs, [c.champ]: v }, erreurs: { ...f.erreurs, [c.champ]: '' } })),
                      () => void enregistrerFormulaire(), () => setFormulaire(null), (formulaire.ligne ?? {}) as T, i === 0)}
                  </div>
                  {formulaire.erreurs[c.champ] && <div className="text-[10.5px] font-normal" style={{ color: 'var(--danger)' }}>{formulaire.erreurs[c.champ]}</div>}
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end px-5 py-3 border-t border-line-soft">
              <button onClick={() => setFormulaire(null)} className="px-4 py-2 rounded-md border border-line text-ink-label font-bold text-[12px]">Annuler</button>
              <button onClick={() => void enregistrerFormulaire()} disabled={enCours} className="px-4 py-2 rounded-md font-bold text-[12px] text-white bg-brand-700 disabled:opacity-50">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function rendreNouvelle() {
    const vide = {} as T;
    return (
      <tr key={CLE_NOUVELLE} style={{ background: 'color-mix(in srgb, var(--success) 8%, var(--surface))' }} className="border-b border-line-soft">
        {Array.from({ length: debutColonnesSysteme }).map((_, i) => <td key={i} />)}
        {visibles.map((c) => (
          <td key={c.champ} className="px-2.5 py-1.5" style={styleFige(c, 'var(--surface)')}>
            {c.editable !== false && !c.valeur ? (
              <>
                {editeur(c, ligneEditee!.valeurs[c.champ], (v) => setLigneEditee((le) => le && ({ ...le, valeurs: { ...le.valeurs, [c.champ]: v } })),
                  () => void enregistrerLigne(), () => setLigneEditee(null), vide, c === editables[0])}
                {ligneEditee!.erreurs[c.champ] && <div className="text-[10.5px]" style={{ color: 'var(--danger)' }}>{ligneEditee!.erreurs[c.champ]}</div>}
              </>
            ) : null}
          </td>
        ))}
        {aCommandes && (
          <td className="text-center whitespace-nowrap" style={{ position: 'sticky', right: 0, background: 'var(--surface)' }}>
            <button onClick={() => void enregistrerLigne()} disabled={enCours} className="px-1.5 font-bold text-brand-700" title="Enregistrer">✓</button>
            <button onClick={() => setLigneEditee(null)} className="px-1.5 text-ink-muted" title="Annuler">✕</button>
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
