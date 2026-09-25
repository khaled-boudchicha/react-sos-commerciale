export function fmtMoney(n: unknown, digits = 2): string {
  let v = Number(n ?? 0);
  if (!isFinite(v)) return '—';
  if (v === 0) v = 0; // normalise -0
  return v.toLocaleString('fr-DZ', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtDate(s: unknown): string {
  if (!s) return '—';
  const d = new Date(String(s));
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString('fr-DZ');
}

export function fmtQte(n: unknown): string {
  const v = Number(n ?? 0);
  return v.toLocaleString('fr-DZ', { maximumFractionDigits: 3 });
}

/** Date locale 'AAAA-MM-JJ' (toISOString donnerait le jour UTC : la veille entre 0 h et 1 h à Alger). */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isoToday(): string {
  return isoLocal(new Date());
}

/**
 * Date renvoyée par le serveur → 'AAAA-MM-JJ' locale, pour un <input type="date">.
 * Les DATETIME MariaDB arrivent sérialisées en UTC ('2026-09-24T23:00:00.000Z' pour
 * le 25/09 à minuit à Alger) : couper la chaîne décalerait d'un jour.
 */
export function isoDate(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? s.slice(0, 10) : isoLocal(d);
}

export function isoFirstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return isoLocal(d);
}
