import { useState } from 'react';
import {
  BAND_LABELS, BandDef, BandType, BarcodeObj, BorderDef, DEFAULT_BORDER, DEFAULT_FONT, FONT_FAMILIES, FormatDef, ImageObj,
  HighlightRule, LineObj, ObjDef, PAGE_SIZES, PageSizeName, ParamDef, ReportDef, ShapeObj, StyleDef, TextObj, CheckboxObj, creerPage,
} from '../../model';
import { kindDe, listerTypes } from '../../registre';
import { validerExpression } from '../../expr/parser';
import { Ic } from '../icons';
import type { DesignerApi } from './useDesigner';
import { majBande, majObjets, trouverObjet } from './ops';
import { BoutonIcone, Bascules, Choix, Couleur, Interrupteur, Ligne, Nombre, Section, Texte } from './fields';

export type OuvrirExpression = (o: { titre: string; valeur: string; multiple?: boolean; surValider: (v: string) => void }) => void;

const TOUS_BORDS = { top: true, right: true, bottom: true, left: true };

export default function Inspector({ D, ouvrirExpression }: { D: DesignerApi; ouvrirExpression: OuvrirExpression }) {
  const { def, sel } = D;
  const objets = sel.map((id) => trouverObjet(def, id)?.objet).filter((o): o is ObjDef => !!o);
  const bande = D.bandeSel ? def.bands.find((b) => b.id === D.bandeSel) : undefined;

  return (
    <aside className="w-[292px] flex-none border-l border-line-soft bg-surface overflow-y-auto" aria-label="Propriétés">
      <div className="px-3 py-2 border-b border-line-soft flex items-center gap-2 sticky top-0 bg-surface z-10">
        <Ic n={objets.length ? 'select' : bande ? 'bands' : 'settings'} size={14} />
        <div className="text-[12px] font-extrabold text-ink truncate">
          {objets.length > 1 ? `${objets.length} objets sélectionnés` : objets[0] ? `${libelleType(objets[0])} — ${objets[0].name}` : bande ? `Bande — ${bande.name}` : 'État et page'}
        </div>
      </div>
      {objets.length > 0 ? <ProprietesObjets D={D} objets={objets} ouvrirExpression={ouvrirExpression} />
        : bande ? <ProprietesBande D={D} bande={bande} ouvrirExpression={ouvrirExpression} />
          : <ProprietesEtat D={D} ouvrirExpression={ouvrirExpression} />}
    </aside>
  );
}

const libelleType = (o: ObjDef) => ({ text: 'Texte', image: 'Image', line: 'Ligne', shape: 'Forme', barcode: 'Code-barres', checkbox: 'Case à cocher' }[o.type]);

// ─── Objets ─────────────────────────────────────────────────────────────────

