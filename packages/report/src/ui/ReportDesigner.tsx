import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BAND_LABELS, BandType, ObjDef, ObjType, ReportData, ReportDef, cloner, creerBande, creerEtat, creerObjet, nouvelId,
} from '../model';
import { kindDe, listerModelesIntegres, listerTypes, typeDe } from '../registre';
import {
  ModeleInfo, chargerModele, enregistrerModele, exporterModele, importerModeles, listerModeles, cheminDossierModeles,
  ouvrirDossierModeles, peutOuvrirDossier,
} from '../store';
import { verifierModele } from '../validate';
import { PX_PAR_MM } from '../engine/measure';
import { porteeApercu } from '../engine/render';
import { useToast } from './toast';
import { ConfirmDialog } from './dialogs';
import { Ic, NomIc } from './icons';
import ReportPreview from './ReportPreview';
import Canvas, { ChampDepose, Grille } from './designer/Canvas';
import Inspector, { OuvrirExpression } from './designer/Inspector';
import DataPanel from './designer/DataPanel';
import ExprEditor from './designer/ExprEditor';
import { BoutonIcone } from './designer/fields';
import { useDesigner } from './designer/useDesigner';
import {
  Alignement, aligner, ajouterObjet, coller, copier, deplacerObjets, distribuer, dupliquer, largeurBande, memeTaille, objetsSelectionnes,
  ordreZ, supprimerObjets, trouverObjet,
} from './designer/ops';
import { Racine } from './Racine';

