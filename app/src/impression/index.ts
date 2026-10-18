import { chargerModele, configurerReport, enregistrerFonction, listerModeles, modeleParDefaut, rendreEtat, versDocumentImprimable, type StockageModeles } from '@softly/report';
import type { PrintDocument } from '../print/engine/types';
import type { DemandeImpression } from './demandes';
import { arreteLaSomme } from '../lib/enLettres';
import { imprimerSilencieux, supporteImpressionDirecte } from '../print/engine/silentPrint';
import { declarerTypesMetier } from './types';
import { declarerModelesIntegres } from './modelesIntegres';

/**
 * Branchement de l'application Gestion Commerciale sur le paquet générique `@softly/report` :
 * types de documents (Vente, Achat, Articles, Relevé client), modèles livrés, fonction `ARRETE`,
 * stockage des modèles (fichiers .gcr via Electron, sinon localStorage), PDF et impression directe.
 * À appeler une fois au démarrage, avant le premier rendu.
 */
export function initialiserImpression(): void {
  declarerTypesMetier();
  declarerModelesIntegres();
  enregistrerFonction('ARRETE', (a) => arreteLaSomme(Number(a[0]) || 0), {
    categorie: 'Métier', signature: 'ARRETE(Vente.net_a_payer)', description: 'Phrase « Arrêtée la présente facture à la somme de… »',
  });

  const m = typeof window !== 'undefined' ? window.gc?.modeles : undefined;
  const stockage: StockageModeles | undefined = m ? {
    liste: () => m.liste(), lire: (f) => m.lire(f), ecrire: (f, c) => m.ecrire(f, c), supprimer: (f) => m.supprimer(f),
    importer: () => m.importer(), exporter: (n, c) => m.exporter(n, c), ouvrirDossier: () => m.ouvrirDossier(), dossier: () => m.dossier(),
  } : undefined;

  configurerReport({
    // clés localStorage historiques : les modèles déjà enregistrés en mode navigateur restent lisibles
    espaceNoms: 'gc.modeles',
    stockage,
    impression: {
      exporterPdf: m?.pdf ? (html, l, h, nom) => m.pdf(html, l, h, nom) : undefined,
      imprimerDirect: (doc) => imprimerSilencieux(doc),
      impressionDirecteDisponible: supporteImpressionDirecte,
    },
  });
}

export { donneesVente, donneesAchat, donneesArticles } from './types';

/**
 * Rend une demande d'impression en document imprimable `{ title, html, css }` (impression directe sans aperçu,
 * ex. ticket de caisse envoyé à l'imprimante thermique). Même choix de modèle que `ImprimerDocument`.
 */
export async function documentDeDemande(d: DemandeImpression): Promise<PrintDocument> {
  const liste = await listerModeles(d.kind);
  const refs = new Set(liste.map((m) => m.ref));
  const impose = d.modele ? (d.modele.includes(':') ? d.modele : `integre:${d.modele}`) : null;
  const defaut = modeleParDefaut(d.kind);
  const ref = impose && refs.has(impose) ? impose : defaut && refs.has(defaut) ? defaut : liste[0]?.ref;
  if (!ref) throw new Error(`Aucun modèle d'impression pour « ${d.kind} ».`);
  const def = await chargerModele(ref);
  return versDocumentImprimable(rendreEtat(def, d.data), d.titre);
}

export type { DemandeImpression } from './demandes';
