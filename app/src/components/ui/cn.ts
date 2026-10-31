/** Concatène des classes CSS en ignorant les valeurs vides (équivalent minimal de `clsx`). */
export function cn(...parts: (string | false | null | undefined | 0)[]): string {
  return parts.filter(Boolean).join(' ');
}
