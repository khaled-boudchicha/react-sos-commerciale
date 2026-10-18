import type { RenderResult } from './render';
import { configReport, type DocumentImprimable } from '../config';

const nettoyer = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_').trim() || 'etat';
const echapper = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** Document HTML autonome : toutes les pages à leur taille finale, prêt à imprimer ou à convertir en PDF. */
export function documentComplet(r: RenderResult, titre: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${echapper(titre)}</title><style>${r.css}\nhtml,body{margin:0;padding:0;background:#fff}</style></head><body>${r.html}</body></html>`;
}

/** Format attendu par l'impression directe existante (imprimerSilencieux). */
export function versDocumentImprimable(r: RenderResult, titre: string): DocumentImprimable {
  return { title: titre, html: r.html, css: r.css };
}

/** Impression via le dialogue système (inclut « Enregistrer en PDF »), dans une iframe isolée. */
export function imprimerResultat(r: RenderResult, titre: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
    const nettoyerIframe = () => setTimeout(() => iframe.remove(), 1000);
    iframe.onload = async () => {
      try {
        const w = iframe.contentWindow!;
        await (w.document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
        w.addEventListener('afterprint', nettoyerIframe, { once: true });
        w.focus();
        w.print();
        setTimeout(nettoyerIframe, 120_000); // repli si afterprint n'est jamais émis
        resolve();
      } catch (e) { nettoyerIframe(); reject(e); }
    };
    iframe.srcdoc = documentComplet(r, titre);
    document.body.appendChild(iframe);
  });
}

export function telechargerHtml(r: RenderResult, titre: string): void {
  const url = URL.createObjectURL(new Blob([documentComplet(r, titre)], { type: 'text/html;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `${nettoyer(titre)}.html`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** PDF fidèle aux dimensions exactes (service `exporterPdf` de l'hôte) ; retourne le chemin, ou null si annulé / indisponible. */
export async function exporterPdf(r: RenderResult, titre: string): Promise<string | null> {
  const api = configReport().impression;
  if (!api?.exporterPdf) return null;
  return api.exporterPdf(documentComplet(r, titre), r.widthMm, r.heightMm, `${nettoyer(titre)}.pdf`);
}

export const pdfDirectDisponible = () => !!configReport().impression?.exporterPdf;

/** Impression directe (sans dialogue) disponible chez l'hôte. */
export const impressionDirecteDisponible = (): boolean => {
  const i = configReport().impression;
  return !!i?.imprimerDirect && (i.impressionDirecteDisponible ? i.impressionDirecteDisponible() : true);
};

export async function imprimerDirect(r: RenderResult, titre: string): Promise<{ success: boolean; reason?: string }> {
  const i = configReport().impression;
  if (!i?.imprimerDirect) return { success: false, reason: 'Impression directe non disponible.' };
  return i.imprimerDirect(versDocumentImprimable(r, titre));
}