function ProprietesObjets({ D, objets, ouvrirExpression }: { D: DesignerApi; objets: ObjDef[]; ouvrirExpression: OuvrirExpression }) {
  const { def, sel } = D;
  const un = objets.length === 1 ? objets[0] : null;
  const memeType = objets.every((o) => o.type === objets[0].type);
  const maj = (patch: Record<string, unknown>) => D.set(majObjets(def, sel, patch as Partial<ObjDef>));
  const majDeep = (cle: 'font' | 'border' | 'format', patch: Record<string, unknown>) =>
    D.set(majObjets(def, sel, (o) => ({ [cle]: { ...((o as unknown as Record<string, object>)[cle] ?? {}), ...patch } } as Partial<ObjDef>)));
  const commun = <T,>(f: (o: ObjDef) => T): T | undefined => (objets.every((o) => f(o) === f(objets[0])) ? f(objets[0]) : undefined);
  const textes = memeType && objets[0].type === 'text' ? (objets as TextObj[]) : null;
  const t0 = textes?.[0];
  const police = { ...DEFAULT_FONT, ...(def.styles.find((s) => s.name === t0?.style)?.font ?? {}), ...(t0?.font ?? {}) };
  const bord = { ...DEFAULT_BORDER, ...(objets[0].border ?? {}) };

  return (
    <>
      <Section titre="Position et taille">
        <div className="grid grid-cols-2 gap-2">
          <Ligne large label="X"><Nombre value={commun((o) => o.x)} mixte={commun((o) => o.x) === undefined} onChange={(v) => maj({ x: v })} min={0} unite="mm" /></Ligne>
          <Ligne large label="Y"><Nombre value={commun((o) => o.y)} mixte={commun((o) => o.y) === undefined} onChange={(v) => maj({ y: v })} min={0} unite="mm" /></Ligne>
          <Ligne large label="Largeur"><Nombre value={commun((o) => o.w)} mixte={commun((o) => o.w) === undefined} onChange={(v) => maj({ w: v })} min={0.3} unite="mm" /></Ligne>
          <Ligne large label="Hauteur"><Nombre value={commun((o) => o.h)} mixte={commun((o) => o.h) === undefined} onChange={(v) => maj({ h: v })} min={0.2} unite="mm" /></Ligne>
        </div>
        <div className="flex gap-4 flex-wrap">
          <Interrupteur label="Verrouillé" value={commun((o) => !!o.locked)} onChange={(v) => maj({ locked: v })} aide="Empêche de déplacer ou redimensionner" />
          <Interrupteur label="Suit les objets du dessus" value={commun((o) => !!o.shift)} onChange={(v) => maj({ shift: v })} aide="Se décale vers le bas quand un champ au-dessus s'agrandit" />
        </div>
        <Ligne label="Rotation"><Choix value={commun((o) => o.rotation ?? 0)} onChange={(v) => maj({ rotation: v })} options={[0, 90, 180, 270].map((v) => ({ value: v, label: `${v}°` }))} /></Ligne>
      </Section>

      {textes && t0 && (
        <>
          {un && (
            <Section titre="Contenu">
              <Texte value={t0.text} multiligne lignes={3} mono onChange={(v) => maj({ text: v })} placeholder="Texte et [Dataset.champ]" />
              <button type="button" onClick={() => ouvrirExpression({ titre: 'Contenu du texte', valeur: t0.text, multiple: true, surValider: (v) => maj({ text: v }) })}
                      className="h-7 rounded border border-line text-[11.5px] font-bold text-ink-label hover:bg-[var(--gcr-surface-sunken)] inline-flex items-center justify-center gap-1.5">
                <Ic n="fx" size={13} /> Éditeur d’expression…
              </button>
            </Section>
          )}
          <Section titre="Police">
            <Ligne label="Famille"><Choix value={police.family} onChange={(v) => majDeep('font', { family: v })} options={[...new Set([police.family, ...FONT_FAMILIES])].map((f) => ({ value: f, label: f }))} /></Ligne>
            <div className="grid grid-cols-2 gap-2">
              <Ligne large label="Taille"><Nombre value={police.size} onChange={(v) => majDeep('font', { size: v })} min={3} max={96} step={0.5} unite="pt" /></Ligne>
              <Ligne large label="Couleur"><Couleur value={police.color} onChange={(v) => majDeep('font', { color: v ?? '#000000' })} /></Ligne>
            </div>
            <div className="flex gap-1">
              <BoutonIcone icone="bold" titre="Gras" actif={police.bold} onClick={() => majDeep('font', { bold: !police.bold })} />
              <BoutonIcone icone="italic" titre="Italique" actif={police.italic} onClick={() => majDeep('font', { italic: !police.italic })} />
              <BoutonIcone icone="underline" titre="Souligné" actif={police.underline} onClick={() => majDeep('font', { underline: !police.underline })} />
              <BoutonIcone icone="strike" titre="Barré" actif={police.strike} onClick={() => majDeep('font', { strike: !police.strike })} />
            </div>
          </Section>
          <Section titre="Alignement">
            <div className="flex gap-3 flex-wrap">
              <Bascules value={t0.align ?? 'left'} onChange={(v) => maj({ align: v })} options={[
                { value: 'left', icone: 'txtLeft', titre: 'À gauche' }, { value: 'center', icone: 'txtCenter', titre: 'Centré' },
                { value: 'right', icone: 'txtRight', titre: 'À droite' }, { value: 'justify', icone: 'txtJustify', titre: 'Justifié' }]} />
              <Bascules value={t0.valign ?? 'top'} onChange={(v) => maj({ valign: v })} options={[
                { value: 'top', icone: 'vTop', titre: 'En haut' }, { value: 'middle', icone: 'vMiddle', titre: 'Au milieu' }, { value: 'bottom', icone: 'vBottom', titre: 'En bas' }]} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Ligne large label="Marge int."><Nombre value={t0.padding ?? 0.5} onChange={(v) => maj({ padding: v })} min={0} max={20} unite="mm" /></Ligne>
              <Ligne large label="Interligne"><Nombre value={t0.lineHeight ?? 1.2} onChange={(v) => maj({ lineHeight: v })} min={0.8} max={3} step={0.05} /></Ligne>
            </div>
          </Section>
          <Section titre="Format de la valeur" ouvert={false}>
            <FormatEditeur format={t0.format} onChange={(f) => maj({ format: f })} />
          </Section>
          <Section titre="Comportement" ouvert={false}>
            <Interrupteur label="Retour à la ligne automatique" value={t0.wordWrap !== false} onChange={(v) => maj({ wordWrap: v })} />
            <Interrupteur label="S’agrandit selon le texte" value={t0.canGrow} onChange={(v) => maj({ canGrow: v })} aide="La hauteur de l'objet et de la bande s'étend" />
            <Interrupteur label="Se réduit selon le texte" value={t0.canShrink} onChange={(v) => maj({ canShrink: v })} />
            <Interrupteur label="Masquer les doublons" value={t0.hideDuplicates} onChange={(v) => maj({ hideDuplicates: v })} aide="N'imprime pas une valeur identique à la ligne précédente" />
          </Section>
          <Section titre="Mise en forme conditionnelle" ouvert={(t0.highlight?.length ?? 0) > 0}
                   actions={<BoutonIcone icone="plus" titre="Ajouter une règle" onClick={() => maj({ highlight: [...(t0.highlight ?? []), { when: '', font: { color: '#DC2626', bold: true } }] })} />}>
            {(t0.highlight ?? []).length === 0 && <p className="text-[11px] text-ink-muted">Change la couleur, le gras ou le fond selon la valeur : <code>Lignes.reste &gt; 0</code>.</p>}
            {(t0.highlight ?? []).map((h, i) => {
              const majRegle = (p: Partial<HighlightRule>) => maj({ highlight: (t0.highlight ?? []).map((x, k) => (k === i ? { ...x, ...p } : x)) });
              return (
                <div key={i} className="rounded-md border border-line-soft p-2 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1">
                    <div className="flex-1 min-w-0"><Texte mono value={h.when} placeholder="Lignes.reste > 0" onChange={(v) => majRegle({ when: v })} /></div>
                    <BoutonIcone icone="trash" titre="Supprimer la règle" onClick={() => maj({ highlight: (t0.highlight ?? []).filter((_, k) => k !== i) })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Ligne large label="Texte"><Couleur value={h.font?.color} onChange={(v) => majRegle({ font: { ...h.font, color: v } })} vide="Inchangé" /></Ligne>
                    <Ligne large label="Fond"><Couleur value={h.fill} onChange={(v) => majRegle({ fill: v })} vide="Inchangé" /></Ligne>
                  </div>
                  <Interrupteur label="Gras" value={h.font?.bold} onChange={(v) => majRegle({ font: { ...h.font, bold: v } })} />
                </div>
              );
            })}
          </Section>
          <Section titre="Style nommé" ouvert={false}>
            <Choix value={t0.style ?? ''} onChange={(v) => maj({ style: v || undefined })} options={[{ value: '', label: '(aucun)' }, ...def.styles.map((s) => ({ value: s.name, label: s.name }))]} />
          </Section>
        </>
      )}

      {memeType && objets[0].type === 'image' && un && <ProprietesImage o={un as ImageObj} maj={maj} ouvrirExpression={ouvrirExpression} />}
      {memeType && objets[0].type === 'line' && <ProprietesLigne o={objets[0] as LineObj} maj={maj} />}
      {memeType && objets[0].type === 'shape' && (
        <Section titre="Forme"><Ligne label="Type"><Choix value={(objets[0] as ShapeObj).shape} onChange={(v) => maj({ shape: v })} options={[{ value: 'rect', label: 'Rectangle' }, { value: 'ellipse', label: 'Ellipse' }]} /></Ligne></Section>
      )}
      {memeType && objets[0].type === 'barcode' && un && <ProprietesCodeBarres o={un as BarcodeObj} maj={maj} ouvrirExpression={ouvrirExpression} />}
      {memeType && objets[0].type === 'checkbox' && un && (
        <Section titre="Case à cocher">
          <Ligne label="Cochée si" large><Texte value={(un as CheckboxObj).checked} mono onChange={(v) => maj({ checked: v })} placeholder="Facture.reste_a_payer = 0" /></Ligne>
          <Ligne label="Couleur"><Couleur value={(un as CheckboxObj).color} onChange={(v) => maj({ color: v })} vide="Noir" /></Ligne>
        </Section>
      )}

      {objets[0].type !== 'line' && (
        <Section titre="Apparence" ouvert={objets[0].type !== 'text'}>
          <Ligne label="Remplissage"><Couleur value={commun((o) => o.fill)} onChange={(v) => maj({ fill: v })} vide="Transparent" /></Ligne>
          <Ligne label="Bordures">
            <div className="flex gap-1">
              {(['top', 'right', 'bottom', 'left'] as const).map((c) => (
                <BoutonIcone key={c} icone={({ top: 'alignTop', right: 'alignRight', bottom: 'alignBottom', left: 'alignLeft' } as const)[c]} titre={{ top: 'Haut', right: 'Droite', bottom: 'Bas', left: 'Gauche' }[c]}
                             actif={!!objets[0].border?.[c]} onClick={() => majDeep('border', { [c]: !objets[0].border?.[c] })} />
              ))}
              <BoutonIcone icone="rect" titre="Toutes les bordures" onClick={() => majDeep('border', TOUS_BORDS)} />
              <BoutonIcone icone="close" titre="Aucune bordure" onClick={() => majDeep('border', { top: false, right: false, bottom: false, left: false })} />
            </div>
          </Ligne>
          <div className="grid grid-cols-2 gap-2">
            <Ligne large label="Couleur"><Couleur value={bord.color} onChange={(v) => majDeep('border', { color: v ?? '#000000' })} /></Ligne>
            <Ligne large label="Épaisseur"><Nombre value={bord.width} onChange={(v) => majDeep('border', { width: v })} min={0.05} max={5} step={0.05} unite="mm" /></Ligne>
            <Ligne large label="Style"><Choix value={bord.style} onChange={(v) => majDeep('border', { style: v as BorderDef['style'] })} options={[{ value: 'solid', label: 'Continu' }, { value: 'dashed', label: 'Tirets' }, { value: 'dotted', label: 'Points' }, { value: 'double', label: 'Double' }]} /></Ligne>
            <Ligne large label="Coins"><Nombre value={bord.radius} onChange={(v) => majDeep('border', { radius: v })} min={0} max={30} unite="mm" /></Ligne>
          </div>
        </Section>
      )}

      <Section titre="Visibilité" ouvert={false}>
        <Ligne label="Imprimer si" large><Texte value={commun((o) => o.visible ?? '') ?? ''} mono placeholder="Facture.remise > 0   (vide = toujours)" onChange={(v) => maj({ visible: v || undefined })} /></Ligne>
        {commun((o) => o.visible) && validerExpression(commun((o) => o.visible) as string) && <Erreur msg={validerExpression(commun((o) => o.visible) as string)!} />}
      </Section>

      {un && <Section titre="Identification" ouvert={false}><Ligne label="Nom"><Texte value={un.name} onChange={(v) => maj({ name: v || un.name })} /></Ligne></Section>}
    </>
  );
}

const Erreur = ({ msg }: { msg: string }) => <div className="text-[11px] flex items-center gap-1" style={{ color: 'var(--gcr-danger)' }}><Ic n="warning" size={12} /> {msg}</div>;

function FormatEditeur({ format, onChange }: { format?: FormatDef; onChange: (f: FormatDef) => void }) {
  const f: FormatDef = format ?? { kind: 'auto' };
  const set = (p: Partial<FormatDef>) => onChange({ ...f, ...p });
  const kinds: { value: FormatDef['kind']; label: string }[] = [
    { value: 'auto', label: 'Automatique' }, { value: 'text', label: 'Texte' }, { value: 'number', label: 'Nombre' }, { value: 'currency', label: 'Monétaire' },
    { value: 'percent', label: 'Pourcentage' }, { value: 'date', label: 'Date' }, { value: 'time', label: 'Heure' }, { value: 'datetime', label: 'Date et heure' },
    { value: 'boolean', label: 'Oui / Non' }, { value: 'custom', label: 'Motif libre' },
  ];
  const exemples: Record<string, string[]> = {
    number: ['#,##0.00', '#,##0', '0.000', '#,##0.##'], currency: ['#,##0.00', '#,##0'], percent: ['0.##%', '0%'],
    date: ['dd/MM/yyyy', 'dd MMMM yyyy', 'dddd d MMMM yyyy', 'MM/yyyy'], time: ['HH:mm', 'HH:mm:ss'], datetime: ['dd/MM/yyyy HH:mm', 'dd/MM/yyyy HH:mm:ss'], custom: ['#,##0.00', 'dd/MM/yyyy'],
  };
  const avecMotif = ['number', 'currency', 'percent', 'date', 'time', 'datetime', 'custom'].includes(f.kind);
  return (
    <>
      <Ligne label="Type"><Choix value={f.kind} onChange={(v) => set({ kind: v })} options={kinds} /></Ligne>
      {avecMotif && (
        <>
          <Ligne label="Motif"><Texte value={f.pattern ?? ''} mono onChange={(v) => set({ pattern: v || undefined })} placeholder={exemples[f.kind]?.[0]} /></Ligne>
          <div className="flex flex-wrap gap-1">
            {(exemples[f.kind] ?? []).map((p) => (
              <button key={p} type="button" onClick={() => set({ pattern: p })} className="px-1.5 h-5 rounded border border-line text-[10.5px] font-mono text-ink-label hover:bg-[var(--gcr-surface-sunken)]">{p}</button>
            ))}
          </div>
        </>
      )}
      {f.kind === 'currency' && <Ligne label="Devise"><Texte value={f.currency ?? ''} onChange={(v) => set({ currency: v || undefined })} placeholder="DA" /></Ligne>}
      <Ligne label="Si vide"><Texte value={f.nullText ?? ''} onChange={(v) => set({ nullText: v || undefined })} placeholder="(rien)" /></Ligne>
      <Interrupteur label="Masquer les zéros" value={f.hideZeros} onChange={(v) => set({ hideZeros: v })} />
    </>
  );
}

function ProprietesImage({ o, maj, ouvrirExpression }: { o: ImageObj; maj: (p: Record<string, unknown>) => void; ouvrirExpression: OuvrirExpression }) {
  const [erreur, setErreur] = useState<string | null>(null);
  function charger(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(f.type)) { setErreur('Format non pris en charge (PNG, JPEG, GIF, WebP, SVG).'); return; }
    if (f.size > 2 * 1024 * 1024) { setErreur('Image trop volumineuse (2 Mo maximum).'); return; }
    const lecteur = new FileReader();
    lecteur.onload = () => { setErreur(null); maj({ src: String(lecteur.result), expr: undefined }); };
    lecteur.readAsDataURL(f);
  }
  return (
    <Section titre="Image">
      <Ligne label="Fichier" large>
        <div className="flex gap-2 items-center">
          <label className="h-7 px-2.5 rounded border border-line text-[11.5px] font-bold text-ink-label hover:bg-[var(--gcr-surface-sunken)] inline-flex items-center gap-1.5 cursor-pointer">
            <Ic n="upload" size={13} /> Choisir…
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" className="sr-only" onChange={(e) => charger(e.target.files?.[0])} />
          </label>
          {o.src && <button type="button" onClick={() => maj({ src: undefined })} className="text-[11px] text-ink-muted hover:text-ink">Retirer</button>}
        </div>
      </Ligne>
      {erreur && <Erreur msg={erreur} />}
      <Ligne label="Champ de données" large>
        <div className="flex gap-1.5">
          <div className="flex-1"><Texte value={o.expr ?? ''} mono placeholder="Societe.logo" onChange={(v) => maj({ expr: v || undefined })} /></div>
          <button type="button" title="Éditeur d’expression" onClick={() => ouvrirExpression({ titre: 'Source de l’image', valeur: o.expr ?? '', surValider: (v) => maj({ expr: v || undefined }) })}
                  className="h-7 w-7 rounded border border-line text-ink-label hover:bg-[var(--gcr-surface-sunken)] inline-flex items-center justify-center"><Ic n="fx" size={13} /></button>
        </div>
      </Ligne>
      <Ligne label="Ajustement"><Choix value={o.fit ?? 'contain'} onChange={(v) => maj({ fit: v })} options={[{ value: 'contain', label: 'Contenir' }, { value: 'cover', label: 'Couvrir' }, { value: 'stretch', label: 'Étirer' }, { value: 'none', label: 'Taille réelle' }]} /></Ligne>
      <Ligne label="Opacité"><Nombre value={o.opacity ?? 1} onChange={(v) => maj({ opacity: v })} min={0} max={1} step={0.05} /></Ligne>
    </Section>
  );
}

