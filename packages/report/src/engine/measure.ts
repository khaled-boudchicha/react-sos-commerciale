import type { FontDef } from '../model';

export const PX_PAR_MM = 96 / 25.4;
export const mmVersPx = (mm: number) => mm * PX_PAR_MM;
export const pxVersMm = (px: number) => px / PX_PAR_MM;
export const ptVersPx = (pt: number) => (pt * 96) / 72;

/** Mesure la largeur d'un texte (px) dans une police donnée. */
export interface Mesureur {
  largeur(texte: string, font: FontDef): number;
  /**
   * Hauteur (px) d'un fragment HTML de texte mis en page par le vrai moteur du navigateur, dans une
   * boîte de `largeurPx` : c'est exactement la mise en page de l'impression (principe de paged.js).
   * Absent hors navigateur (tests) : le moteur retombe alors sur `compterLignes`.
   */
  hauteurDom?(fragment: string, css: string, largeurPx: number): number | null;
}

/** Hôte de mesure caché, partagé : même CSS que les pages, hors flux, invisible. */
function creerHoteDom(): ((fragment: string, css: string, largeurPx: number) => number | null) | undefined {
  if (typeof document === 'undefined' || !document.body) return undefined;
  let hote: HTMLDivElement | null = null;
  let style: HTMLStyleElement | null = null;
  let cssCourant = '';
  const cache = new Map<string, number>();
  return (fragment, css, largeurPx) => {
    try {
      const cle = `${largeurPx}|${fragment}`;
      if (css !== cssCourant) { cache.clear(); cssCourant = css; }
      const connu = cache.get(cle);
      if (connu != null) return connu;
      if (!hote || !hote.isConnected) {
        hote = document.createElement('div');
        hote.setAttribute('aria-hidden', 'true');
        hote.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none;contain:layout style';
        style = document.createElement('style');
        hote.appendChild(style);
        document.body.appendChild(hote);
        cssCourant = '';
      }
      if (style && style.textContent !== css) style.textContent = css;
      const cadre = document.createElement('div');
      cadre.className = 'rpt-page';
      cadre.style.cssText = `position:absolute;left:0;top:0;width:${largeurPx}px;height:auto;overflow:visible`;
      cadre.innerHTML = fragment;
      hote.appendChild(cadre);
      const h = (cadre.firstElementChild as HTMLElement | null)?.getBoundingClientRect().height ?? 0;
      hote.removeChild(cadre);
      if (!(h > 0)) return null;
      if (cache.size > 5000) cache.clear();
      cache.set(cle, h);
      return h;
    } catch { return null; }
  };
}

/** Mesureur réel (canvas) quand le DOM existe ; sinon estimation par largeur moyenne de caractère. */
export function creerMesureur(): Mesureur {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    if (typeof document !== 'undefined') ctx = document.createElement('canvas').getContext('2d');
  } catch { ctx = null; }
  let derniere = '';
  return {
    hauteurDom: creerHoteDom(),
    largeur(texte, font) {
      const px = ptVersPx(font.size);
      if (ctx) {
        const police = `${font.italic ? 'italic ' : ''}${font.bold ? 'bold ' : ''}${px}px "${font.family}", sans-serif`;
        if (police !== derniere) { ctx.font = police; derniere = police; }
        const w = ctx.measureText(texte).width;
        if (w > 0 || !texte) return w;
      }
      const mono = /courier|consolas|mono/i.test(font.family);
      return texte.length * px * (mono ? 0.6 : font.bold ? 0.56 : 0.51);
    },
  };
}

export const mesureurParDefaut: Mesureur = creerMesureur();

/**
 * Nombre de lignes occupées par un texte dans une largeur donnée (px), avec retour à la ligne
 * par mots (les mots plus longs que la ligne sont coupés). Même règle que `white-space: pre-wrap;
 * word-break: break-word` utilisée à l'affichage.
 */
export function compterLignes(texte: string, font: FontDef, largeurPx: number, retour: boolean, m: Mesureur): number {
  const paragraphes = texte.split('\n');
  if (!retour) return paragraphes.length;
  let total = 0;
  const espace = m.largeur(' ', font);
  for (const p of paragraphes) {
    if (!p.trim()) { total += 1; continue; }
    let lignes = 1, courant = 0;
    for (const mot of p.split(/ +/)) {
      if (!mot) continue;
      let w = m.largeur(mot, font);
      if (w > largeurPx) {
        // mot trop long : découpé caractère par caractère
        let restant = mot;
        if (courant > 0) { lignes++; courant = 0; }
        while (restant.length) {
          let n = 1;
          while (n < restant.length && m.largeur(restant.slice(0, n + 1), font) <= largeurPx) n++;
          restant = restant.slice(n);
          if (restant.length) lignes++; else courant = m.largeur(mot.slice(-n), font);
        }
        continue;
      }
      const ajout = courant === 0 ? w : courant + espace + w;
      if (ajout <= largeurPx || courant === 0) courant = ajout;
      else { lignes++; courant = w; }
      w = 0;
    }
    total += lignes;
  }
  return Math.max(1, total);
}
