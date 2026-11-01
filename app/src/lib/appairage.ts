/**
 * Lecture tolérante du code d'appairage (contenu du QR du tray de l'agent : JSON `{ u, k, a }`).
 *
 * Le code circule souvent par messagerie (WhatsApp, e-mail, Word) qui l'abîme : guillemets typographiques,
 * espaces insécables, retours à la ligne, texte autour (« Voici le code : {…} »), clés sans guillemets.
 * On le répare autant que possible, sans jamais inventer de valeur : clé (`k`) et agent (`a`) obligatoires.
 */
export type CodeAppairage = { u?: string; k: string; a: string };

const GUILLEMETS = /[“”„‟«»″‶]/g; // “ ” „ ‟ « » ″ ‶
const APOSTROPHES = /[‘’‚‛′‵]/g;              // ‘ ’ ‚ ‛ ′ ‵
const INVISIBLES = /[​-‍⁠﻿]/g;                         // espaces de largeur nulle, BOM
const ESPACES = /[   ]/g;                                    // espaces insécables

function nettoyer(texte: string): string {
  return texte.replace(INVISIBLES, '').replace(ESPACES, ' ').replace(GUILLEMETS, '"').replace(APOSTROPHES, "'").trim();
}

function valider(o: unknown): CodeAppairage | null {
  if (!o || typeof o !== 'object') return null;
  const { u, k, a } = o as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
  if (!s(k) || !s(a)) return null;
  return { ...(s(u) ? { u: s(u) } : {}), k: s(k), a: s(a) };
}

function essayerJson(t: string): CodeAppairage | null {
  try { return valider(JSON.parse(t)); } catch { /* suite */ }
  // Clés sans guillemets ({u:…}) ou guillemets simples ('…') : réparation prudente
  const repare = t
    .replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":')
    .replace(/'([^'"]*)'/g, '"$1"');
  try { return valider(JSON.parse(repare)); } catch { return null; }
}

/** Décode un code collé ou importé ; null s'il est illisible. */
export function lireCodeAppairage(brut: string): CodeAppairage | null {
  const t = nettoyer(String(brut ?? ''));
  if (!t) return null;
  // 1. Le premier objet JSON contenu dans le texte (texte d'accompagnement ignoré)
  const debut = t.indexOf('{');
  const fin = t.lastIndexOf('}');
  if (debut >= 0 && fin > debut) {
    const r = essayerJson(t.slice(debut, fin + 1).replace(/\s*\n\s*/g, ' '));
    if (r) return r;
  }
  // 2. JSON encodé en base64 (variante de partage sans caractères spéciaux)
  const compact = t.replace(/\s+/g, '');
  if (/^[A-Za-z0-9+/_-]+=*$/.test(compact) && compact.length >= 16) {
    try {
      const json = atob(compact.replace(/-/g, '+').replace(/_/g, '/'));
      const r = essayerJson(json);
      if (r) return r;
    } catch { /* pas du base64 */ }
  }
  return null;
}