const ZOOMS = [0.4, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const OUTILS: { type: ObjType; icone: NomIc; titre: string; touche: string }[] = [
  { type: 'text', icone: 'text', titre: 'Texte', touche: 'T' },
  { type: 'image', icone: 'image', titre: 'Image', touche: 'I' },
  { type: 'line', icone: 'line', titre: 'Ligne', touche: 'L' },
  { type: 'shape', icone: 'rect', titre: 'Forme', touche: 'R' },
  { type: 'barcode', icone: 'barcode', titre: 'Code-barres', touche: 'B' },
  { type: 'checkbox', icone: 'checkbox', titre: 'Case à cocher', touche: 'C' },
];
const CLE_GRILLE = 'gc.designer.grille';

function lireGrille(): Grille {
  try { return { afficher: true, pas: 1, magnetisme: true, ...(JSON.parse(localStorage.getItem(CLE_GRILLE) || '{}') as Partial<Grille>) }; } catch { return { afficher: true, pas: 1, magnetisme: true }; }
}

/** Ordre d'affichage canonique des bandes. */
const RANG: Record<BandType, number> = { pageHeader: 0, reportTitle: 1, dataHeader: 2, groupHeader: 3, data: 4, groupFooter: 5, dataFooter: 6, reportSummary: 8, pageFooter: 9, overlay: 10 };

/**
 * Designer d'états (équivalent du designer FastReport) : bandes, objets positionnés au millimètre,
 * champs glissés depuis l'arbre de données, éditeur d'expressions, aperçu immédiat, modèles enregistrés en .gcr.
 */
function ReportDesignerInterne({ initial, fichier: fichierInitial, donneesApercu, onClose, onSaved }: {
  initial: ReportDef;
  /** Nom du fichier .gcr si le modèle en provient (sinon : modèle intégré ou nouveau). */
  fichier?: string;
  /** Données réelles pour l'aperçu (sinon : jeu d'exemple du type de document). */
  donneesApercu?: ReportData;
  onClose: () => void;
  onSaved?: (fichier: string) => void;
}) {
  const toast = useToast();
  const D = useDesigner(initial);
  const { def } = D;
  const [fichier, setFichier] = useState<string | undefined>(fichierInitial);
  const [zoom, setZoom] = useState(1.5);
  const [grille, setGrille] = useState<Grille>(lireGrille);
  const [apercu, setApercu] = useState(false);
  const [montrerValeurs, setMontrerValeurs] = useState(true);
  const [expression, setExpression] = useState<Parameters<OuvrirExpression>[0] | null>(null);
  const [dialogue, setDialogue] = useState<'nouveau' | 'ouvrir' | 'enregistrerSous' | 'quitter' | 'verification' | null>(null);
  const [curseur, setCurseur] = useState<{ x: number; y: number; bande: string } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const zone = useRef<HTMLDivElement>(null);

  const kind = kindDe(def.kind);
  const pxMm = PX_PAR_MM * zoom;
  const largeur = largeurBande(def);
  const problemes = useMemo(() => verifierModele(def), [def]);
  const scopeValeurs = useMemo(() => (montrerValeurs ? porteeApercu(def, donneesApercu ?? kind.sample) : null), [montrerValeurs, def, donneesApercu, kind.sample]);
  const erreurs = problemes.filter((p) => p.niveau === 'erreur').length;

  useEffect(() => { try { localStorage.setItem(CLE_GRILLE, JSON.stringify(grille)); } catch { /* ignoré */ } }, [grille]);
  useEffect(() => {
    const avant = document.title;
    document.title = `${def.name}${D.dirty ? ' •' : ''} — Designer`;
    return () => { document.title = avant; };
  }, [def.name, D.dirty]);

  // Quitter la fenêtre avec des modifications non enregistrées
  useEffect(() => {
    const avant = (e: BeforeUnloadEvent) => { if (D.dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', avant);
    return () => window.removeEventListener('beforeunload', avant);
  }, [D.dirty]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const bandeCourante = useCallback((): string | undefined => {
    if (D.sel.length) return trouverObjet(def, D.sel[0])?.bande.id;
    return D.bandeSel ?? def.bands.find((b) => b.type === 'data')?.id ?? def.bands[0]?.id;
  }, [D.sel, D.bandeSel, def]);

  const enregistrer = useCallback(async (sous?: string) => {
    try {
      const modele = sous ? { ...cloner(def), id: nouvelId('r'), name: sous } : def;
      const cible = sous ? undefined : fichier;
      const f = await enregistrerModele(modele, cible);
      if (sous) D.charger({ ...modele, modified: new Date().toISOString() });
      setFichier(f);
      D.marquerEnregistre();
      onSaved?.(f);
      toast.success(`Modèle enregistré : ${f}`);
    } catch (e) { toast.error(`Enregistrement impossible : ${(e as Error).message}`); }
  }, [def, fichier, D, onSaved, toast]);

  const ajouterBandeType = useCallback((type: BandType) => {
    const b = creerBande(type);
    if (type === 'data' || type === 'dataHeader' || type === 'dataFooter') {
      const liste = kind.datasets.find((d) => d.mode === 'list');
      const voisine = def.bands.find((x) => x.id === bandeCourante() && x.dataSource);
      b.dataSource = voisine?.dataSource ?? liste?.name;
    }
    if (type === 'groupHeader') { b.dataSource = def.bands.find((x) => x.type === 'data')?.dataSource ?? kind.datasets.find((d) => d.mode === 'list')?.name; }
    // insertion en respectant l'ordre canonique ; les bandes de flux se placent après la bande courante
    const bands = [...def.bands];
    let i = bands.length;
    const courante = bands.findIndex((x) => x.id === bandeCourante());
    if (RANG[type] >= 2 && RANG[type] <= 6 && courante >= 0 && RANG[bands[courante].type] >= 2 && RANG[bands[courante].type] <= 6) i = courante + 1;
    else { i = bands.findIndex((x) => RANG[x.type] > RANG[type]); if (i < 0) i = bands.length; }
    bands.splice(i, 0, b);
    D.set({ ...def, bands });
    D.selectBande(b.id);
  }, [def, kind, D, bandeCourante]);

  const insererChamp = useCallback((c: ChampDepose, bandeId?: string, x = 2, y = 0.5) => {
    const id = bandeId ?? bandeCourante();
    const bande = def.bands.find((b) => b.id === id);
    if (!bande) { toast.info('Ajoutez d’abord une bande (menu « Bandes »).'); return; }
    const numerique = c.type === 'number';
    const nom = c.nom;
    let o: ObjDef;
    if (c.type === 'image') o = creerObjet('image', x, y, { w: 26, h: Math.min(20, Math.max(8, bande.height - y)), expr: c.texte.replace(/^\[|\]$/g, ''), name: nom });
    else o = creerObjet('text', x, y, {
      w: numerique ? 28 : 55, h: Math.min(5.5, Math.max(3.5, bande.height - y)), text: c.texte, name: nom,
      align: numerique ? 'right' : 'left', ...(numerique ? { format: { kind: 'number', pattern: '#,##0.00' } } : {}),
    });
    o.x = Math.min(Math.max(0, x), Math.max(0, largeur - o.w));
    D.set(ajouterObjet(def, bande.id, o), [o.id]);
  }, [bandeCourante, def, largeur, D, toast]);

  const supprimer = useCallback(() => { if (D.sel.length) D.set(supprimerObjets(def, D.sel), []); }, [D, def]);
  const copierSel = useCallback(() => { const p = copier(def, D.sel); if (p) D.setPresse(p); }, [def, D]);
  const collerSel = useCallback(() => {
    if (!D.presse) return;
    const r = coller(def, D.presse, bandeCourante() ?? D.presse.bandeId);
    D.set(r.def, r.ids);
  }, [D, def, bandeCourante]);
  const dupliquerSel = useCallback(() => { if (D.sel.length) { const r = dupliquer(def, D.sel); D.set(r.def, r.ids); } }, [D, def]);
  const couper = useCallback(() => { copierSel(); supprimer(); }, [copierSel, supprimer]);

  const ouvrirExpression: OuvrirExpression = useCallback((o) => setExpression(o), []);

  const fermer = useCallback(() => { if (D.dirty) setDialogue('quitter'); else onClose(); }, [D.dirty, onClose]);

  // ── Raccourcis clavier ────────────────────────────────────────────────────
  useEffect(() => {
    function touche(e: KeyboardEvent) {
      if (apercu || expression || dialogue) return;
      const cible = e.target as HTMLElement | null;
      const saisie = !!cible && (/^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName) || cible.isContentEditable);
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (ctrl && k === 's') { e.preventDefault(); void (e.shiftKey ? setDialogue('enregistrerSous') : enregistrer()); return; }
      if (saisie) return;
      if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); D.undo(); }
      else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); D.redo(); }
      else if (ctrl && k === 'c') { e.preventDefault(); copierSel(); }
      else if (ctrl && k === 'x') { e.preventDefault(); couper(); }
      else if (ctrl && k === 'v') { e.preventDefault(); collerSel(); }
      else if (ctrl && k === 'd') { e.preventDefault(); dupliquerSel(); }
      else if (ctrl && k === 'a') {
        e.preventDefault();
        const b = def.bands.find((x) => x.id === bandeCourante());
        if (b) D.select(b.objects.map((o) => o.id));
      }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); supprimer(); }
      else if (e.key === 'Escape') { if (D.outil) D.setOutil(null); else if (D.sel.length) D.select([]); else if (D.bandeSel) D.selectBande(null); }
      else if (e.key === 'F5') { e.preventDefault(); setApercu(true); }
      else if (e.key.startsWith('Arrow') && D.sel.length) {
        e.preventDefault();
        const pas = e.shiftKey ? 5 : e.altKey ? 0.1 : grille.magnetisme ? Math.max(grille.pas, 0.5) : 0.5;
        const dx = e.key === 'ArrowLeft' ? -pas : e.key === 'ArrowRight' ? pas : 0, dy = e.key === 'ArrowUp' ? -pas : e.key === 'ArrowDown' ? pas : 0;
        D.set(deplacerObjets(def, D.sel, dx, dy, largeur, 0));
      }
      else if (!ctrl && !e.altKey) {
        const outil = OUTILS.find((o) => o.touche.toLowerCase() === k);
        if (outil) D.setOutil(D.outil === outil.type ? null : outil.type);
      }
    }
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [apercu, expression, dialogue, D, def, grille, largeur, enregistrer, copierSel, couper, collerSel, dupliquerSel, supprimer, bandeCourante]);

  // Zoom Ctrl + molette
  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const roue = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => Math.min(4, Math.max(0.4, Math.round((z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)) * 100) / 100)));
    };
    el.addEventListener('wheel', roue, { passive: false });
    return () => el.removeEventListener('wheel', roue);
  }, []);

  const ajuster = useCallback(() => {
    const el = zone.current;
    if (!el) return;
    const { w } = { w: def.page.orientation === 'landscape' ? def.page.height : def.page.width };
    setZoom(Math.min(4, Math.max(0.4, Math.round(((el.clientWidth - 48) / (w * PX_PAR_MM)) * 100) / 100)));
  }, [def.page]);

  // Ajuste le zoom à la largeur au premier affichage
  useEffect(() => { const t = requestAnimationFrame(ajuster); return () => cancelAnimationFrame(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selObjets = objetsSelectionnes(def, D.sel);
  const nbSel = selObjets.length;
  const zoomSuivant = (sens: 1 | -1) => setZoom((z) => (sens > 0 ? ZOOMS.find((v) => v > z + 0.01) : [...ZOOMS].reverse().find((v) => v < z - 0.01)) ?? z);

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: 'var(--gcr-bg, #F4F6FB)' }} role="application" aria-label="Designer d’états" onPointerDown={() => menu && setMenu(null)}>
      {/* Barre supérieure */}
      <header className="flex items-center gap-2 px-3 h-12 flex-none border-b border-line-soft bg-surface">
        <button onClick={fermer} className="h-8 px-2.5 rounded-md border border-line text-ink-label font-bold text-[12px] inline-flex items-center gap-1.5 hover:bg-[var(--gcr-surface-sunken)]" title="Fermer le designer">
          <Ic n="chevL" size={14} /> Retour
        </button>
        <div className="min-w-0">
          <div className="font-extrabold text-[13.5px] text-ink truncate max-w-[300px]">{def.name}{D.dirty && <span className="text-[var(--gcr-warning)]"> •</span>}</div>
          <div className="text-[10.5px] text-ink-muted truncate max-w-[300px]">{fichier ? fichier : 'Non enregistré'} · {kind.label}</div>
        </div>

        <div className="flex items-center gap-1 ml-2">
          <Menu id="fichier" ouvert={menu === 'fichier'} setOuvert={setMenu} libelle="Fichier" icone="file">
            <Item icone="file" libelle="Nouveau…" onClick={() => setDialogue('nouveau')} />
            <Item icone="open" libelle="Ouvrir…" onClick={() => setDialogue('ouvrir')} />
            <Sep />
            <Item icone="save" libelle="Enregistrer" raccourci="Ctrl+S" onClick={() => void enregistrer()} />
            <Item icone="save" libelle="Enregistrer sous…" raccourci="Ctrl+Maj+S" onClick={() => setDialogue('enregistrerSous')} />
            <Sep />
            <Item icone="upload" libelle="Importer des modèles (.gcr)…" onClick={async () => {
              const r = await importerModeles();
              if (r.importes.length) toast.success(`${r.importes.length} modèle(s) importé(s).`);
              r.erreurs.forEach((m) => toast.error(m));
            }} />
            <Item icone="download" libelle="Exporter ce modèle (.gcr)…" onClick={() => void exporterModele(def)} />
            {peutOuvrirDossier() && <Item icone="folder" libelle="Ouvrir le dossier des modèles" onClick={() => void ouvrirDossierModeles()} />}
          </Menu>
          <Menu id="bandes" ouvert={menu === 'bandes'} setOuvert={setMenu} libelle="Bandes" icone="bands">
            {(Object.keys(BAND_LABELS) as BandType[]).map((t) => <Item key={t} libelle={`Ajouter : ${BAND_LABELS[t]}`} onClick={() => ajouterBandeType(t)} />)}
          </Menu>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setDialogue('verification')} title="Vérifier le modèle"
                  className="h-8 px-2.5 rounded-md border border-line text-[12px] font-bold inline-flex items-center gap-1.5 hover:bg-[var(--gcr-surface-sunken)]"
                  style={{ color: erreurs ? 'var(--gcr-danger)' : problemes.length ? 'var(--gcr-warning)' : 'var(--gcr-success)' }}>
            <Ic n={erreurs || problemes.length ? 'warning' : 'check'} size={14} />
            {erreurs ? `${erreurs} erreur${erreurs > 1 ? 's' : ''}` : problemes.length ? `${problemes.length} avertissement${problemes.length > 1 ? 's' : ''}` : 'Valide'}
          </button>
          <button onClick={() => void enregistrer()} disabled={!D.dirty && !!fichier}
                  className="h-8 px-3 rounded-md border border-line text-ink-label font-bold text-[12px] inline-flex items-center gap-1.5 hover:bg-[var(--gcr-surface-sunken)] disabled:opacity-50"><Ic n="save" size={14} /> Enregistrer</button>
          <button onClick={() => setApercu(true)} className="h-8 px-3.5 rounded-md text-white font-bold text-[12px] inline-flex items-center gap-1.5" style={{ background: 'var(--gcr-brand-700)' }} title="Aperçu (F5)">
            <Ic n="eye" size={14} /> Aperçu
          </button>
        </div>
      </header>

      {/* Barre d'outils */}
      <div className="flex items-center gap-1 px-3 h-10 flex-none border-b border-line-soft bg-surface overflow-x-auto" role="toolbar" aria-label="Outils">
        <BoutonIcone icone="undo" titre="Annuler (Ctrl+Z)" onClick={D.undo} disabled={!D.canUndo} />
        <BoutonIcone icone="redo" titre="Rétablir (Ctrl+Y)" onClick={D.redo} disabled={!D.canRedo} />
        <Barre />
        <BoutonIcone icone="copy" titre="Copier (Ctrl+C)" onClick={copierSel} disabled={!nbSel} />
        <BoutonIcone icone="paste" titre="Coller (Ctrl+V)" onClick={collerSel} disabled={!D.presse} />
        <BoutonIcone icone="front" titre="Dupliquer (Ctrl+D)" onClick={dupliquerSel} disabled={!nbSel} />
        <BoutonIcone icone="trash" titre="Supprimer (Suppr)" onClick={supprimer} disabled={!nbSel} />
        <Barre />
        <BoutonIcone icone="alignLeft" titre="Aligner à gauche" onClick={() => D.set(aligner(def, D.sel, 'left'))} disabled={nbSel < 2} />
        <BoutonIcone icone="alignCenter" titre="Centrer horizontalement" onClick={() => D.set(aligner(def, D.sel, 'centerH'))} disabled={nbSel < 2} />
        <BoutonIcone icone="alignRight" titre="Aligner à droite" onClick={() => D.set(aligner(def, D.sel, 'right'))} disabled={nbSel < 2} />
        <BoutonIcone icone="alignTop" titre="Aligner en haut" onClick={() => D.set(aligner(def, D.sel, 'top'))} disabled={nbSel < 2} />
        <BoutonIcone icone="alignMiddle" titre="Centrer verticalement" onClick={() => D.set(aligner(def, D.sel, 'middle' as Alignement))} disabled={nbSel < 2} />
        <BoutonIcone icone="alignBottom" titre="Aligner en bas" onClick={() => D.set(aligner(def, D.sel, 'bottom'))} disabled={nbSel < 2} />
        <BoutonIcone icone="distH" titre="Répartir horizontalement" onClick={() => D.set(distribuer(def, D.sel, 'h'))} disabled={nbSel < 3} />
        <BoutonIcone icone="distV" titre="Répartir verticalement" onClick={() => D.set(distribuer(def, D.sel, 'v'))} disabled={nbSel < 3} />
        <BoutonIcone icone="sameW" titre="Même largeur que le premier" onClick={() => D.set(memeTaille(def, D.sel, 'w'))} disabled={nbSel < 2} />
        <BoutonIcone icone="sameH" titre="Même hauteur que le premier" onClick={() => D.set(memeTaille(def, D.sel, 'h'))} disabled={nbSel < 2} />
        <Barre />
        <BoutonIcone icone="front" titre="Premier plan" onClick={() => D.set(ordreZ(def, D.sel, 'front'))} disabled={!nbSel} />
        <BoutonIcone icone="back" titre="Arrière-plan" onClick={() => D.set(ordreZ(def, D.sel, 'back'))} disabled={!nbSel} />
        <BoutonIcone icone="chevU" titre="Avancer d’un plan" onClick={() => D.set(ordreZ(def, D.sel, 'forward'))} disabled={!nbSel} />
        <BoutonIcone icone="chevD" titre="Reculer d’un plan" onClick={() => D.set(ordreZ(def, D.sel, 'backward'))} disabled={!nbSel} />
        <Barre />
        <BoutonIcone icone="eye" titre={montrerValeurs ? 'Afficher les expressions' : 'Afficher les valeurs d’exemple'} actif={montrerValeurs} onClick={() => setMontrerValeurs((v) => !v)} />
        <BoutonIcone icone="grid" titre="Afficher la grille" actif={grille.afficher} onClick={() => setGrille((g) => ({ ...g, afficher: !g.afficher }))} />
        <BoutonIcone icone="select" titre="Magnétisme (grille et objets)" actif={grille.magnetisme} onClick={() => setGrille((g) => ({ ...g, magnetisme: !g.magnetisme }))} />
        <select aria-label="Pas de la grille" value={grille.pas} onChange={(e) => setGrille((g) => ({ ...g, pas: Number(e.target.value) }))}
                className="h-7 rounded border border-line bg-surface text-[11.5px] px-1.5 text-ink-label">
          {[0.5, 1, 2, 5, 10].map((p) => <option key={p} value={p}>{p} mm</option>)}
        </select>
        <Barre />
        <BoutonIcone icone="zoomOut" titre="Réduire" onClick={() => zoomSuivant(-1)} />
        <span className="w-12 text-center text-[11.5px] font-bold text-ink-label money">{Math.round(zoom * 100)} %</span>
        <BoutonIcone icone="zoomIn" titre="Agrandir" onClick={() => zoomSuivant(1)} />
        <BoutonIcone icone="fitWidth" titre="Ajuster à la largeur" onClick={ajuster} />
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Palette + données */}
        <aside className="w-[252px] flex-none border-r border-line-soft bg-surface flex flex-col min-h-0" aria-label="Outils et données">
          <div className="p-2 border-b border-line-soft grid grid-cols-6 gap-1 flex-none" role="toolbar" aria-label="Objets à insérer">
            {OUTILS.map((o) => (
              <button key={o.type} type="button" title={`${o.titre} (${o.touche}) — puis tracez sur une bande`} aria-pressed={D.outil === o.type}
                      onClick={() => D.setOutil(D.outil === o.type ? null : o.type)}
                      className="h-9 rounded border inline-flex items-center justify-center transition-colors"
                      style={D.outil === o.type ? { background: 'var(--gcr-brand-700)', color: '#fff', borderColor: 'transparent' } : { borderColor: 'var(--gcr-line)', color: 'var(--gcr-text-label)' }}>
                <Ic n={o.icone} size={16} />
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0"><DataPanel def={def} onInserer={(c) => insererChamp(c)} /></div>
        </aside>

        {/* Plan de travail */}
        <main ref={zone} className="flex-1 overflow-auto relative" style={{ background: '#CDD5E3' }} aria-label="Plan de travail">
          <Regle def={def} pxMm={pxMm} />
          <div style={{ padding: '10px 24px 60px', width: 'max-content', minWidth: '100%', boxSizing: 'border-box' }}>
            <div style={{ margin: '0 auto', width: 'max-content' }}>
              <Canvas D={D} pxMm={pxMm} grille={grille} valeurs={scopeValeurs} onPointeur={setCurseur}
                      onDeposer={(bandeId, x, y, c) => insererChamp(c, bandeId, x, y)}
                      onEditionTexte={(id) => {
                        const r = trouverObjet(def, id);
                        if (!r) return;
                        const o = r.objet;
                        if (o.type === 'barcode') ouvrirExpression({ titre: 'Valeur du code-barres', valeur: o.value, multiple: true, surValider: (v) => D.set({ ...def, bands: def.bands.map((b) => ({ ...b, objects: b.objects.map((x) => (x.id === id ? ({ ...x, value: v } as ObjDef) : x)) })) }) });
                        else if (o.type === 'image') ouvrirExpression({ titre: 'Source de l’image', valeur: o.expr ?? '', surValider: (v) => D.set({ ...def, bands: def.bands.map((b) => ({ ...b, objects: b.objects.map((x) => (x.id === id ? ({ ...x, expr: v || undefined } as ObjDef) : x)) })) }) });
                        else if (o.type === 'checkbox') ouvrirExpression({ titre: 'Condition de la case', valeur: o.checked, surValider: (v) => D.set({ ...def, bands: def.bands.map((b) => ({ ...b, objects: b.objects.map((x) => (x.id === id ? ({ ...x, checked: v } as ObjDef) : x)) })) }) });
                      }} />
            </div>
          </div>
        </main>

        <Inspector D={D} ouvrirExpression={ouvrirExpression} />
      </div>

      {/* Barre d'état */}
      <footer className="flex items-center gap-4 px-3 h-6 flex-none text-[11px] border-t border-line-soft bg-surface text-ink-muted">
        <span>{curseur ? `X ${curseur.x.toFixed(1)} mm · Y ${curseur.y.toFixed(1)} mm · ${curseur.bande}` : 'Survolez une bande pour voir la position'}</span>
        <span>{nbSel ? `${nbSel} objet${nbSel > 1 ? 's' : ''} sélectionné${nbSel > 1 ? 's' : ''}` : D.bandeSel ? 'Bande sélectionnée' : ''}</span>
        {D.outil && <span style={{ color: 'var(--gcr-brand-700)' }} className="font-bold">Outil : {OUTILS.find((o) => o.type === D.outil)?.titre} — tracez sur une bande (Échap pour annuler)</span>}
        <span className="ml-auto">{def.bands.length} bande{def.bands.length > 1 ? 's' : ''} · {def.bands.reduce((s, b) => s + b.objects.length, 0)} objets · Ctrl+molette zoom</span>
      </footer>

      {/* Fenêtres */}
      {apercu && <ReportPreview def={def} data={donneesApercu ?? kind.sample} titre={`${def.name} — aperçu`} onClose={() => setApercu(false)} />}
      {expression && <ExprEditor def={def} titre={expression.titre} valeur={expression.valeur} multiple={expression.multiple} surValider={expression.surValider} surFermer={() => setExpression(null)} />}

      {dialogue === 'nouveau' && (
        <NouveauDialog surFermer={() => setDialogue(null)} surCreer={(d) => { D.charger(d, true); setFichier(undefined); setDialogue(null); }} />
      )}
      {dialogue === 'ouvrir' && (
        <OuvrirDialog surFermer={() => setDialogue(null)} surOuvrir={(d, f) => { D.charger(d); setFichier(f); setDialogue(null); }} dirty={D.dirty} />
      )}
      {dialogue === 'enregistrerSous' && (
        <SaisieNomDialog titre="Enregistrer sous…" libelle="Nom du modèle" valeur={`${def.name}${fichier ? '' : ''}`} surFermer={() => setDialogue(null)} surValider={(n) => { setDialogue(null); void enregistrer(n); }} />
      )}
      {dialogue === 'quitter' && (
        <ConfirmDialog title="Fermer sans enregistrer ?" message="Les modifications de ce modèle seront perdues." confirmLabel="Fermer sans enregistrer" danger
                       onConfirm={() => { setDialogue(null); onClose(); }} onCancel={() => setDialogue(null)} />
      )}
      {dialogue === 'verification' && (
        <Verification problemes={problemes} surFermer={() => setDialogue(null)}
                      surChoisir={(p) => { setDialogue(null); if (p.objetId) D.select([p.objetId]); else if (p.bandeId) D.selectBande(p.bandeId); }} />
      )}
    </div>
  );
}

// ─── Petits composants ──────────────────────────────────────────────────────

const Barre = () => <span aria-hidden className="w-px h-5 mx-1 flex-none" style={{ background: 'var(--gcr-line)' }} />;
const Sep = () => <div className="my-1 border-t border-line-soft" />;

function Menu({ id, libelle, icone, ouvert, setOuvert, children }: { id: string; libelle: string; icone: NomIc; ouvert: boolean; setOuvert: (v: string | null) => void; children: ReactNode }) {
  return (
    <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" aria-haspopup="menu" aria-expanded={ouvert} onClick={() => setOuvert(ouvert ? null : id)}
              className="h-8 px-2.5 rounded-md text-ink-label font-bold text-[12px] inline-flex items-center gap-1.5 hover:bg-[var(--gcr-surface-sunken)]"
              style={ouvert ? { background: 'var(--gcr-surface-sunken)' } : undefined}>
        <Ic n={icone} size={14} /> {libelle} <Ic n="chevD" size={11} />
      </button>
      {ouvert && (
        <div role="menu" onClick={() => setOuvert(null)} className="absolute left-0 top-9 z-30 min-w-[260px] rounded-md border border-line bg-surface shadow-lifted py-1">{children}</div>
      )}
    </div>
  );
}

function Item({ libelle, icone, raccourci, onClick }: { libelle: string; icone?: NomIc; raccourci?: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] text-ink hover:bg-[var(--gcr-surface-sunken)]">
      <span className="w-4 inline-flex">{icone && <Ic n={icone} size={14} />}</span>
      <span className="flex-1">{libelle}</span>
      {raccourci && <span className="text-[10.5px] text-ink-muted font-mono">{raccourci}</span>}
    </button>
  );
}

