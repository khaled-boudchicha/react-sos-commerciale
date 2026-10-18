import type { ReportData } from '@softly/report';
import type { Societe } from '../print/templates/partials';
import type { TicketExtras } from './types';
import type { Vente } from '../api/types';
import {
  donneesVente, donneesAchat, donneesArreteCaisse, donneesArticles, donneesBonStock, donneesBordereau, donneesCreances, donneesEtat104, donneesEtatClient,
  donneesEtatFournisseur, donneesImpayes, donneesInventaire, donneesJournal, donneesRecouvrement, donneesRecuTransfert, donneesTicketVentes, donneesTresorerie,
} from './types';

/**
 * Une demande d'impression = type de document + données + titre (+ modèle imposé quand un même type a des variantes :
 * journal des ventes / des achats, état chiffré / feuille de comptage). Elle remplace les anciens `build*Print` :
 * mêmes arguments, mais le rendu est confié au moteur d'états (modèle choisi par l'utilisateur, designer, PDF…).
 */
export type DemandeImpression = { kind: string; data: ReportData; titre: string; modele?: string };

type S = Societe | null | undefined;
type Args<F> = F extends (a: infer A, s?: S) => ReportData ? A : never;

/** Clé du modèle de ticket de caisse (poste) : `integre:<id>` ou `fichier:<nom>` ; défaut : ticket 80 mm livré. */
export const CLE_MODELE_TICKET = 'gc.impression.ticket';
export const modeleTicket = (): string => {
  try { return localStorage.getItem(CLE_MODELE_TICKET) || 'integre:integre-ticket-80'; } catch { return 'integre:integre-ticket-80'; }
};

/** Ticket de caisse d'une pièce de vente (comptoir, BCT, retour) ; `extras` = espèces reçues / rendu / caissier. */
export const demandeTicket = (vente: Vente, societe: S, extras: TicketExtras = {}): DemandeImpression => ({
  kind: 'vente', data: donneesVente(vente, societe, extras), titre: `Ticket ${vente.numero}`, modele: modeleTicket(),
});

export const demandeAchat = (achat: Parameters<typeof donneesAchat>[0], societe: S): DemandeImpression => ({ kind: 'achat', data: donneesAchat(achat, societe), titre: `${achat.type_doc} ${achat.numero}` });

export const demandeEtatClient = (a: Args<typeof donneesEtatClient>, societe: S): DemandeImpression => ({ kind: 'etatClient', data: donneesEtatClient(a, societe), titre: `Relevé ${a.client.nom_client || a.client.code_cli}` });

export const demandeEtatFournisseur = (a: Args<typeof donneesEtatFournisseur>, societe: S): DemandeImpression => ({ kind: 'etatFournisseur', data: donneesEtatFournisseur(a, societe), titre: `Relevé ${a.fournisseur.nom || a.fournisseur.code_four}` });

export const demandeImpayes = (a: Args<typeof donneesImpayes>, societe: S): DemandeImpression => ({ kind: 'impayes', data: donneesImpayes(a, societe), titre: `Impayés ${a.nom || a.codeCli}` });

export const demandeCreances = (a: Args<typeof donneesCreances>, societe: S): DemandeImpression => ({ kind: 'creances', data: donneesCreances(a, societe), titre: 'État des créances' });

export const demandeRecouvrement = (a: Args<typeof donneesRecouvrement>, societe: S): DemandeImpression => ({ kind: 'recouvrement', data: donneesRecouvrement(a, societe), titre: 'État de recouvrement' });

export const demandeTresorerie = (a: Args<typeof donneesTresorerie>, societe: S): DemandeImpression => ({ kind: 'tresorerie', data: donneesTresorerie(a, societe), titre: `Trésorerie ${a.compte}` });

export const demandeArreteCaisse = (a: Args<typeof donneesArreteCaisse>, societe: S): DemandeImpression => ({
  kind: 'arreteCaisse', data: donneesArreteCaisse(a, societe), titre: `Arrêté de caisse ${a.arrete.compte ?? ''} ${a.arrete.date}`.replace(/\s+/g, ' ').trim(),
});

export const demandeStock = (a: { articles: Parameters<typeof donneesArticles>[0]; filtre?: string }, societe: S): DemandeImpression => ({
  kind: 'articles', data: donneesArticles(a.articles, societe, a.filtre), titre: 'État du stock', modele: 'integre-etat-stock',
});

export const demandeBonStock = (a: Args<typeof donneesBonStock>, societe: S): DemandeImpression => ({
  kind: 'bonStock', data: donneesBonStock(a, societe), titre: `${a.sens === 'entree' ? 'Bon d’entrée' : 'Bon de sortie'} ${a.bon.numero || a.bon.id}`,
});

export const demandeBordereau = (a: Args<typeof donneesBordereau>, societe: S): DemandeImpression => ({ kind: 'bordereau', data: donneesBordereau(a, societe), titre: a.titre });

export const demandeJournal = (a: Args<typeof donneesJournal>, societe: S): DemandeImpression => ({
  kind: 'journal', data: donneesJournal(a, societe), titre: a.sens === 'vente' ? 'Journal des ventes' : 'Journal des achats',
  modele: a.sens === 'vente' ? 'integre-journal-ventes' : 'integre-journal-achats',
});

export const demandeInventaire = (a: Args<typeof donneesInventaire>, societe: S): DemandeImpression => ({
  kind: 'inventaire', data: donneesInventaire(a, societe), titre: a.vierge ? 'Feuille de comptage' : 'Inventaire — état',
  modele: a.vierge ? 'integre-inventaire-comptage' : 'integre-inventaire-etat',
});

export const demandeEtat104 = (a: Args<typeof donneesEtat104>, societe: S): DemandeImpression => ({ kind: 'etat104', data: donneesEtat104(a, societe), titre: `État 104 ${a.debut.slice(0, 4)}` });

/** Ces deux tickets recevaient la société DANS l'objet d'arguments. */
export const demandeTicketVentes = (a: Args<typeof donneesTicketVentes> & { societe: S }): DemandeImpression => ({
  kind: 'ticketVentes', data: donneesTicketVentes(a, a.societe), titre: a.titre,
});

export const demandeRecuTransfert = (a: Args<typeof donneesRecuTransfert> & { societe: S }): DemandeImpression => ({
  kind: 'recuTransfert', data: donneesRecuTransfert(a, a.societe), titre: 'Reçu de transfert',
});
