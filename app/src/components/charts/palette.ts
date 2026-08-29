/**
 * Palette catégorielle des graphiques — validée CVD-safe (scripts/validate_palette
 * du skill dataviz) : PASS complet en clair, PASS en sombre (WARN de contraste
 * sur le bleu levé par les légendes + la vue tableau des grilles). Assignée dans
 * l'ORDRE, jamais cyclée : au-delà de 6 séries, on replie le surplus dans « Autres ».
 */
export const CATEGORIQUES = ['#2450E0', '#B45309', '#0D9488', '#9333EA', '#DB2777', '#65A30D'] as const;

/** Couleur de la n-ième catégorie (l'index gère le repli « Autres » en gris). */
export function couleurCategorie(i: number): string {
  return CATEGORIQUES[i] ?? '#64748B';
}

/** Couleur de la série principale (mono-série : bleu de marque). */
export const SERIE_PRINCIPALE = '#3B66F5';

/**
 * Replie une liste triée décroissante en `max` tranches + « Autres » (somme du
 * reste) pour ne jamais dépasser la palette. Renvoie {label, value, couleur}.
 */
export function replierCategories(
  items: { label: string; value: number }[],
  max = 6,
): { label: string; value: number; couleur: string }[] {
  const tri = [...items].sort((a, b) => b.value - a.value);
  const tete = tri.slice(0, max).map((it, i) => ({ ...it, couleur: couleurCategorie(i) }));
  const reste = tri.slice(max);
  if (reste.length) {
    tete.push({ label: `Autres (${reste.length})`, value: reste.reduce((s, x) => s + x.value, 0), couleur: '#64748B' });
  }
  return tete;
}