/** Règle horizontale (mm) collée en haut du plan de travail. */
function Regle({ def, pxMm }: { def: ReportDef; pxMm: number }) {
  const w = def.page.orientation === 'landscape' ? def.page.height : def.page.width;
  const m = def.page.margins.left;
  const pas = pxMm >= 6 ? 5 : pxMm >= 3 ? 10 : 20;
  const marques: ReactNode[] = [];
  for (let mm = 0; mm <= w; mm += pas / (pas === 5 ? 5 : pas === 10 ? 5 : 10)) {
    const majeur = Math.round(mm) % pas === 0 && Number.isInteger(Math.round(mm * 10) / 10);
    const x = mm * pxMm;
    marques.push(<line key={mm} x1={x} x2={x} y1={majeur ? 8 : 15} y2={20} stroke="#64748B" strokeWidth={1} />);
    if (majeur && Math.round(mm) % (pas * 2) === 0) marques.push(<text key={`t${mm}`} x={x + 3} y={11} fontSize={9} fill="#475569">{Math.round(mm)}</text>);
  }
  return (
    <div className="sticky top-0 z-20" style={{ height: 22, background: '#E2E8F0', borderBottom: '1px solid #CBD5E1' }} aria-hidden>
      <div style={{ width: 'max-content', margin: '0 auto', paddingLeft: 24 - 24, position: 'relative' }}>
        <svg width={w * pxMm} height={22} style={{ display: 'block', margin: '0 auto', position: 'relative', left: 0 }}>
          <rect x={m * pxMm} y={0} width={Math.max(0, (w - m - def.page.margins.right) * pxMm)} height={22} fill="#F8FAFC" />
          {marques}
        </svg>
      </div>
    </div>
  );
}

