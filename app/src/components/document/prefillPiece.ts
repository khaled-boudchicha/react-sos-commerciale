import { LigneDoc, nouvelleCle } from './lignesDocument';
import { isoDate } from '../../lib/format';

/**
 * Pré-remplissage d'un éditeur depuis une pièce existante (duplication `?from=`
 * ou modification `?edit=`). Même forme de lignes en vente et en achat : on ne
 * reprend que les champs canoniques, les totaux étant recalculés à l'écran.
 */
export function lignesDepuisPiece(src: { lignes?: unknown }): LigneDoc[] {
  const lignes: any[] = Array.isArray(src.lignes) ? src.lignes : [];
  return lignes.map((l) => ({
    key: nouvelleCle(),
    id_article: l.id_article ?? undefined,
    code_article: String(l.code_article ?? ''),
    designation: String(l.designation ?? ''),
    qte: Number(l.qte) || 0,
    prix_ht: Number(l.prix_ht) || 0,
    tva: Number(l.tva) || 0,
    remise: Number(l.remise) || 0,        // % de ligne
    colis: l.colis != null && Number(l.colis) > 0 ? Number(l.colis) : undefined,
    n_lot: l.n_lot || '',
    date_peremption: isoDate(l.date_peremption),
  }));
}

/** Lignes au format attendu par createX / updateX (agent). */
export function lignesPourServeur(lignes: LigneDoc[]) {
  return lignes.map((l) => ({
    id_article: l.id_article,
    code_article: l.code_article,
    designation: l.designation,
    qte: l.qte,
    prix_ht: l.prix_ht,
    tva: l.tva,
    remise: l.remise || 0,
    n_lot: l.n_lot || undefined,
    date_peremption: l.date_peremption || undefined,
    colis: l.colis || undefined,
  }));
}

/** Bandeau d'erreur / d'accès refusé commun aux éditeurs. */
export const bandeauDanger = {
  background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
  color: 'var(--danger-text)',
} as const;
