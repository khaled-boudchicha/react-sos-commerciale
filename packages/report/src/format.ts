import type { FormatDef } from './model';

/** Locale d'impression : séparateur de milliers = espace insécable fine, décimale = virgule. */
export const SEP_MILLIERS = ' ';
export const SEP_DECIMAL = ',';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function versDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  // « 2026-06-15 » : date locale (et non UTC) pour ne pas reculer d'un jour
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function versNombre(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const s = String(v).trim().replace(/\s| | /g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** Formate une date avec un motif .NET simplifié : yyyy yy MMMM MMM MM M dddd ddd dd d HH H hh h mm m ss s tt. */
export function formaterDate(v: unknown, motif = 'dd/MM/yyyy'): string {
  const d = versDate(v);
  if (!d) return '';
  // Date « zéro » des bases Delphi (30/12/1899) : considérée vide
  if (d.getFullYear() < 1901) return '';
  const h12 = d.getHours() % 12 || 12;
  const tokens: Record<string, string> = {
    yyyy: String(d.getFullYear()), yy: String(d.getFullYear()).slice(-2),
    MMMM: MOIS[d.getMonth()], MMM: MOIS[d.getMonth()].slice(0, 4).replace(/\.$/, '') + (MOIS[d.getMonth()].length > 4 ? '.' : ''),
    MM: p2(d.getMonth() + 1), M: String(d.getMonth() + 1),
    dddd: JOURS[d.getDay()], ddd: JOURS[d.getDay()].slice(0, 3), dd: p2(d.getDate()), d: String(d.getDate()),
    HH: p2(d.getHours()), H: String(d.getHours()), hh: p2(h12), h: String(h12),
    mm: p2(d.getMinutes()), m: String(d.getMinutes()), ss: p2(d.getSeconds()), s: String(d.getSeconds()),
    tt: d.getHours() < 12 ? 'AM' : 'PM',
  };
  return motif.replace(/'([^']*)'|yyyy|yy|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|tt/g,
    (t, lit) => (lit !== undefined ? lit : tokens[t] ?? t));
}

function grouper(entier: string): string {
  return entier.replace(/\B(?=(\d{3})+(?!\d))/g, SEP_MILLIERS);
}

/**
 * Formate un nombre. Motif de type Excel/.NET : `#,##0.00` (milliers + 2 décimales), `0.0`, `0%`,
 * `#,##0.##` (décimales facultatives). Sans motif : `decimals` / `thousands`.
 */
export function formaterNombre(v: unknown, motif?: string, opts: { decimals?: number; thousands?: boolean } = {}): string {
  const n = versNombre(v);
  if (n == null) return '';
  let decMin = opts.decimals ?? 2, decMax = decMin, milliers = opts.thousands ?? true, pct = false, prefixe = '', suffixe = '';
  if (motif) {
    const m = /^([^#0,.]*)([#0,.]+)(.*)$/.exec(motif);
    if (m) {
      prefixe = m[1]; suffixe = m[3];
      const corps = m[2];
      milliers = corps.includes(',');
      const frac = corps.split('.')[1] ?? '';
      decMin = (frac.match(/0/g) ?? []).length;
      decMax = frac.length;
    }
    if (suffixe.includes('%')) pct = true;
  }
  const val = pct ? n * 100 : n;
  const arrondi = Math.round((Math.abs(val) + Number.EPSILON) * 10 ** decMax) / 10 ** decMax;
  let [ent, dec = ''] = arrondi.toFixed(decMax).split('.');
  while (dec.length > decMin && dec.endsWith('0')) dec = dec.slice(0, -1);
  if (milliers) ent = grouper(ent);
  const signe = val < 0 && arrondi !== 0 ? '-' : '';
  return `${signe}${prefixe}${ent}${dec ? SEP_DECIMAL + dec : ''}${suffixe}`;
}

/** Applique un format d'objet à une valeur brute. */
export function appliquerFormat(valeur: unknown, f?: FormatDef): string {
  const nullText = f?.nullText ?? '';
  if (valeur == null || valeur === '') return nullText;
  if (!f || f.kind === 'auto') {
    if (valeur instanceof Date) return formaterDate(valeur, 'dd/MM/yyyy');
    if (typeof valeur === 'number') return Number.isInteger(valeur) ? String(valeur) : formaterNombre(valeur, undefined, { decimals: 2 });
    if (typeof valeur === 'boolean') return valeur ? 'Oui' : 'Non';
    return String(valeur);
  }
  if (f.hideZeros && versNombre(valeur) === 0) return '';
  switch (f.kind) {
    case 'text': return String(valeur);
    case 'number': return formaterNombre(valeur, f.pattern, { decimals: f.decimals, thousands: f.thousands });
    case 'currency': {
      const s = formaterNombre(valeur, f.pattern, { decimals: f.decimals ?? 2, thousands: f.thousands ?? true });
      return s && f.currency ? `${s} ${f.currency}` : s;
    }
    case 'percent': return formaterNombre(valeur, f.pattern ?? '0.##%', { decimals: f.decimals });
    case 'date': return formaterDate(valeur, f.pattern || 'dd/MM/yyyy');
    case 'time': return formaterDate(valeur, f.pattern || 'HH:mm');
    case 'datetime': return formaterDate(valeur, f.pattern || 'dd/MM/yyyy HH:mm');
    case 'boolean': return valeur === true || valeur === 1 || valeur === '1' || String(valeur).toLowerCase() === 'true' ? 'Oui' : 'Non';
    case 'custom':
      if (f.pattern && /[yMdHhms]/.test(f.pattern) && versDate(valeur)) return formaterDate(valeur, f.pattern);
      return formaterNombre(valeur, f.pattern, { decimals: f.decimals, thousands: f.thousands });
    default: return String(valeur);
  }
}
