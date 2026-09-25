/**
 * Droit de timbre sur les paiements en espèces (Algérie, Code du timbre art. 100,
 * barème LF 2025) — miroir exact de sos-agent/src/common/timbre.ts, qui fait foi :
 * aperçu en direct dans l'éditeur, le montant enregistré est calculé par l'agent.
 *   ≤ 300 DA : 0 · ≤ 30 000 : 1 DA / 100 DA ou fraction · ≤ 100 000 : 1,5 DA ·
 *   au-delà : 2 DA · minimum 5 DA, sans plafond.
 */
export function calculerTimbre(montant: number): number {
  const m = Number(montant) || 0;
  if (m <= 300) return 0;
  const tranches = Math.ceil(m / 100 - 1e-9);
  const parTranche = m <= 30_000 ? 1 : m <= 100_000 ? 1.5 : 2;
  return Math.max(5, Number((tranches * parTranche).toFixed(2)));
}

export function estEspeces(mode: unknown): boolean {
  return String(mode ?? 'Espece').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().startsWith('espece');
}

/** Types de pièces soumis au timbre quand ils sont réglés en espèces (quittances). */
export const TYPES_TIMBRE = ['FA', 'BCT'];
