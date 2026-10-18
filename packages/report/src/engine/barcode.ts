/**
 * Générateurs de codes-barres 1D en SVG vectoriel (Code 128, Code 39, EAN-13).
 * Chaque encodeur renvoie une suite de largeurs de modules qui alternent barre / espace
 * en commençant par une barre.
 */

import type { BarcodeSymbology } from '../model';

// ─── Code 128 ───────────────────────────────────────────────────────────────

export const CODE128_MOTIFS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

export function encoderCode128(valeur: string): number[] {
  const texte = valeur.replace(/[^\x20-\x7E]/g, '?');
  if (!texte) return [];
  const numerique = /^\d+$/.test(texte) && texte.length >= 4 && texte.length % 2 === 0;
  const codes: number[] = [];
  if (numerique) {
    codes.push(105);
    for (let i = 0; i < texte.length; i += 2) codes.push(Number(texte.slice(i, i + 2)));
  } else {
    codes.push(104);
    for (const c of texte) codes.push(c.charCodeAt(0) - 32);
  }
  let somme = codes[0];
  for (let i = 1; i < codes.length; i++) somme += codes[i] * i;
  codes.push(somme % 103, 106);
  return codes.flatMap((c) => CODE128_MOTIFS[c].split('').map(Number));
}

// ─── Code 39 ────────────────────────────────────────────────────────────────

export const CODE39_MOTIFS: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn',
  G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn', K: 'wnnnnnnww', L: 'nnwnnnnww',
  M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn',
  S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn', Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn',
  '*': 'nwnnwnwnn', $: 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn',
};

export function encoderCode39(valeur: string): number[] {
  const texte = valeur.toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '');
  if (!texte) return [];
  const sortie: number[] = [];
  const chars = `*${texte}*`.split('');
  chars.forEach((c, idx) => {
    for (const e of CODE39_MOTIFS[c]) sortie.push(e === 'w' ? 3 : 1);
    if (idx < chars.length - 1) sortie.push(1); // espace inter-caractère
  });
  return sortie;
}

// ─── EAN-13 ─────────────────────────────────────────────────────────────────

const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const EAN_PARITE = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function cleEan13(douze: string): number {
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(douze[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (s % 10)) % 10;
}

/** Normalise en 13 chiffres (complète / corrige la clé) ; null si la valeur n'est pas exploitable. */
export function normaliserEan13(valeur: string): string | null {
  const d = valeur.replace(/\D/g, '');
  if (d.length < 12) return null;
  const douze = d.slice(0, 12);
  return douze + cleEan13(douze);
}

export function encoderEan13(valeur: string): number[] {
  const ean = normaliserEan13(valeur);
  if (!ean) return [];
  const parite = EAN_PARITE[Number(ean[0])];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (parite[i - 1] === 'L' ? EAN_L : EAN_G)[Number(ean[i])];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += EAN_R[Number(ean[i])];
  bits += '101';
  // bits → largeurs alternées (commence par une barre = « 1 »)
  const largeurs: number[] = [];
  let courant = bits[0], n = 0;
  for (const b of bits) { if (b === courant) n++; else { largeurs.push(n); courant = b; n = 1; } }
  largeurs.push(n);
  return largeurs;
}

// ─── Rendu SVG ──────────────────────────────────────────────────────────────

export function encoder(symbologie: BarcodeSymbology, valeur: string): number[] {
  switch (symbologie) {
    case 'code128': return encoderCode128(valeur);
    case 'code39': return encoderCode39(valeur);
    case 'ean13': return encoderEan13(valeur);
  }
}

const echapper = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** SVG d'un code-barres occupant `wMm × hMm`. Valeur illisible → cadre « code invalide ». */
export function codeBarresSvg(
  symbologie: BarcodeSymbology, valeur: string, wMm: number, hMm: number,
  opts: { texte?: boolean; couleur?: string } = {},
): string {
  const modules = encoder(symbologie, valeur);
  const couleur = opts.couleur || '#000';
  if (!modules.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${wMm} ${hMm}"><rect x="0.2" y="0.2" width="${wMm - 0.4}" height="${hMm - 0.4}" fill="none" stroke="#B91C1C" stroke-width="0.3" stroke-dasharray="1 1"/><text x="${wMm / 2}" y="${hMm / 2}" font-size="2.5" fill="#B91C1C" text-anchor="middle" dominant-baseline="middle" font-family="Arial">Code invalide</text></svg>`;
  }
  const total = modules.reduce((s, m) => s + m, 0);
  const hauteurTexte = opts.texte ? Math.min(3.6, hMm * 0.28) : 0;
  const hBarres = hMm - hauteurTexte;
  const quiet = Math.min(1.5, wMm * 0.04);
  const unite = (wMm - 2 * quiet) / total;
  let x = quiet, rects = '';
  modules.forEach((w, i) => {
    if (i % 2 === 0) rects += `<rect x="${x.toFixed(3)}" y="0" width="${(w * unite).toFixed(3)}" height="${hBarres.toFixed(2)}"/>`;
    x += w * unite;
  });
  const lisible = symbologie === 'ean13' ? (normaliserEan13(valeur) ?? valeur) : valeur;
  const texte = opts.texte
    ? `<text x="${wMm / 2}" y="${(hBarres + hauteurTexte * 0.8).toFixed(2)}" font-size="${(hauteurTexte * 0.85).toFixed(2)}" text-anchor="middle" font-family="Arial, sans-serif" fill="${couleur}">${echapper(lisible)}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${wMm} ${hMm}" preserveAspectRatio="none" shape-rendering="crispEdges"><g fill="${couleur}">${rects}</g>${texte}</svg>`;
}
