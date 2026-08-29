import { PrintDocument } from './types';

/** Clé electron-store de l'imprimante ticket par défaut. */
export const TICKET_PRINTER_KEY = 'gc.imprimanteTicket';

export type PrinterInfo = { name: string; displayName?: string; isDefault?: boolean };

/** Vrai uniquement dans l'app Electron (le navigateur n'a pas `window.gc.printSilent`). */
export function supporteImpressionDirecte(): boolean {
  return typeof window.gc?.printSilent === 'function';
}

export async function listerImprimantes(): Promise<PrinterInfo[]> {
  try { return (await window.gc?.printers?.()) ?? []; }
  catch { return []; }
}

export async function getImprimanteTicket(): Promise<string | undefined> {
  try { return (await window.gc?.store.get(TICKET_PRINTER_KEY)) as string | undefined; }
  catch { return undefined; }
}

export async function setImprimanteTicket(name: string): Promise<void> {
  try { await window.gc?.store.set(TICKET_PRINTER_KEY, name); } catch { /* ignore */ }
}

/**
 * Imprime un document en silence (sans dialogue ni aperçu) sur l'imprimante
 * ticket par défaut (ou `deviceName` fourni). Retourne un résultat exploitable
 * pour un toast. Ne fait rien hors Electron.
 */
export async function imprimerSilencieux(
  doc: PrintDocument,
  deviceName?: string,
): Promise<{ success: boolean; reason?: string }> {
  if (!window.gc?.printSilent) {
    return { success: false, reason: 'Impression directe disponible uniquement dans l’application.' };
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${doc.css}</style></head><body>${doc.html}</body></html>`;
  const printer = deviceName ?? (await getImprimanteTicket());
  return window.gc.printSilent(html, { deviceName: printer, silent: true });
}