function Fenetre({ titre, largeur = 560, surFermer, children, pied }: { titre: string; largeur?: number; surFermer: () => void; children: ReactNode; pied?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); surFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [surFermer]);
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-6" style={{ background: 'rgb(15 26 46 / .5)' }} onPointerDown={surFermer} role="dialog" aria-modal="true" aria-label={titre}>
      <div className="bg-surface border border-line-soft rounded-lg shadow-lifted max-h-full flex flex-col" style={{ width: largeur, maxWidth: '100%' }} onPointerDown={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-line-soft flex items-center">
          <div className="font-extrabold text-[14px] text-ink">{titre}</div>
          <button onClick={surFermer} aria-label="Fermer" className="ml-auto h-7 w-7 rounded hover:bg-[var(--gcr-surface-sunken)] inline-flex items-center justify-center"><Ic n="close" size={16} /></button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
        {pied && <div className="px-4 py-3 border-t border-line-soft flex items-center gap-2 justify-end">{pied}</div>}
      </div>
    </div>
  );
}

const ENTREE = 'h-8 w-full rounded border border-line bg-surface text-ink text-[12.5px] px-2.5 focus:outline-none focus:border-[var(--gcr-brand-700)]';

function SaisieNomDialog({ titre, libelle, valeur, surFermer, surValider }: { titre: string; libelle: string; valeur: string; surFermer: () => void; surValider: (v: string) => void }) {
  const [v, setV] = useState(valeur);
  const ok = v.trim().length > 0;
  return (
    <Fenetre titre={titre} largeur={440} surFermer={surFermer} pied={<>
      <button onClick={surFermer} className="h-8 px-4 rounded-md border border-line text-ink-label font-bold text-[12px]">Annuler</button>
      <button disabled={!ok} onClick={() => surValider(v.trim())} className="h-8 px-4 rounded-md text-white font-bold text-[12px] disabled:opacity-50" style={{ background: 'var(--gcr-brand-700)' }}>Enregistrer</button>
    </>}>
      <label className="text-[12px] font-semibold text-ink-label">{libelle}
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && ok) surValider(v.trim()); }} className={`${ENTREE} mt-1`} />
      </label>
    </Fenetre>
  );
}

