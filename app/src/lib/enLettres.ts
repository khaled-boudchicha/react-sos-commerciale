/**
 * Montant en toutes lettres — portage fidèle de `Tdata.EnLettres` / `Tdata.ArreteLaSomme`
 * (DataModule.pas du desktop Delphi), pour que « Arrêter la somme de la présente facture »
 * imprime exactement la même phrase dans les deux applications.
 *
 * Particularités conservées du desktop : mots capitalisés, espaces (pas de tirets sauf
 * « Quatre-Vingt »), « et » seulement pour 21…71, « Cents » / « Quatre-Vingts » au pluriel
 * uniquement en fin de nombre, « Mille » invariable, « Millions » / « Milliards » au pluriel.
 * Seule différence : l'espace de tête du Delphi est retiré.
 */
import { enLettres } from '@softly/report/core';

/** Entier en lettres (Tdata.EnLettres) : implémentation dans le paquet @softly/report. */
export { enLettres };

/** Phrase d'arrêté d'un montant en DA (Tdata.ArreteLaSomme) : « … Dinars Algerien et … Centimes ». */
export function arreteLaSomme(montant: number): string {
  const centimesTotal = Math.round(Math.abs(Number(montant) || 0) * 100);
  const dinars = Math.floor(centimesTotal / 100) * (montant < 0 ? -1 : 1);
  const centimes = centimesTotal % 100;
  return `${enLettres(dinars)} Dinars Algerien et ${enLettres(centimes)} Centimes`;
}