function ProprietesLigne({ o, maj }: { o: LineObj; maj: (p: Record<string, unknown>) => void }) {
  return (
    <Section titre="Ligne">
      <Ligne label="Direction"><Choix value={o.direction} onChange={(v) => maj({ direction: v })} options={[{ value: 'h', label: 'Horizontale' }, { value: 'v', label: 'Verticale' }, { value: 'diag', label: 'Diagonale ↘' }, { value: 'antidiag', label: 'Diagonale ↗' }]} /></Ligne>
      <Ligne label="Couleur"><Couleur value={o.color} onChange={(v) => maj({ color: v ?? '#000000' })} /></Ligne>
      <Ligne label="Épaisseur"><Nombre value={o.lineWidth ?? 0.3} onChange={(v) => maj({ lineWidth: v })} min={0.05} max={5} step={0.05} unite="mm" /></Ligne>
      <Ligne label="Trait"><Choix value={o.dash ?? 'solid'} onChange={(v) => maj({ dash: v })} options={[{ value: 'solid', label: 'Continu' }, { value: 'dashed', label: 'Tirets' }, { value: 'dotted', label: 'Points' }]} /></Ligne>
    </Section>
  );
}

function ProprietesCodeBarres({ o, maj, ouvrirExpression }: { o: BarcodeObj; maj: (p: Record<string, unknown>) => void; ouvrirExpression: OuvrirExpression }) {
  return (
    <Section titre="Code-barres">
      <Ligne label="Symbologie"><Choix value={o.symbology} onChange={(v) => maj({ symbology: v })} options={[{ value: 'code128', label: 'Code 128' }, { value: 'ean13', label: 'EAN-13' }, { value: 'code39', label: 'Code 39' }]} /></Ligne>
      <Ligne label="Valeur" large>
        <div className="flex gap-1.5">
          <div className="flex-1"><Texte value={o.value} mono placeholder="[Articles.code_bare]" onChange={(v) => maj({ value: v })} /></div>
          <button type="button" title="Éditeur d’expression" onClick={() => ouvrirExpression({ titre: 'Valeur du code-barres', valeur: o.value, multiple: true, surValider: (v) => maj({ value: v }) })}
                  className="h-7 w-7 rounded border border-line text-ink-label hover:bg-[var(--gcr-surface-sunken)] inline-flex items-center justify-center"><Ic n="fx" size={13} /></button>
        </div>
      </Ligne>
      <Interrupteur label="Afficher le texte lisible" value={o.showText !== false} onChange={(v) => maj({ showText: v })} />
      <Ligne label="Couleur"><Couleur value={o.color} onChange={(v) => maj({ color: v })} vide="Noir" /></Ligne>
    </Section>
  );
}

