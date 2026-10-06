/**
 * Montant en toutes lettres — portage fidèle de `Tdata.EnLettres` / `Tdata.ArreteLaSomme`
 * (DataModule.pas du desktop Delphi), pour que « Arrêter la somme de la présente facture »
 * imprime exactement la même phrase dans les deux applications.
 *
 * Particularités conservées du desktop : mots capitalisés, espaces (pas de tirets sauf
 * « Quatre-Vingt »), « et » seulement pour 21…71, « Cents » / « Quatre-Vingts » au pluriel
 * uniquement en fin de nombre, « Mille » invariable, « Millions » / « Milliards » au pluriel.
 * Seule différence : l'espace de tête du Delphi est retiré.
 */
const UNITE = ['', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix',
  'Onze', 'Douze', 'Treize', 'Quatorze', 'Quinze', 'Seize'];
const DIZAINE: Record<number, string> = { 2: 'Vingt', 3: 'Trente', 4: 'Quarante', 5: 'Cinquante', 6: 'Soixante', 7: '', 8: 'Quatre-Vingt' };
const COEFS = ['Cent', 'Mille', 'Million', 'Milliard'];

/** Entier en lettres (Tdata.EnLettres). */
export function enLettres(nombre: number): string {
  let n = Math.trunc(nombre);
  if (n === 0) return 'zéro';
  const neg = n < 0;
  if (neg) n = -n;
  let res = '';
  let coef = 0;
  do {
    let u = n % 10; n = Math.floor(n / 10);
    let d = n % 10; n = Math.floor(n / 10);
    if (d === 1 || d === 7 || d === 9) { d -= 1; u += 10; }
    let temp = '';
    if (d > 1) {
      temp = ` ${DIZAINE[d]}`;
      if (d < 8 && (u === 1 || u === 11)) temp += ' et';
    }
    if (u > 16) { temp += ` ${UNITE[10]}`; u -= 10; }
    if (u > 0) temp += ` ${UNITE[u]}`;
    if (res === '' && d === 8 && u === 0) res = 's';
    res = temp + res;

    const c = n % 10; n = Math.floor(n / 10);
    if (c > 0) {
      let t = c > 1 ? ` ${UNITE[c]}` : '';
      t += ` ${COEFS[0]}`;
      if (res === '' && c > 1) res = 's';
      res = t + res;
    }
    if (n > 0) {
      coef += 1;
      const i = n % 1000;
      if (i > 1 && coef > 1) res = `s${res}`;
      if (i > 0) res = ` ${COEFS[coef]}${res}`;
      if (i === 1 && coef === 1) n -= 1; // « Mille », jamais « Un Mille »
    }
  } while (n !== 0);
  return (neg ? `Moins${res}` : res).trim();
}

/** Phrase d'arrêté d'un montant en DA (Tdata.ArreteLaSomme) : « … Dinars Algerien et … Centimes ». */
export function arreteLaSomme(montant: number): string {
  const centimesTotal = Math.round(Math.abs(Number(montant) || 0) * 100);
  const dinars = Math.floor(centimesTotal / 100) * (montant < 0 ? -1 : 1);
  const centimes = centimesTotal % 100;
  return `${enLettres(dinars)} Dinars Algerien et ${enLettres(centimes)} Centimes`;
}