function NouveauDialog({ surFermer, surCreer }: { surFermer: () => void; surCreer: (d: ReportDef) => void }) {
  const [nom, setNom] = useState('Nouvel état');
  const [kind, setKind] = useState(() => kindDe('').id);
  const [depart, setDepart] = useState('');
  // identifiant STABLE du modèle intégré (celui de build() est aléatoire) + titre affiché
  const modeles = listerModelesIntegres().map((m) => ({ id: m.id, def: m.build() })).filter((m) => m.def.kind === kind);
  function creer() {
    const base = depart ? listerModelesIntegres().find((m) => m.id === depart)?.build() : null;
    const e = base ? { ...cloner(base), id: nouvelId('r'), name: nom.trim() || base.name } : creerEtat(kind, nom.trim() || 'Nouvel état');
    surCreer(e);
  }
  return (
    <Fenetre titre="Nouveau modèle" largeur={500} surFermer={surFermer} pied={<>
      <button onClick={surFermer} className="h-8 px-4 rounded-md border border-line text-ink-label font-bold text-[12px]">Annuler</button>
      <button onClick={creer} className="h-8 px-4 rounded-md text-white font-bold text-[12px]" style={{ background: 'var(--gcr-brand-700)' }}>Créer</button>
    </>}>
      <div className="flex flex-col gap-3">
        <label className="text-[12px] font-semibold text-ink-label">Titre<input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} className={`${ENTREE} mt-1`} /></label>
        <label className="text-[12px] font-semibold text-ink-label">Type de document
          <select value={kind} onChange={(e) => { setKind(e.target.value); setDepart(''); }} className={`${ENTREE} mt-1`}>
            {listerTypes().map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
        <label className="text-[12px] font-semibold text-ink-label">Point de départ
          <select value={depart} onChange={(e) => setDepart(e.target.value)} className={`${ENTREE} mt-1`}>
            <option value="">État vide</option>
            {modeles.map((m) => <option key={m.id} value={m.id}>Copie de : {m.def.name}</option>)}
          </select>
        </label>
      </div>
    </Fenetre>
  );
}

