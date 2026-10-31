/**
 * Palette catégorielle des graphiques — validée CVD-safe (scripts/validate_palette
 * du skill dataviz) : PASS complet en clair, PASS en sombre (WARN de contraste
 * sur le bleu levé par les légendes + la vue tableau des grilles). Assignée dans
 * l'ORDRE, jamais cyclée : au-delà de 6 séries, on replie le surplus dans « Autres ».
 * Valeurs : jetons `--chart-1..6` / `--chart-neutral` de `styles/tokens.css`
 * (redéfinis en thème sombre).
 */
export const CATEGORIQUES = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)',
] as const;

/** Gris du repli « Autres ». */
export const NEUTRE = 'var(--chart-neutral)';

/** Couleur de la n-ième catégorie (l'index gère le repli « Autres » en gris). */
export function couleurCategorie(i: number): string {
  return CATEGORIQUES[i] ?? NEUTRE;
}

/** Couleur de la série principale (mono-série : bleu de marque). */
export const SERIE_PRINCIPALE = 'var(--chart-1)';

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
    tete.push({ label: `Autres (${reste.length})`, value: reste.reduce((s, x) => s + x.value, 0), couleur: NEUTRE });
  }
  return tete;
}
