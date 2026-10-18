import { configurerReport, enregistrerFonction, type StockageModeles } from '@softly/report';
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
