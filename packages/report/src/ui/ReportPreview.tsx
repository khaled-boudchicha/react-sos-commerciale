import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ReportData, ReportDef } from '../model';
import { rendreEtat } from '../engine/render';
import { PX_PAR_MM } from '../engine/measure';
import { exporterPdf, imprimerDirect, imprimerResultat, impressionDirecteDisponible, pdfDirectDisponible, telechargerHtml } from '../engine/output';
import { REPORT_CSS_BASE } from '../engine/render';
import { useToast } from './toast';
import { Ic } from './icons';
import { Racine } from './Racine';

type ModeZoom = 'width' | 'page' | number;

const BTN = 'h-8 px-2.5 rounded-md border border-line text-ink-label font-bold text-[12px] inline-flex items-center gap-1.5 hover:bg-[var(--gcr-surface-sunken)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const BTN_ICONE = 'h-8 w-8 rounded-md text-ink-label inline-flex items-center justify-center hover:bg-[var(--gcr-surface-sunken)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
const NIVEAUX = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/**
 * Aperçu avant impression des états (équivalent du « Preview » de FastReport).
 * Pages exactes (mm), zoom ajustable, miniatures, navigation clavier, paramètres de l'état,
 * impression système / directe, export PDF et HTML, accès au designer.
 */
function ReportPreviewInterne({ def, data, params: paramsInitiaux, titre, onClose, onEdit, extra }: {
  def: ReportDef;
  data: ReportData;
  params?: Record<string, string>;
  titre?: string;
  onClose: () => void;
  /** Affiche « Modifier le modèle » (ouvre le designer). */
  onEdit?: () => void;
  /** Contenu supplémentaire de la barre d'outils (ex. sélecteur de modèle), après le titre. */
  extra?: ReactNode;
}) {
  const toast = useToast();
  const nom = titre || def.name;

  const [params, setParams] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(def.parameters.map((p) => [p.name, p.default ?? ''])), ...(paramsInitiaux ?? {}),
  }));
  const resultat = useMemo(() => rendreEtat(def, data, { params }), [def, data, params]);

  const [mode, setMode] = useState<ModeZoom>('width');
  const [vignettes, setVignettes] = useState(true);
  const [courante, setCourante] = useState(1);
  const [alertes, setAlertes] = useState(false);
  const [occupe, setOccupe] = useState<string | null>(null);

  const zone = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<(HTMLDivElement | null)[]>([]);
  const [boite, setBoite] = useState({ w: 800, h: 600 });

  useLayoutEffect(() => {
    const el = zone.current;
    if (!el) return;
    const mesurer = () => setBoite({ w: el.clientWidth, h: el.clientHeight });
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pxL = resultat.widthMm * PX_PAR_MM;
  const pxH = resultat.heightMm * PX_PAR_MM;
  const echelle = useMemo(() => {
    const largeur = (boite.w - 56) / pxL;
    // « Largeur » plafonné à 200 % : un ticket étroit ne doit pas être agrandi à l'excès
    const e = mode === 'width' ? Math.min(largeur, 2) : mode === 'page' ? Math.min(largeur, (boite.h - 40) / pxH) : mode;
    return Math.min(4, Math.max(0.2, e));
  }, [mode, boite, pxL, pxH]);

  // Pendant un défilement animé (« aller à la page n »), l'indicateur reste sur la page visée
  const animation = useRef<number | null>(null);
  const aller = useCallback((n: number) => {
    const i = Math.min(Math.max(1, n), resultat.pageCount);
    pagesRef.current[i - 1]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    setCourante(i);
    if (animation.current) window.clearTimeout(animation.current);
    // le défilement lisse peut démarrer avec retard : garde large, raccourcie dès que le défilement a lieu
    animation.current = window.setTimeout(() => { animation.current = null; }, 1500);
  }, [resultat.pageCount]);
  useEffect(() => () => { if (animation.current) window.clearTimeout(animation.current); }, []);

  // Page courante = celle qui occupe le haut de la zone
  const suivreDefilement = useRef(0);
  const surDefilement = () => {
    if (animation.current) {
      // chaque événement de défilement prolonge la garde jusqu'à l'arrêt de l'animation
      window.clearTimeout(animation.current);
      animation.current = window.setTimeout(() => { animation.current = null; }, 150);
      return;
    }
    cancelAnimationFrame(suivreDefilement.current);
    suivreDefilement.current = requestAnimationFrame(() => {
      const z = zone.current;
      if (!z) return;
      const repere = z.getBoundingClientRect().top + Math.min(160, z.clientHeight / 3);
      let n = 1;
      pagesRef.current.forEach((p, i) => { if (p && p.getBoundingClientRect().top <= repere) n = i + 1; });
      setCourante(n);
    });
  };

  const zoomer = useCallback((sens: 1 | -1) => {
    const base = typeof mode === 'number' ? mode : echelle;
    const suivant = sens > 0 ? NIVEAUX.find((n) => n > base + 0.01) : [...NIVEAUX].reverse().find((n) => n < base - 0.01);
    if (suivant) setMode(suivant);
  }, [mode, echelle]);

  const imprimer = useCallback(async () => {
    try { await imprimerResultat(resultat, nom); } catch { toast.error('Impression impossible.'); }
  }, [resultat, nom, toast]);

  useEffect(() => {
    function touche(e: KeyboardEvent) {
      const cible = e.target as HTMLElement | null;
      if (cible && /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape') onClose();
      else if (ctrl && e.key.toLowerCase() === 'p') { e.preventDefault(); void imprimer(); }
      else if (ctrl && (e.key === '+' || e.key === '=')) { e.preventDefault(); zoomer(1); }
      else if (ctrl && e.key === '-') { e.preventDefault(); zoomer(-1); }
      else if (ctrl && e.key === '0') { e.preventDefault(); setMode('width'); }
      else if (e.key === 'PageDown' || (e.key === 'ArrowRight' && e.altKey)) { e.preventDefault(); aller(courante + 1); }
      else if (e.key === 'PageUp' || (e.key === 'ArrowLeft' && e.altKey)) { e.preventDefault(); aller(courante - 1); }
      else if (e.key === 'Home' && ctrl) { e.preventDefault(); aller(1); }
      else if (e.key === 'End' && ctrl) { e.preventDefault(); aller(resultat.pageCount); }
    }
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [onClose, imprimer, zoomer, aller, courante, resultat.pageCount]);

  async function pdf() {
    if (!pdfDirectDisponible()) { await imprimer(); toast.info('Choisissez « Enregistrer en PDF » dans la fenêtre d’impression.'); return; }
    setOccupe('pdf');
    try {
      const chemin = await exporterPdf(resultat, nom);
      if (chemin) toast.success(`PDF enregistré : ${chemin}`);
    } catch (e) { toast.error(`Export PDF impossible : ${(e as Error).message}`); }
    finally { setOccupe(null); }
  }

  async function direct() {
    setOccupe('direct');
    try {
      const r = await imprimerDirect(resultat, nom);
      if (r.success) toast.success('Envoyé à l’imprimante.'); else toast.error(r.reason ?? 'Impression directe échouée.');
    } finally { setOccupe(null); }
  }

  const pct = Math.round(echelle * 100);
  const echelleVignette = 104 / pxL;
  const avecVignettes = vignettes && resultat.pageCount <= 120;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#4A5568' }} role="dialog" aria-label={`Aperçu : ${nom}`}>
      <style>{REPORT_CSS_BASE}</style>

      {/* Barre d'outils */}
      <div className="flex items-center gap-2 px-3 py-2 flex-none shadow-card flex-wrap" style={{ background: 'var(--gcr-surface)' }}>
        <div className="min-w-0 mr-1">
          <div className="font-extrabold text-[13px] text-ink truncate max-w-[280px]">{nom}</div>
          <div className="text-[11px] text-ink-muted">{resultat.pageCount} page{resultat.pageCount > 1 ? 's' : ''} · {resultat.lignes} ligne{resultat.lignes > 1 ? 's' : ''}</div>
        </div>
        {extra}

        <div className="flex items-center gap-0.5 border-l border-line-soft pl-2">
          <button className={BTN_ICONE} onClick={() => aller(1)} disabled={courante <= 1} title="Première page (Ctrl+Début)"><Ic n="first" /></button>
          <button className={BTN_ICONE} onClick={() => aller(courante - 1)} disabled={courante <= 1} title="Page précédente (Page préc.)"><Ic n="chevL" /></button>
          <input aria-label="Numéro de page" value={courante} inputMode="numeric"
                 onChange={(e) => { const n = parseInt(e.target.value, 10); if (n) aller(n); }}
                 className="w-11 h-8 text-center rounded-md border border-line bg-surface text-ink text-[12px] font-bold money" />
          <span className="text-[12px] text-ink-muted px-1">/ {resultat.pageCount}</span>
          <button className={BTN_ICONE} onClick={() => aller(courante + 1)} disabled={courante >= resultat.pageCount} title="Page suivante (Page suiv.)"><Ic n="chevR" /></button>
          <button className={BTN_ICONE} onClick={() => aller(resultat.pageCount)} disabled={courante >= resultat.pageCount} title="Dernière page (Ctrl+Fin)"><Ic n="last" /></button>
        </div>

        <div className="flex items-center gap-0.5 border-l border-line-soft pl-2">
          <button className={BTN_ICONE} onClick={() => zoomer(-1)} title="Réduire (Ctrl −)"><Ic n="zoomOut" /></button>
          <select aria-label="Zoom" value={typeof mode === 'number' ? String(mode) : mode}
                  onChange={(e) => setMode(e.target.value === 'width' || e.target.value === 'page' ? e.target.value : Number(e.target.value))}
                  className="h-8 rounded-md border border-line bg-surface text-ink text-[12px] font-bold px-1.5 w-[132px]">
            <option value="width">Largeur · {mode === 'width' ? pct : Math.round(((boite.w - 56) / pxL) * 100)}%</option>
            <option value="page">Page entière</option>
            {NIVEAUX.map((n) => <option key={n} value={n}>{Math.round(n * 100)} %</option>)}
          </select>
          <button className={BTN_ICONE} onClick={() => zoomer(1)} title="Agrandir (Ctrl +)"><Ic n="zoomIn" /></button>
          <button className={BTN_ICONE} onClick={() => setMode('width')} title="Ajuster à la largeur (Ctrl 0)"><Ic n="fitWidth" /></button>
          <button className={BTN_ICONE} onClick={() => setMode('page')} title="Page entière"><Ic n="fitPage" /></button>
          <button className={BTN_ICONE} onClick={() => setVignettes((v) => !v)} aria-pressed={vignettes} title="Miniatures"
                  style={vignettes ? { color: 'var(--gcr-brand-700)' } : undefined}><Ic n="pages" /></button>
        </div>

        {def.parameters.length > 0 && (
          <div className="flex items-center gap-2 border-l border-line-soft pl-2">
            {def.parameters.map((p) => (
              <label key={p.name} className="flex items-center gap-1 text-[11px] text-ink-muted font-semibold">
                {p.label || p.name}
                <input value={params[p.name] ?? ''} type={p.type === 'number' ? 'number' : p.type === 'date' ? 'date' : 'text'}
                       onChange={(e) => setParams((s) => ({ ...s, [p.name]: e.target.value }))}
                       className="h-8 w-28 rounded-md border border-line bg-surface text-ink text-[12px] px-2" />
              </label>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5 relative">
          {resultat.warnings.length > 0 && (
            <button className={BTN} style={{ color: 'var(--gcr-warning)' }} onClick={() => setAlertes((v) => !v)} title="Avertissements de mise en page">
              <Ic n="warning" /> {resultat.warnings.length}
            </button>
          )}
          {alertes && (
            <div className="absolute right-0 top-10 z-10 w-[420px] max-h-64 overflow-auto rounded-md border border-line bg-surface shadow-lifted p-3 text-[12px]">
              <div className="font-bold mb-1.5">Avertissements</div>
              <ul className="list-disc pl-4 space-y-1 text-ink-label">{resultat.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
          {onEdit && <button className={BTN} onClick={onEdit} title="Ouvrir le modèle dans le designer"><Ic n="settings" /> Modifier le modèle</button>}
          <button className={BTN} onClick={() => telechargerHtml(resultat, nom)} title="Enregistrer l’état en HTML"><Ic n="code" /> HTML</button>
          <button className={BTN} onClick={() => void pdf()} disabled={occupe === 'pdf'} title="Enregistrer en PDF"><Ic n="download" /> PDF</button>
          {impressionDirecteDisponible() && (
            <button className={BTN} onClick={() => void direct()} disabled={occupe === 'direct'} title="Imprimer sans dialogue sur l’imprimante par défaut">
              <Ic n="print" /> Directe
            </button>
          )}
          <button className={BTN} onClick={() => void imprimer()} style={{ background: 'var(--gcr-brand-700)', color: '#fff', borderColor: 'transparent' }} title="Imprimer (Ctrl+P)">
            <Ic n="print" /> Imprimer
          </button>
          <button className={BTN_ICONE} onClick={onClose} title="Fermer (Échap)" aria-label="Fermer"><Ic n="close" size={18} /></button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {avecVignettes && (
          <div className="w-[132px] flex-none overflow-y-auto py-3 flex flex-col items-center gap-3" style={{ background: '#2D3748' }} aria-label="Miniatures des pages">
            {resultat.pages.map((html, i) => (
              <button key={i} onClick={() => aller(i + 1)} aria-label={`Page ${i + 1}`} aria-current={courante === i + 1}
                      className="flex flex-col items-center gap-1 focus-visible:outline-2">
                <div style={{ width: pxL * echelleVignette, height: pxH * echelleVignette, overflow: 'hidden', borderRadius: 2,
                  outline: courante === i + 1 ? '2px solid #7C9BF2' : '1px solid rgb(255 255 255 / .18)', outlineOffset: 1, background: '#fff', position: 'relative' }}>
                  <div style={{ transform: `scale(${echelleVignette})`, transformOrigin: '0 0', width: pxL, height: pxH, pointerEvents: 'none' }}
                       dangerouslySetInnerHTML={{ __html: html }} />
                </div>
                <span className="text-[10.5px] font-bold" style={{ color: courante === i + 1 ? '#fff' : '#A0AEC0' }}>{i + 1}</span>
              </button>
            ))}
          </div>
        )}

        <div ref={zone} onScroll={surDefilement} className="flex-1 overflow-auto" tabIndex={0}>
          <div style={{ zoom: echelle, padding: '24px 0 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, minWidth: 'max-content' }}>
            {resultat.pages.map((html, i) => (
              <div key={i} ref={(el) => { pagesRef.current[i] = el; }} data-numero={i + 1}
                   style={{ boxShadow: '0 10px 30px rgb(10 18 34 / .4)', background: '#fff', flex: 'none' }}
                   dangerouslySetInnerHTML={{ __html: html }} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 px-4 py-1 text-[11px] flex-none" style={{ background: 'var(--gcr-surface)', color: 'var(--gcr-text-muted)' }}>
        <span>Format {Math.round(resultat.widthMm)} × {Math.round(resultat.heightMm)} mm</span>
        <span>Zoom {pct} %</span>
        <span className="ml-auto">Ctrl+P imprimer · Ctrl +/− zoom · Page préc./suiv. naviguer · Échap fermer</span>
      </div>
    </div>
  );
}

export default function ReportPreview(props: Parameters<typeof ReportPreviewInterne>[0]) {
  return <Racine><ReportPreviewInterne {...props} /></Racine>;
}