// ─── Bande ──────────────────────────────────────────────────────────────────

function ProprietesBande({ D, bande, ouvrirExpression }: { D: DesignerApi; bande: BandDef; ouvrirExpression: OuvrirExpression }) {
  const { def } = D;
  const maj = (patch: Partial<BandDef>) => D.set(majBande(def, bande.id, patch));
  const kind = kindDe(def.kind);
  const sources = kind.datasets.filter((d) => d.mode === 'list').map((d) => d.name);
  const avecDonnees = ['data', 'dataHeader', 'dataFooter', 'groupHeader', 'groupFooter'].includes(bande.type);
  const maitres = def.bands.filter((b) => b.type === 'data' && b.id !== bande.id && !b.parent);
  const champExpr = (label: string, valeur: string | undefined, surChange: (v: string | undefined) => void, placeholder: string) => (
    <>
      <Ligne label={label} large>
        <div className="flex gap-1.5">
          <div className="flex-1"><Texte value={valeur ?? ''} mono placeholder={placeholder} onChange={(v) => surChange(v || undefined)} /></div>
          <button type="button" title="Éditeur d’expression" onClick={() => ouvrirExpression({ titre: label, valeur: valeur ?? '', surValider: (v) => surChange(v || undefined) })}
                  className="h-7 w-7 rounded border border-line text-ink-label hover:bg-[var(--gcr-surface-sunken)] inline-flex items-center justify-center"><Ic n="fx" size={13} /></button>
        </div>
      </Ligne>
      {valeur && validerExpression(valeur) && <Erreur msg={validerExpression(valeur)!} />}
    </>
  );

  return (
    <>
      <Section titre="Bande">
        <Ligne label="Nom"><Texte value={bande.name} onChange={(v) => maj({ name: v || bande.name })} /></Ligne>
        <Ligne label="Type"><Choix value={bande.type} onChange={(v) => maj({ type: v as BandType })} options={(Object.keys(BAND_LABELS) as BandType[]).map((t) => ({ value: t, label: BAND_LABELS[t] }))} /></Ligne>
        <Ligne label="Hauteur"><Nombre value={bande.height} onChange={(v) => maj({ height: v })} min={1} max={800} unite="mm" /></Ligne>
        <Interrupteur label="S’agrandit avec ses textes" value={bande.canGrow ?? bande.objects.some((o) => o.type === 'text' && (o.canGrow || o.canShrink))} onChange={(v) => maj({ canGrow: v })} />
        {champExpr('Imprimer si', bande.visible, (v) => maj({ visible: v }), 'Facture.remise > 0')}
      </Section>

      {avecDonnees && (
        <Section titre="Données">
          <Ligne label="Source" large>
            <div className="flex gap-1.5">
              <div className="flex-1"><Texte value={bande.dataSource ?? ''} mono placeholder="Lignes" onChange={(v) => maj({ dataSource: v || undefined })} /></div>
              {sources.length > 0 && (
                <select aria-label="Choisir une source" value="" onChange={(e) => e.target.value && maj({ dataSource: e.target.value })}
                        className="h-7 w-[84px] rounded border border-line bg-surface text-[11.5px] px-1">
                  <option value="">Choisir…</option>
                  {sources.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          </Ligne>
          {bande.type === 'data' && (
            <>
              <Ligne label="Détail de"><Choix value={bande.parent ?? ''} onChange={(v) => maj({ parent: v || undefined })} options={[{ value: '', label: '(bande principale)' }, ...maitres.map((m) => ({ value: m.id, label: m.name }))]} /></Ligne>
              {champExpr('Filtre', bande.filter, (v) => maj({ filter: v }), 'Lignes.qte > 0')}
              <TriEditeur bande={bande} maj={maj} />
              <div className="grid grid-cols-2 gap-2">
                <Ligne large label="Colonnes"><Nombre value={bande.columns ?? 1} onChange={(v) => maj({ columns: Math.max(1, Math.round(v)) })} min={1} max={12} step={1} decimales={0} /></Ligne>
                <Ligne large label="Espace"><Nombre value={bande.columnGap ?? 0} onChange={(v) => maj({ columnGap: v })} min={0} max={50} unite="mm" /></Ligne>
              </div>
              <Ligne label="Lignes alt."><Couleur value={bande.zebra} onChange={(v) => maj({ zebra: v })} vide="Aucune" /></Ligne>
              <Interrupteur label="Imprimer même sans donnée" value={bande.printIfEmpty} onChange={(v) => maj({ printIfEmpty: v })} />
            </>
          )}
          {bande.type === 'groupHeader' && champExpr('Regrouper par', bande.groupBy, (v) => maj({ groupBy: v }), 'Ventes.client')}
        </Section>
      )}

      <Section titre="Pagination" ouvert={false}>
        {(bande.type === 'dataHeader' || bande.type === 'groupHeader' || bande.type === 'dataFooter' || bande.type === 'groupFooter' || bande.type === 'reportSummary') && (
          <Interrupteur label="Reste avec les données" value={bande.keepWithData !== false} onChange={(v) => maj({ keepWithData: v })} aide="Évite un en-tête seul en bas de page" />
        )}
        {(bande.type === 'dataHeader' || bande.type === 'groupHeader') && (
          <Interrupteur label="Répéter sur chaque page" value={bande.type === 'dataHeader' ? bande.repeatOnEveryPage !== false : bande.repeatOnEveryPage === true}
                        onChange={(v) => maj({ repeatOnEveryPage: v })} aide="Reprend l'en-tête en haut de chaque nouvelle page tant que le tableau continue" />
        )}
        <Interrupteur label="Nouvelle page avant" value={bande.startNewPage} onChange={(v) => maj({ startNewPage: v })} />
        <Interrupteur label="Nouvelle page après" value={bande.newPageAfter} onChange={(v) => maj({ newPageAfter: v })} />
        <Interrupteur label="Remettre la numérotation à 1" value={bande.resetPageNumber} onChange={(v) => maj({ resetPageNumber: v })} aide="Utile pour imprimer plusieurs documents à la suite" />
        {(bande.type === 'pageHeader' || bande.type === 'pageFooter') && (
          <>
            <Interrupteur label="Imprimer sur la première page" value={bande.printOnFirstPage !== false} onChange={(v) => maj({ printOnFirstPage: v })} />
            <Interrupteur label="Imprimer sur la dernière page" value={bande.printOnLastPage !== false} onChange={(v) => maj({ printOnLastPage: v })} />
          </>
        )}
      </Section>
    </>
  );
}

function TriEditeur({ bande, maj }: { bande: BandDef; maj: (p: Partial<BandDef>) => void }) {
  const tri = bande.sort ?? [];
  return (
    <Ligne label="Tri" large>
      <div className="flex flex-col gap-1.5">
        {tri.map((s, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <div className="flex-1"><Texte value={s.expr} mono placeholder="Lignes.designation" onChange={(v) => maj({ sort: tri.map((x, j) => (j === i ? { ...x, expr: v } : x)) })} /></div>
            <button type="button" title={s.dir === 'asc' ? 'Croissant' : 'Décroissant'} onClick={() => maj({ sort: tri.map((x, j) => (j === i ? { ...x, dir: x.dir === 'asc' ? 'desc' : 'asc' } : x)) })}
                    className="h-7 w-7 rounded border border-line text-ink-label inline-flex items-center justify-center"><Ic n={s.dir === 'asc' ? 'chevU' : 'chevD'} size={13} /></button>
            <button type="button" title="Retirer" onClick={() => maj({ sort: tri.filter((_, j) => j !== i) })} className="h-7 w-7 rounded text-ink-muted hover:text-ink inline-flex items-center justify-center"><Ic n="close" size={12} /></button>
          </div>
        ))}
        <button type="button" onClick={() => maj({ sort: [...tri, { expr: '', dir: 'asc' }] })} className="h-7 rounded border border-dashed border-line text-[11.5px] font-bold text-ink-label hover:bg-[var(--gcr-surface-sunken)] inline-flex items-center justify-center gap-1"><Ic n="plus" size={12} /> Ajouter un tri</button>
      </div>
    </Ligne>
  );
}

// ─── État / page ────────────────────────────────────────────────────────────

function ProprietesEtat({ D, ouvrirExpression }: { D: DesignerApi; ouvrirExpression: OuvrirExpression }) {
  const { def } = D;
  const maj = (patch: Partial<ReportDef>) => D.set({ ...def, ...patch });
  const page = def.page;
  const majPage = (patch: Partial<typeof page>) => maj({ page: { ...page, ...patch } });
  const changerFormat = (nom: PageSizeName) => {
    if (nom === 'Custom') { majPage({ size: 'Custom' }); return; }
    const neuf = creerPage(nom, page.orientation);
    majPage({ size: nom, width: neuf.width, height: neuf.height, continuous: neuf.continuous, margins: nom.startsWith('Ticket') || nom === 'Etiquette' ? neuf.margins : page.margins });
  };

  return (
    <>
      <Section titre="Général">
        <Ligne label="Titre"><Texte value={def.name} onChange={(v) => maj({ name: v || def.name })} /></Ligne>
        <Ligne label="Document"><Choix value={def.kind} onChange={(v) => maj({ kind: v })} options={listerTypes().map((k) => ({ value: k.id, label: k.label }))} /></Ligne>
        <Ligne label="Description" large><Texte value={def.description ?? ''} multiligne lignes={2} onChange={(v) => maj({ description: v || undefined })} /></Ligne>
        <Ligne label="Auteur"><Texte value={def.author ?? ''} onChange={(v) => maj({ author: v || undefined })} /></Ligne>
      </Section>

      <Section titre="Page">
        <Ligne label="Format"><Choix value={page.size} onChange={changerFormat} options={[...(Object.keys(PAGE_SIZES) as (keyof typeof PAGE_SIZES)[]).map((k) => ({ value: k as PageSizeName, label: PAGE_SIZES[k].label })), { value: 'Custom' as PageSizeName, label: 'Personnalisé' }]} /></Ligne>
        {page.size === 'Custom' && (
          <div className="grid grid-cols-2 gap-2">
            <Ligne large label="Largeur"><Nombre value={page.width} onChange={(v) => majPage({ width: v })} min={20} max={1500} unite="mm" /></Ligne>
            <Ligne large label="Hauteur"><Nombre value={page.height} onChange={(v) => majPage({ height: v })} min={20} max={5000} unite="mm" /></Ligne>
          </div>
        )}
        <Ligne label="Orientation"><Choix value={page.orientation} onChange={(v) => majPage({ orientation: v })} options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Paysage' }]} /></Ligne>
        <div className="grid grid-cols-2 gap-2">
          {(['top', 'bottom', 'left', 'right'] as const).map((c) => (
            <Ligne key={c} large label={{ top: 'Haut', bottom: 'Bas', left: 'Gauche', right: 'Droite' }[c]}>
              <Nombre value={page.margins[c]} onChange={(v) => majPage({ margins: { ...page.margins, [c]: v } })} min={0} max={100} unite="mm" />
            </Ligne>
          ))}
        </div>
        <Ligne label="Fond"><Couleur value={page.background} onChange={(v) => majPage({ background: v })} vide="Blanc" /></Ligne>
        <Interrupteur label="Hauteur continue (ticket)" value={page.continuous} onChange={(v) => majPage({ continuous: v })} aide="La page s'arrête où finit le contenu" />
      </Section>

      <Section titre="Paramètres" ouvert={false} actions={<BoutonIcone icone="plus" titre="Ajouter un paramètre" onClick={() => maj({ parameters: [...def.parameters, { name: `Param${def.parameters.length + 1}`, type: 'text' }] })} />}>
        {def.parameters.length === 0 && <p className="text-[11px] text-ink-muted">Valeurs saisies à l’aperçu et utilisables dans les expressions : <code>[Titre]</code>.</p>}
        {def.parameters.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_74px_24px] gap-1.5 items-center">
            <Texte value={p.name} mono onChange={(v) => maj({ parameters: def.parameters.map((x, j) => (j === i ? { ...x, name: v.replace(/[^\p{L}\p{N}_]/gu, '') || x.name } : x)) })} />
            <Choix value={p.type} onChange={(v) => maj({ parameters: def.parameters.map((x, j) => (j === i ? { ...x, type: v as ParamDef['type'] } : x)) })} options={[{ value: 'text', label: 'Texte' }, { value: 'number', label: 'Nombre' }, { value: 'date', label: 'Date' }, { value: 'boolean', label: 'Oui/Non' }]} />
            <button type="button" aria-label="Supprimer" onClick={() => maj({ parameters: def.parameters.filter((_, j) => j !== i) })} className="text-ink-muted hover:text-ink"><Ic n="close" size={12} /></button>
            <div className="col-span-3"><Texte value={p.default ?? ''} placeholder="Valeur par défaut" onChange={(v) => maj({ parameters: def.parameters.map((x, j) => (j === i ? { ...x, default: v } : x)) })} /></div>
          </div>
        ))}
      </Section>

      <Section titre="Variables" ouvert={false} actions={<BoutonIcone icone="plus" titre="Ajouter une variable" onClick={() => maj({ variables: [...def.variables, { name: `Var${def.variables.length + 1}`, expr: '' }] })} />}>
        {def.variables.length === 0 && <p className="text-[11px] text-ink-muted">Valeurs calculées réutilisables : <code>TTC = Facture.total_ht * 1.19</code>.</p>}
        {def.variables.map((v, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="grid grid-cols-[1fr_24px] gap-1.5">
              <Texte value={v.name} mono onChange={(n) => maj({ variables: def.variables.map((x, j) => (j === i ? { ...x, name: n.replace(/[^\p{L}\p{N}_]/gu, '') || x.name } : x)) })} />
              <button type="button" aria-label="Supprimer" onClick={() => maj({ variables: def.variables.filter((_, j) => j !== i) })} className="text-ink-muted hover:text-ink"><Ic n="close" size={12} /></button>
            </div>
            <div className="flex gap-1.5">
              <div className="flex-1"><Texte value={v.expr} mono placeholder="Expression" onChange={(e) => maj({ variables: def.variables.map((x, j) => (j === i ? { ...x, expr: e } : x)) })} /></div>
              <button type="button" title="Éditeur d’expression" onClick={() => ouvrirExpression({ titre: `Variable ${v.name}`, valeur: v.expr, surValider: (e) => maj({ variables: def.variables.map((x, j) => (j === i ? { ...x, expr: e } : x)) }) })}
                      className="h-7 w-7 rounded border border-line text-ink-label inline-flex items-center justify-center"><Ic n="fx" size={13} /></button>
            </div>
            {v.expr && validerExpression(v.expr) && <Erreur msg={validerExpression(v.expr)!} />}
          </div>
        ))}
      </Section>

      <Section titre="Styles nommés" ouvert={false} actions={<BoutonIcone icone="plus" titre="Ajouter un style" onClick={() => maj({ styles: [...def.styles, { name: `Style ${def.styles.length + 1}`, font: { size: 9 } }] })} />}>
        {def.styles.map((s, i) => <EditeurStyle key={i} s={s} onChange={(n) => maj({ styles: def.styles.map((x, j) => (j === i ? n : x)) })} onSupprimer={() => maj({ styles: def.styles.filter((_, j) => j !== i) })} />)}
      </Section>
    </>
  );
}

