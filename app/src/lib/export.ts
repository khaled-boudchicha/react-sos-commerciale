/**
 * Export CSV pensé pour Excel en configuration française :
 * séparateur `;`, virgule décimale et BOM UTF-8 (sans lui Excel casse les accents).
 */

export type ExportColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
  /** Nombre : écrit avec la virgule décimale, sans séparateur de milliers. */
  numeric?: boolean;
};

function echapper(v: string): string {
  // Anti-injection de formule : une cellule texte commençant par = + - @ (ou une
  // tabulation / un retour chariot) est interprétée comme une formule par Excel /
  // LibreOffice. On la neutralise avec une apostrophe de tête.
  const neutralise = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[";\n\r]/.test(neutralise) ? `"${neutralise.replace(/"/g, '""')}"` : neutralise;
}

function cellule<T>(col: ExportColumn<T>, row: T): string {
  const v = col.value(row);
  if (v === null || v === undefined) return '';
  if (col.numeric) {
    const n = Number(v);
    return Number.isFinite(n) ? String(n).replace('.', ',') : '';
  }
  return echapper(String(v));
}

export function construireCsv<T>(columns: ExportColumn<T>[], rows: T[]): string {
  const lignes = [columns.map((c) => echapper(c.header)).join(';')];
  for (const row of rows) lignes.push(columns.map((c) => cellule(c, row)).join(';'));
  return `﻿${lignes.join('\r\n')}\r\n`;
}

/** Déclenche le téléchargement du CSV. `nom` est complété par la date du jour. */
export function exporterCsv<T>(nom: string, columns: ExportColumn<T>[], rows: T[]): void {
  const csv = construireCsv(columns, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nom}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Révocation différée : Chromium a besoin de l'URL le temps d'amorcer l'écriture.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