function OuvrirDialog({ surFermer, surOuvrir, dirty }: { surFermer: () => void; surOuvrir: (d: ReportDef, fichier?: string) => void; dirty: boolean }) {
  const toast = useToast();
  const [liste, setListe] = useState<ModeleInfo[] | null>(null);
  const [q, setQ] = useState('');
  const [dossier, setDossier] = useState('');
  const [confirmer, setConfirmer] = useState<ModeleInfo | null>(null);
  useEffect(() => { void listerModeles().then(setListe); void cheminDossierModeles().then(setDossier); }, []);
  async function ouvrir(m: ModeleInfo) {
    try { surOuvrir(await chargerModele(m.ref), m.source === 'fichier' ? m.file : undefined); } catch (e) { toast.error((e as Error).message); }
  }
  const filtres = (liste ?? []).filter((m) => !q || `${m.name} ${m.kind}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Fenetre titre="Ouvrir un modèle" largeur={640} surFermer={surFermer}>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un modèle…" className={`${ENTREE} mb-3`} aria-label="Rechercher" />
      {liste === null ? <div className="text-ink-muted text-[12px]">Chargement…</div> : filtres.length === 0 ? <div className="text-ink-muted text-[12px]">Aucun modèle.</div> : (
        <ul className="divide-y divide-line-soft border border-line-soft rounded-md max-h-[360px] overflow-y-auto">
          {filtres.map((m) => (
            <li key={m.ref}>
              <button onClick={() => (dirty ? setConfirmer(m) : void ouvrir(m))} className="w-full text-left px-3 py-2 hover:bg-[var(--gcr-surface-sunken)] flex items-center gap-3">
                <Ic n={m.source === 'integre' ? 'star' : 'file'} size={16} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-[12.5px] text-ink truncate">{m.name}</span>
                  <span className="block text-[11px] text-ink-muted truncate">{typeDe(m.kind)?.label ?? m.kind}{m.description ? ` — ${m.description}` : ''}</span>
                </span>
                <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded" style={{ background: m.source === 'integre' ? 'var(--gcr-surface-sunken)' : 'rgb(36 80 224 / .1)', color: m.source === 'integre' ? 'var(--gcr-text-muted)' : 'var(--gcr-brand-700)' }}>{m.source === 'integre' ? 'Intégré' : 'Mes modèles'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-ink-muted mt-3">Dossier des modèles : <span className="font-mono">{dossier}</span></p>
      {confirmer && (
        <ConfirmDialog title="Abandonner les modifications ?" message="Le modèle en cours contient des modifications non enregistrées." confirmLabel="Ouvrir quand même" danger
                       onConfirm={() => { const m = confirmer; setConfirmer(null); void ouvrir(m); }} onCancel={() => setConfirmer(null)} />
      )}
    </Fenetre>
  );
}

function Verification({ problemes, surFermer, surChoisir }: { problemes: ReturnType<typeof verifierModele>; surFermer: () => void; surChoisir: (p: ReturnType<typeof verifierModele>[number]) => void }) {
  return (
    <Fenetre titre="Vérification du modèle" largeur={640} surFermer={surFermer}>
      {problemes.length === 0
        ? <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--gcr-success)' }}><Ic n="check" size={18} /> Aucun problème détecté.</div>
        : (
          <ul className="divide-y divide-line-soft border border-line-soft rounded-md max-h-[420px] overflow-y-auto">
            {problemes.map((p, i) => (
              <li key={i}>
                <button onClick={() => surChoisir(p)} className="w-full text-left px-3 py-2 hover:bg-[var(--gcr-surface-sunken)] flex items-start gap-2 text-[12.5px]">
                  <span style={{ color: p.niveau === 'erreur' ? 'var(--gcr-danger)' : 'var(--gcr-warning)' }}><Ic n="warning" size={15} /></span>
                  <span className="flex-1 text-ink">{p.message}</span>
                  {(p.objetId || p.bandeId) && <span className="text-[10.5px] text-ink-muted">Afficher</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
    </Fenetre>
  );
}

export default function ReportDesigner(props: Parameters<typeof ReportDesignerInterne>[0]) {
  return <Racine><ReportDesignerInterne {...props} /></Racine>;
}