function EditeurStyle({ s, onChange, onSupprimer }: { s: StyleDef; onChange: (s: StyleDef) => void; onSupprimer: () => void }) {
  const f = { ...DEFAULT_FONT, ...(s.font ?? {}) };
  const setFont = (p: Partial<typeof f>) => onChange({ ...s, font: { ...s.font, ...p } });
  return (
    <div className="rounded border border-line-soft p-2 flex flex-col gap-1.5" style={{ background: 'var(--gcr-surface-sunken)' }}>
      <div className="flex gap-1.5">
        <div className="flex-1"><Texte value={s.name} onChange={(v) => onChange({ ...s, name: v || s.name })} /></div>
        <button type="button" aria-label="Supprimer le style" onClick={onSupprimer} className="text-ink-muted hover:text-ink"><Ic n="trash" size={13} /></button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Nombre value={f.size} onChange={(v) => setFont({ size: v })} min={3} max={96} unite="pt" />
        <Couleur value={s.font?.color} onChange={(v) => setFont({ color: v ?? '#000000' })} vide="Noir" />
      </div>
      <div className="flex gap-1 items-center">
        <BoutonIcone icone="bold" titre="Gras" actif={f.bold} onClick={() => setFont({ bold: !f.bold })} />
        <BoutonIcone icone="italic" titre="Italique" actif={f.italic} onClick={() => setFont({ italic: !f.italic })} />
        <Bascules value={s.align ?? 'left'} onChange={(v) => onChange({ ...s, align: v })} options={[{ value: 'left', icone: 'txtLeft', titre: 'Gauche' }, { value: 'center', icone: 'txtCenter', titre: 'Centré' }, { value: 'right', icone: 'txtRight', titre: 'Droite' }]} />
      </div>
      <Ligne label="Fond"><Couleur value={s.fill} onChange={(v) => onChange({ ...s, fill: v })} vide="Aucun" /></Ligne>
    </div>
  );
}
