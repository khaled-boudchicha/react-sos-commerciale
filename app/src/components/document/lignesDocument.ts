import { useCallback, useEffect, useState } from 'react';
import { Article } from '../../api/types';

/**
 * Modèle de ligne partagé entre l'éditeur de vente et d'achat.
 *
 * Champs *canoniques* (stockés) : qte, prix_ht, remise (%), tva, + optionnels
 * (lot, péremption, colis, tarif). Les valeurs *dérivées* (prix TTC, remise en
 * montant, total HT/TTC) ne sont jamais stockées : on les calcule à l'affichage
 * et, si l'utilisateur édite une cellule dérivée, on recalcule le champ canonique
 * correspondant. Aucune dérive possible entre les deux.
 */
export type LigneDoc = {
  key: number;
  id_article?: number;
  code_article: string;
  designation: string;
  qte: number;
  prix_ht: number;
  tva: number;
  remise: number;            // pourcentage
  colis?: number;
  n_lot?: string;
  date_peremption?: string;
  /** Niveau de tarif appliqué (1..4) — vente uniquement. */
  tarif?: number;
  /** Prix HT des 4 tiers de l'article, figés à l'ajout (pour le sélecteur de tarif). */
  prixTiers?: number[];
};

export type Sens = 'vente' | 'achat';

let compteurLigne = 1;
export function nouvelleCle(): number {
  return compteurLigne++;
}

/** Les 4 prix HT d'un article, dans l'ordre des tiers 1..4. */
export function prixTiersArticle(a: Article): number[] {
  return [
    Number(a.prix_vente_ht ?? 0),
    Number(a.prix_vente_ht1 ?? 0),
    Number(a.prix_vente_ht2 ?? 0),
    Number(a.prix_vente_ht3 ?? 0),
  ];
}

/** Crée une ligne à partir d'un article, prix par défaut selon le sens. */
export function ligneDepuisArticle(a: Article, sens: Sens): LigneDoc {
  const tiers = prixTiersArticle(a);
  const prix_ht = sens === 'achat'
    ? Number(a.pmp ?? a.prix_achat_ht ?? 0)   // achat : coût (PMP)
    : (tiers[0] || Number(a.prix_vente_ht ?? 0)); // vente : tarif 1
  return {
    key: nouvelleCle(),
    id_article: a.id,
    code_article: a.code,
    designation: a.designation,
    qte: 1,
    prix_ht,
    tva: Number(a.tva ?? 0),
    remise: 0,
    n_lot: '',
    date_peremption: '',
    tarif: sens === 'vente' ? 1 : undefined,
    prixTiers: tiers,
  };
}

/* ─── Calculs de ligne (source unique de vérité) ───────────────────────────── */

export const netHtLigne = (l: LigneDoc) => l.qte * l.prix_ht * (1 - (l.remise || 0) / 100);
export const totalTtcLigne = (l: LigneDoc) => netHtLigne(l) * (1 + (l.tva || 0) / 100);
export const prixTtcUnitaire = (l: LigneDoc) => l.prix_ht * (1 + (l.tva || 0) / 100);
export const remiseMontantLigne = (l: LigneDoc) => l.qte * l.prix_ht * ((l.remise || 0) / 100);

/** Édition d'un prix TTC unitaire → recalcule le prix HT canonique. */
export function depuisPrixTtc(l: LigneDoc, prixTtc: number): Partial<LigneDoc> {
  return { prix_ht: prixTtc / (1 + (l.tva || 0) / 100) };
}

/** Édition d'une remise en montant → recalcule le pourcentage canonique. */
export function depuisRemiseMontant(l: LigneDoc, montant: number): Partial<LigneDoc> {
  const base = l.qte * l.prix_ht;
  return { remise: base > 0 ? Math.min(100, (montant / base) * 100) : 0 };
}

/** Totaux de la pièce (mêmes formules que l'agent createVente/createAchat). */
export function totauxDocument(lignes: LigneDoc[], remiseGlobalePct: number) {
  let ht = 0, ttc = 0, remLignes = 0;
  for (const l of lignes) {
    const brut = l.qte * l.prix_ht;
    const net = brut * (1 - (l.remise || 0) / 100);
    remLignes += brut - net;
    ht += net;
    ttc += net * (1 + (l.tva || 0) / 100);
  }
  const remGlob = ttc * ((remiseGlobalePct || 0) / 100);
  return { ht, remLignes, tva: ttc - ht, remGlob, net: ttc - remGlob };
}

/* ─── Catalogue des colonnes configurables ─────────────────────────────────── */

export type ColonneId =
  | 'tarif' | 'colis' | 'prix_ttc' | 'remise_montant' | 'lot' | 'peremption' | 'total_ht';

export type ColonneMeta = {
  id: ColonneId;
  label: string;
  /** Sens auquel la colonne s'applique (absent = les deux). */
  sens?: Sens;
  /** Visible par défaut, par sens. */
  defautVente: boolean;
  defautAchat: boolean;
};

/** Colonnes optionnelles activables/désactivables par l'utilisateur. */
export const COLONNES: ColonneMeta[] = [
  { id: 'tarif',          label: 'Tarif (1–4)',       sens: 'vente', defautVente: false, defautAchat: false },
  { id: 'colis',          label: 'Colisage',                         defautVente: false, defautAchat: false },
  { id: 'prix_ttc',       label: 'P.U. TTC',                         defautVente: false, defautAchat: false },
  { id: 'remise_montant', label: 'Remise (montant)',                 defautVente: false, defautAchat: false },
  { id: 'lot',            label: 'N° de lot',                        defautVente: false, defautAchat: true },
  { id: 'peremption',     label: 'Péremption',                       defautVente: false, defautAchat: true },
  { id: 'total_ht',       label: 'Total HT',                         defautVente: false, defautAchat: false },
];

/** Colonnes applicables à un sens donné. */
export function colonnesPour(sens: Sens): ColonneMeta[] {
  return COLONNES.filter((c) => !c.sens || c.sens === sens);
}

function defautVisibles(sens: Sens): ColonneId[] {
  return colonnesPour(sens)
    .filter((c) => (sens === 'vente' ? c.defautVente : c.defautAchat))
    .map((c) => c.id);
}

/**
 * Config « colonnes visibles » persistée par sens dans localStorage — chaque
 * caissier garde sa disposition. Tolérant aux erreurs de stockage (fenêtre
 * privée, quota) : on retombe sur les défauts sans planter.
 */
export function useColonnesConfig(sens: Sens) {
  const cle = `gc.lignes.colonnes.${sens}`;
  const [visibles, setVisibles] = useState<Set<ColonneId>>(() => {
    try {
      const brut = localStorage.getItem(cle);
      if (brut) {
        const ids = JSON.parse(brut) as ColonneId[];
        const connues = new Set(colonnesPour(sens).map((c) => c.id));
        return new Set(ids.filter((id) => connues.has(id)));
      }
    } catch { /* stockage indisponible → défauts */ }
    return new Set(defautVisibles(sens));
  });

  useEffect(() => {
    try { localStorage.setItem(cle, JSON.stringify([...visibles])); } catch { /* ignore */ }
  }, [cle, visibles]);

  const basculer = useCallback((id: ColonneId) => {
    setVisibles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const reinitialiser = useCallback(() => setVisibles(new Set(defautVisibles(sens))), [sens]);

  return { visibles, basculer, reinitialiser };
}
