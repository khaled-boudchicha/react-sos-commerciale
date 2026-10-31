/**
 * Palettes de couleurs de l'interface (jetons dans styles/tokens.css, attribut `data-palette` sur <html>).
 * Le thème clair / sombre (`data-theme`) reste indépendant : chaque palette a ses deux variantes.
 * Préférence du poste : electron-store (application) et localStorage (navigateur), lectures protégées.
 */

export type PaletteId = 'classique' | 'ivoire' | 'ardoise' | 'sauge' | 'graphite' | 'bordeaux';

export type Palette = {
  id: PaletteId;
  libelle: string;
  description: string;
  /** Aperçu (pastilles) : fond, surface, marque, accent — variante claire. */
  apercu: { fond: string; surface: string; marque: string; accent: string };
};

/* Valeurs d'aperçu uniquement (pastilles du sélecteur) : la source des couleurs reste tokens.css. */
export const PALETTES: Palette[] = [
  { id: 'classique', libelle: 'Classique', description: 'Blanc et bleu roi — charte v2 d’origine.',
    apercu: { fond: 'rgb(246 248 252)', surface: 'rgb(255 255 255)', marque: 'rgb(36 80 224)', accent: 'rgb(246 185 59)' } },
  { id: 'ivoire', libelle: 'Ivoire', description: 'Papier chaud, bleu roi et or : l’identité, sans blanc pur.',
    apercu: { fond: 'rgb(243 239 230)', surface: 'rgb(250 247 240)', marque: 'rgb(36 80 224)', accent: 'rgb(246 185 59)' } },
  { id: 'ardoise', libelle: 'Ardoise', description: 'Gris bleuté doux et bleu profond, esprit SAP Fiori.',
    apercu: { fond: 'rgb(230 234 240)', surface: 'rgb(241 244 248)', marque: 'rgb(29 78 216)', accent: 'rgb(246 185 59)' } },
  { id: 'sauge', libelle: 'Sauge', description: 'Vert pharmacie apaisant et émeraude, pour l’officine.',
    apercu: { fond: 'rgb(233 239 234)', surface: 'rgb(245 248 244)', marque: 'rgb(11 114 84)', accent: 'rgb(246 185 59)' } },
  { id: 'graphite', libelle: 'Graphite', description: 'Gris neutre et indigo, esprit Windows 11.',
    apercu: { fond: 'rgb(231 231 234)', surface: 'rgb(243 243 245)', marque: 'rgb(67 56 202)', accent: 'rgb(246 185 59)' } },
  { id: 'bordeaux', libelle: 'Bordeaux', description: 'Crème chaleureuse, bordeaux et or : registre premium.',
    apercu: { fond: 'rgb(242 236 230)', surface: 'rgb(250 246 242)', marque: 'rgb(142 31 63)', accent: 'rgb(246 185 59)' } },
];

const CLE = 'palette';
const estPalette = (v: unknown): v is PaletteId => PALETTES.some((p) => p.id === v);

/** Applique la palette (immédiat) et la mémorise sur le poste. */
export function applyPalette(id: PaletteId) {
  const racine = document.documentElement;
  if (id === 'classique') delete racine.dataset.palette;
  else racine.dataset.palette = id;
  try { void window.gc?.store.set(CLE, id); } catch { /* stockage Electron indisponible */ }
  try { localStorage.setItem(`gc.${CLE}`, id); } catch { /* stockage indisponible */ }
}

/** Palette courante (attribut posé sur <html>). */
export function paletteCourante(): PaletteId {
  const v = document.documentElement.dataset.palette;
  return estPalette(v) ? v : 'classique';
}

/** Restaure la palette mémorisée au démarrage. */
export async function loadPalette(): Promise<PaletteId> {
  let v: unknown;
  try { v = await window.gc?.store.get(CLE); } catch { /* ignoré */ }
  if (!estPalette(v)) { try { v = localStorage.getItem(`gc.${CLE}`); } catch { /* ignoré */ } }
  const id = estPalette(v) ? v : 'classique';
  if (id !== 'classique') document.documentElement.dataset.palette = id;
  return id;
}
