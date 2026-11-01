import { useEffect, useMemo, useRef, useState } from 'react';
import { PrintDocument } from './types';
import { supporteImpressionDirecte, imprimerSilencieux } from './silentPrint';
import { useToast } from '../../components/ui/Toast';

// Polyfill Paged.js embarqué dans public/vendor/ (copié depuis node_modules par
// le script npm `sync:pagedjs` — l'export map du package ne permet pas l'import
// direct du dist en build). URL relative → OK en dev Vite, build web et Electron file://.
const PAGEDJS_POLYFILL = 'vendor/paged.polyfill.js';

/**
 * Aperçu avant impression — moteur générique.
 *
 * Fonctionnement :
 *  1. Le document (html + css du modèle) est injecté dans une IFRAME via srcDoc
 *     → isolation totale : aucun conflit avec le CSS/Tailwind de l'application.
 *  2. Le polyfill Paged.js est chargé DANS l'iframe : il découpe le contenu en
 *     pages selon les règles `@page` du modèle (taille, marges, compteurs,
 *     `string-set` pour les marges tournantes, thead répétés).
 *  3. L'iframe notifie le parent via postMessage quand la pagination est finie
 *     (`paged:rendered`, avec le nombre de pages) → le bouton Imprimer s'active.
 *  4. « Imprimer » appelle iframe.contentWindow.print() : seul le contenu de
 *     l'iframe part à l'impression (dialogue natif Electron/Chromium, avec
 *     « Enregistrer en PDF » intégré).
 *
 * Usage (voir src/print/README.md) :
 *   const [doc, setDoc] = useState<PrintDocument | null>(null);
 *   <button onClick={() => setDoc(buildVenteModelePrint(vente, societe, modele))}>Imprimer</button>
 *   {doc && <PrintPreview doc={doc} onClose={() => setDoc(null)} />}
 */

// Habillage de l'aperçu À L'ÉCRAN uniquement (dans l'iframe) : fond gris,
// pages en « feuilles » ombrées. N'affecte pas l'impression (@media print).
const INTERFACE_CSS = `
@media screen {
  html { background: #566072; }
  body { margin: 0; }
  /* Pages plus larges que la fenêtre (paysage) : réduites à l'écran par vendor/paged-config.js */
  .pagedjs_pages { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 24px 0 48px; }
  .pagedjs_page { background: #fff; box-shadow: 0 10px 30px rgb(10 18 34 / .35); }
}
@media print {
  html, body { background: #fff; }
}
`;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

function buildSrcDoc(doc: PrintDocument): string {
  // L'iframe srcDoc hérite de la base URL du parent : on résout l'asset en absolu
  // pour être robuste (dev Vite, build web, Electron file://).
  const polyfill = new URL(PAGEDJS_POLYFILL, document.baseURI).href;
  const config = new URL('vendor/paged-config.js', document.baseURI).href;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(doc.title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap">
<style>${INTERFACE_CSS}</style>
<style>${doc.css}</style>
<script src="${config}"></script>
<script src="${polyfill}"></script>
</head>
<body>${doc.html}</body>
</html>`;
}

export default function PrintPreview({ doc, onClose }: { doc: PrintDocument; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [pages, setPages] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const srcDoc = useMemo(() => buildSrcDoc(doc), [doc]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === 'paged:rendered') { setReady(true); setPages(Number(e.data.pages) || 0); }
      if (e.data?.type === 'paged:error') { setError(String(e.data.message ?? 'Erreur de pagination')); }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('message', onMessage);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const toast = useToast();
  const [impressionDirecte, setImpressionDirecte] = useState(false);
  const directeDispo = supporteImpressionDirecte();

  function print() {
    iframeRef.current?.contentWindow?.print();
  }

  async function imprimerDirect() {
    setImpressionDirecte(true);
    try {
      const r = await imprimerSilencieux(doc);
      if (r.success) toast.success('Envoyé à l’imprimante.');
      else toast.error(r.reason ?? 'Impression directe échouée.');
    } finally {
      setImpressionDirecte(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#566072' }}>
      <div className="flex items-center gap-3 px-5 py-3 shadow-card flex-none" style={{ background: 'var(--surface)' }}>
        <div className="font-bold text-[13px] text-ink">{doc.title}</div>
        <div className="text-[11.5px] text-ink-muted">
          {error ? <span style={{ color: 'var(--danger)' }}>{error}</span>
            : ready ? `${pages} page${pages > 1 ? 's' : ''}`
            : 'Mise en page…'}
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={onClose}
                  className="px-4 py-2 rounded-md border border-line text-ink-label font-bold text-[12px]">
            Fermer <span className="font-mono text-[10px] opacity-60">Échap</span>
          </button>
          {directeDispo && (
            <button onClick={() => void imprimerDirect()} disabled={!ready || impressionDirecte}
                    title="Imprimer sans dialogue sur l’imprimante ticket par défaut (Paramètres)"
                    className="px-4 py-2 rounded-md border border-line text-ink-label font-bold text-[12px] disabled:opacity-50">
              {impressionDirecte ? 'Impression…' : 'Impression directe'}
            </button>
          )}
          <button onClick={print} disabled={!ready}
                  className="px-4 py-2 rounded-md bg-brand-700 text-white font-bold text-[12px] disabled:opacity-50">
            Imprimer / PDF
          </button>
        </div>
      </div>
      <iframe ref={iframeRef} title={doc.title} srcDoc={srcDoc}
              className="flex-1 w-full border-0" />
    </div>
  );
}
