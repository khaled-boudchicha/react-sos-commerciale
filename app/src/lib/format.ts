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

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoFirstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
