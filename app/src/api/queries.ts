import { gql } from '@apollo/client';

// Toutes les queries proxy renvoient du JSON flat (formes : src/api/types.ts).

export const VENTES = gql`
  query Ventes($type_doc: String, $code_cli: String, $date_debut: String, $date_fin: String, $non_reglees: Boolean, $user_id: Int, $limit: Int, $offset: Int, $grille: JSON) {
    ventes(type_doc: $type_doc, code_cli: $code_cli, date_debut: $date_debut, date_fin: $date_fin, non_reglees: $non_reglees, user_id: $user_id, limit: $limit, offset: $offset, grille: $grille)
  }
`;

export const ACHATS = gql`
  query Achats($type_doc: String, $code_four: String, $date_debut: String, $date_fin: String, $non_reglees: Boolean, $user_id: Int, $limit: Int, $offset: Int, $grille: JSON) {
    achats(type_doc: $type_doc, code_four: $code_four, date_debut: $date_debut, date_fin: $date_fin, non_reglees: $non_reglees, user_id: $user_id, limit: $limit, offset: $offset, grille: $grille)
  }
`;

export const ARTICLES = gql`
  query Articles($search: String, $famille: String, $stock_alerte: Boolean, $marge_negative: Boolean, $limit: Int, $offset: Int, $grille: JSON) {
    articles(search: $search, famille: $famille, stock_alerte: $stock_alerte, marge_negative: $marge_negative, limit: $limit, offset: $offset, grille: $grille)
  }
`;

export const CLIENTS = gql`
  query Clients($search: String, $limit: Int, $offset: Int, $grille: JSON) {
    clients(search: $search, limit: $limit, offset: $offset, grille: $grille)
  }
`;

export const FOURNISSEURS = gql`
  query Fournisseurs($search: String, $limit: Int, $offset: Int, $grille: JSON) {
    fournisseurs(search: $search, limit: $limit, offset: $offset, grille: $grille)
  }
`;

export const DEBITEURS = gql`
  query Debiteurs($search: String, $limit: Int, $offset: Int, $grille: JSON) {
    debiteurs(search: $search, limit: $limit, offset: $offset, grille: $grille)
  }
`;

export const TRESORIE_COMPLETE = gql`
  query TresorieComplete($compte_id: Int, $date_debut: String, $date_fin: String, $limit: Int, $offset: Int, $grille: JSON, $groupe: Boolean) {
    tresorieComplete(compte_id: $compte_id, date_debut: $date_debut, date_fin: $date_fin, limit: $limit, offset: $offset, grille: $grille, groupe: $groupe)
  }
`;

export const SOLDES_COMPTES = gql`
  query SoldesComptes { soldesComptes }
`;

export const STAT_VENTES = gql`
  query StatVentes($date_debut: String, $date_fin: String, $groupement: String) {
    statVentes(date_debut: $date_debut, date_fin: $date_fin, groupement: $groupement)
  }
`;

export const STAT_VENTES_PAR_UTILISATEUR = gql`
  query StatVentesParUtilisateur($date_debut: String, $date_fin: String) {
    statVentesParUtilisateur(date_debut: $date_debut, date_fin: $date_fin)
  }
`;

export const STAT_VENTES_PAR_FAMILLE = gql`
  query StatVentesParFamille($date_debut: String, $date_fin: String) {
    statVentesParFamille(date_debut: $date_debut, date_fin: $date_fin)
  }
`;

export const REFERENTIELS = gql`
  query Referentiels {
    familles
    depots
    banques
    modesPayement
    tauxTVA
    unitesMesure
  }
`;

export const COORDONNEES_SOCIETE = gql`
  query CoordonneesSociete { coordonneesSociete }
`;

// ─── Détails ────────────────────────────────────────────────────────────────

export const VENTE = gql`
  query Vente($id: Int!) { vente(id: $id) }
`;

export const ACHAT = gql`
  query Achat($id: Int!) { achat(id: $id) }
`;

export const ETAT_CLIENT = gql`
  query EtatClient($code_cli: String!, $date_debut: String, $date_fin: String) {
    etatClient(code_cli: $code_cli, date_debut: $date_debut, date_fin: $date_fin)
  }
`;

export const ETAT_FOURNISSEUR = gql`
  query EtatFournisseur($code_four: String!, $date_debut: String, $date_fin: String) {
    etatFournisseur(code_four: $code_four, date_debut: $date_debut, date_fin: $date_fin)
  }
`;

export const FACTURES_NON_REGLEES = gql`
  query FacturesNonReglees($code_cli: String!, $type_doc: String) {
    facturesNonReglees(code_cli: $code_cli, type_doc: $type_doc)
  }
`;

// ─── CRUD tiers & articles ──────────────────────────────────────────────────

export const CREATE_CLIENT = gql`mutation CreateClient($input: JSON!) { createClient(input: $input) }`;
export const UPDATE_CLIENT = gql`mutation UpdateClient($id: Int!, $input: JSON!) { updateClient(id: $id, input: $input) }`;
export const DELETE_CLIENT = gql`mutation DeleteClient($id: Int!) { deleteClient(id: $id) }`;

export const CREATE_FOURNISSEUR = gql`mutation CreateFournisseur($input: JSON!) { createFournisseur(input: $input) }`;
export const UPDATE_FOURNISSEUR = gql`mutation UpdateFournisseur($id: Int!, $input: JSON!) { updateFournisseur(id: $id, input: $input) }`;
export const DELETE_FOURNISSEUR = gql`mutation DeleteFournisseur($id: Int!) { deleteFournisseur(id: $id) }`;

export const CREATE_ARTICLE = gql`mutation CreateArticle($input: JSON!) { createArticle(input: $input) }`;
export const UPDATE_ARTICLE = gql`mutation UpdateArticle($id: Int!, $input: JSON!) { updateArticle(id: $id, input: $input) }`;
export const DELETE_ARTICLE = gql`mutation DeleteArticle($id: Int!) { deleteArticle(id: $id) }`;

export const DELETE_VENTE = gql`
  mutation DeleteVente($id: Int!) { deleteVente(id: $id) }
`;

export const DELETE_ACHAT = gql`
  mutation DeleteAchat($id: Int!) { deleteAchat(id: $id) }
`;

export const ARTICLE = gql`
  query Article($id: Int!) { article(id: $id) }
`;

export const LOTS = gql`
  query Lots($article_id: Int!) { lots(article_id: $article_id) }
`;

export const TARIFS_ARTICLE = gql`
  query TarifsArticle($code_article: String!) { tarifsArticle(code_article: $code_article) }
`;

export const BARCODES_ARTICLE = gql`
  query BarcodesArticle($article_id: Int!) { barcodesArticle(article_id: $article_id) }
`;

// ─── Inventaires ────────────────────────────────────────────────────────────

export const INVENTAIRES = gql`
  query Inventaires($date_debut: String, $date_fin: String, $statut: String, $limit: Int, $offset: Int, $grille: JSON) {
    inventaires(date_debut: $date_debut, date_fin: $date_fin, statut: $statut, limit: $limit, offset: $offset, grille: $grille)
  }
`;
export const INVENTAIRE = gql`query Inventaire($id: Int!) { inventaire(id: $id) }`;
export const CREATE_INVENTAIRE = gql`mutation CreateInventaire($input: JSON!) { createInventaire(input: $input) }`;
export const UPDATE_LIGNE_INVENTAIRE = gql`
  mutation UpdateLigneInventaire($id: Int!, $qte_reale: Float!) {
    updateLigneInventaire(id: $id, qte_reale: $qte_reale)
  }
`;
export const CLOTURER_INVENTAIRE = gql`mutation CloturerInventaire($id: Int!) { cloturerInventaire(id: $id) }`;
export const DELETE_INVENTAIRE = gql`mutation DeleteInventaire($id: Int!) { deleteInventaire(id: $id) }`;

// ─── CRUD référentiels ──────────────────────────────────────────────────────

export const CREATE_FAMILLE = gql`mutation CreateFamille($input: JSON!) { createFamille(input: $input) }`;
export const UPDATE_FAMILLE = gql`mutation UpdateFamille($id: Int!, $input: JSON!) { updateFamille(id: $id, input: $input) }`;
export const DELETE_FAMILLE = gql`mutation DeleteFamille($id: Int!) { deleteFamille(id: $id) }`;

export const SOUS_FAMILLES = gql`query SousFamilles($famille: String) { sousFamilles(famille: $famille) }`;
export const CREATE_SOUS_FAMILLE = gql`mutation CreateSousFamille($input: JSON!) { createSousFamille(input: $input) }`;
export const DELETE_SOUS_FAMILLE = gql`mutation DeleteSousFamille($id: Int!) { deleteSousFamille(id: $id) }`;

export const CREATE_DEPOT = gql`mutation CreateDepot($input: JSON!) { createDepot(input: $input) }`;
export const UPDATE_DEPOT = gql`mutation UpdateDepot($id: Int!, $input: JSON!) { updateDepot(id: $id, input: $input) }`;
export const DELETE_DEPOT = gql`mutation DeleteDepot($id: Int!) { deleteDepot(id: $id) }`;

export const RAYONS = gql`query Rayons($depot: String) { rayons(depot: $depot) }`;
export const CREATE_RAYON = gql`mutation CreateRayon($input: JSON!) { createRayon(input: $input) }`;
export const DELETE_RAYON = gql`mutation DeleteRayon($id: Int!) { deleteRayon(id: $id) }`;

export const CREATE_UNITE = gql`mutation CreateUniteMesure($input: JSON!) { createUniteMesure(input: $input) }`;
export const DELETE_UNITE = gql`mutation DeleteUniteMesure($id: Int!) { deleteUniteMesure(id: $id) }`;

export const CREATE_TVA = gql`mutation CreateTauxTVA($input: JSON!) { createTauxTVA(input: $input) }`;
export const DELETE_TVA = gql`mutation DeleteTauxTVA($id: Int!) { deleteTauxTVA(id: $id) }`;

export const CREATE_BANQUE = gql`mutation CreateBanque($input: JSON!) { createBanque(input: $input) }`;
export const UPDATE_BANQUE = gql`mutation UpdateBanque($id: Int!, $input: JSON!) { updateBanque(id: $id, input: $input) }`;
export const DELETE_BANQUE = gql`mutation DeleteBanque($id: Int!) { deleteBanque(id: $id) }`;

export const CREATE_MODE_PAYEMENT = gql`mutation CreateModePayement($input: JSON!) { createModePayement(input: $input) }`;
export const DELETE_MODE_PAYEMENT = gql`mutation DeleteModePayement($id: Int!) { deleteModePayement(id: $id) }`;

export const COMMERCIAUX = gql`query Commerciaux($search: String) { commerciaux(search: $search) }`;
export const CREATE_COMMERCIAL = gql`mutation CreateCommercial($input: JSON!) { createCommercial(input: $input) }`;
export const UPDATE_COMMERCIAL = gql`mutation UpdateCommercial($id: Int!, $input: JSON!) { updateCommercial(id: $id, input: $input) }`;
export const DELETE_COMMERCIAL = gql`mutation DeleteCommercial($id: Int!) { deleteCommercial(id: $id) }`;

export const CENTRES_COUT = gql`query CentresCout { centresCout }`;
export const CREATE_CENTRE_COUT = gql`mutation CreateCentreCout($input: JSON!) { createCentreCout(input: $input) }`;
export const UPDATE_CENTRE_COUT = gql`mutation UpdateCentreCout($id: Int!, $input: JSON!) { updateCentreCout(id: $id, input: $input) }`;
export const DELETE_CENTRE_COUT = gql`mutation DeleteCentreCout($id: Int!) { deleteCentreCout(id: $id) }`;

// ─── Paramètres (écriture) ──────────────────────────────────────────────────

export const UPDATE_COORDONNEES = gql`mutation UpdateCoordonneesSociete($input: JSON!) { updateCoordonneesSociete(input: $input) }`;
export const NUMEROTATION_DOCS = gql`query NumerotationDocs { numerotationDocs }`;
export const SET_NUMEROTATION = gql`
  mutation SetNumerotation($type: String!, $valeur: Int!, $prefixe: String, $suffixe: String) {
    setNumerotation(type: $type, valeur: $valeur, prefixe: $prefixe, suffixe: $suffixe)
  }
`;

// ─── Journaux & états globaux ───────────────────────────────────────────────

export const JOURNAL_VENTES = gql`
  query JournalVentes($date_debut: String, $date_fin: String, $code_cli: String, $code_article: String, $limit: Int, $offset: Int, $grille: JSON) {
    journalVentes(date_debut: $date_debut, date_fin: $date_fin, code_cli: $code_cli, code_article: $code_article, limit: $limit, offset: $offset, grille: $grille)
  }
`;
export const JOURNAL_ACHATS = gql`
  query JournalAchats($date_debut: String, $date_fin: String, $code_four: String, $code_article: String, $limit: Int, $offset: Int, $grille: JSON) {
    journalAchats(date_debut: $date_debut, date_fin: $date_fin, code_four: $code_four, code_article: $code_article, limit: $limit, offset: $offset, grille: $grille)
  }
`;
export const ETAT_CLIENTS = gql`
  query EtatClients($search: String, $famille: String, $sans_zeros: Boolean, $limit: Int, $offset: Int, $grille: JSON) {
    etatClients(search: $search, famille: $famille, sans_zeros: $sans_zeros, limit: $limit, offset: $offset, grille: $grille)
  }
`;
export const ETAT_FOURNISSEURS = gql`
  query EtatFournisseurs($search: String, $famille: String, $sans_zeros: Boolean, $limit: Int, $offset: Int, $grille: JSON) {
    etatFournisseurs(search: $search, famille: $famille, sans_zeros: $sans_zeros, limit: $limit, offset: $offset, grille: $grille)
  }
`;

// ─── Charges (catalogue des types de charges) ───────────────────────────────

export const CHARGES = gql`query Charges($limit: Int, $offset: Int, $grille: JSON) { charges(limit: $limit, offset: $offset, grille: $grille) }`;
export const CREATE_CHARGE = gql`mutation CreateCharge($input: JSON!) { createCharge(input: $input) }`;
export const UPDATE_CHARGE = gql`mutation UpdateCharge($id: Int!, $input: JSON!) { updateCharge(id: $id, input: $input) }`;
export const DELETE_CHARGE = gql`mutation DeleteCharge($id: Int!) { deleteCharge(id: $id) }`;

// ── Statistiques étendues ────────────────────────────────────────────────────
export const STAT_VENTES_PAR_ARTICLE = gql`
  query StatVentesParArticle($date_debut: String, $date_fin: String, $famille: String, $code_cli: String) {
    statVentesParArticle(date_debut: $date_debut, date_fin: $date_fin, famille: $famille, code_cli: $code_cli)
  }
`;

export const STAT_VENTES_PAR_CLIENT = gql`
  query StatVentesParClient($date_debut: String, $date_fin: String, $famille: String) {
    statVentesParClient(date_debut: $date_debut, date_fin: $date_fin, famille: $famille)
  }
`;

export const BENEFICES = gql`
  query Benefices($date_debut: String, $date_fin: String, $groupement: String) {
    benefices(date_debut: $date_debut, date_fin: $date_fin, groupement: $groupement)
  }
`;

export const STAT_ACHATS = gql`
  query StatAchats($date_debut: String, $date_fin: String, $groupement: String) {
    statAchats(date_debut: $date_debut, date_fin: $date_fin, groupement: $groupement)
  }
`;

export const STAT_ACHATS_PAR_FOURNISSEUR = gql`
  query StatAchatsParFournisseur($date_debut: String, $date_fin: String) {
    statAchatsParFournisseur(date_debut: $date_debut, date_fin: $date_fin)
  }
`;

export const STAT_ACHATS_PAR_ARTICLE = gql`
  query StatAchatsParArticle($date_debut: String, $date_fin: String, $famille: String, $code_four: String) {
    statAchatsParArticle(date_debut: $date_debut, date_fin: $date_fin, famille: $famille, code_four: $code_four)
  }
`;

export const STAT_STOCK = gql`
  query StatStock($search: String, $famille: String, $limit: Int, $offset: Int, $grille: JSON) {
    statStock(search: $search, famille: $famille, limit: $limit, offset: $offset, grille: $grille)
  }
`;

export const SET_CREDIT_INITIAL_CLIENT = gql`
  mutation SetCreditInitialClient($code: String!, $montant: Float!, $date: String!) {
    setCreditInitialClient(code: $code, montant: $montant, date: $date)
  }
`;

// ─── Cycle de vie des pièces : modification, transformation, regroupement, retours ─

export const UPDATE_VENTE = gql`mutation UpdateVente($id: Int!, $input: JSON!) { updateVente(id: $id, input: $input) }`;
export const TRANSFORMER_VENTE = gql`mutation TransformerVente($id: Int!, $cible: String!, $date: String) { transformerVente(id: $id, cible: $cible, date: $date) }`;
export const GROUPER_BL = gql`mutation GrouperBL($input: JSON!) { grouperBL(input: $input) }`;
export const CREER_RETOUR_VENTE = gql`mutation CreerRetourVente($input: JSON!) { creerRetourVente(input: $input) }`;
export const UPDATE_ACHAT = gql`mutation UpdateAchat($id: Int!, $input: JSON!) { updateAchat(id: $id, input: $input) }`;
export const TRANSFORMER_ACHAT = gql`mutation TransformerAchat($id: Int!, $cible: String!, $date: String) { transformerAchat(id: $id, cible: $cible, date: $date) }`;
export const CREER_RETOUR_ACHAT = gql`mutation CreerRetourAchat($input: JSON!) { creerRetourAchat(input: $input) }`;

// ─── Règlements & avances ───────────────────────────────────────────────────

export const ADD_REGLEMENT_CLIENT = gql`mutation AddReglementClient($input: JSON!) { addReglementClient(input: $input) }`;
export const ADD_REGLEMENT_FOURNISSEUR = gql`mutation AddReglementFournisseur($input: JSON!) { addReglementFournisseur(input: $input) }`;
export const DELETE_REGLEMENT_CLIENT = gql`mutation DeleteReglementClient($id: Int!) { deleteReglementClient(id: $id) }`;
export const DELETE_REGLEMENT_FOURNISSEUR = gql`mutation DeleteReglementFournisseur($id: Int!) { deleteReglementFournisseur(id: $id) }`;
export const REGLER_CLIENT = gql`mutation ReglerClient($input: JSON!) { reglerClient(input: $input) }`;
export const REGLER_FOURNISSEUR = gql`mutation ReglerFournisseur($input: JSON!) { reglerFournisseur(input: $input) }`;
export const AVANCES_CLIENTS = gql`query AvancesClients($code_cli: String) { avancesClients(code_cli: $code_cli) }`;
export const AVANCES_FOURNISSEURS = gql`query AvancesFournisseurs($code_four: String) { avancesFournisseurs(code_four: $code_four) }`;
export const ADD_AVANCE_CLIENT = gql`mutation AddAvanceClient($input: JSON!) { addAvanceClient(input: $input) }`;
export const ADD_AVANCE_FOURNISSEUR = gql`mutation AddAvanceFournisseur($input: JSON!) { addAvanceFournisseur(input: $input) }`;
export const DELETE_AVANCE = gql`mutation DeleteAvance($id: Int!, $sens: String!) { deleteAvance(id: $id, sens: $sens) }`;

// ─── Trésorerie : arrêté de caisse, annulation ──────────────────────────────

export const ARRETE_CAISSE = gql`query ArreteCaisse($compte_id: Int, $compte: String, $date: String!) { arreteCaisse(compte_id: $compte_id, compte: $compte, date: $date) }`;
export const CLOTURER_CAISSE = gql`mutation CloturerCaisse($input: JSON!) { cloturerCaisse(input: $input) }`;
export const ANNULER_MOUVEMENT = gql`mutation AnnulerMouvement($cle: String!) { annulerMouvement(cle: $cle) }`;

// ─── Stock : bons d'entrée / sortie, transferts ─────────────────────────────

export const BONS_ENTREE = gql`
  query BonsEntree($date_debut: String, $date_fin: String, $depot: String, $search: String, $limit: Int, $offset: Int, $grille: JSON) {
    bonsEntree(date_debut: $date_debut, date_fin: $date_fin, depot: $depot, search: $search, limit: $limit, offset: $offset, grille: $grille)
  }
`;
export const BONS_SORTIE = gql`
  query BonsSortie($date_debut: String, $date_fin: String, $depot: String, $search: String, $limit: Int, $offset: Int, $grille: JSON) {
    bonsSortie(date_debut: $date_debut, date_fin: $date_fin, depot: $depot, search: $search, limit: $limit, offset: $offset, grille: $grille)
  }
`;
export const TRANSFERTS = gql`
  query Transferts($date_debut: String, $date_fin: String, $limit: Int, $offset: Int, $grille: JSON) {
    transferts(date_debut: $date_debut, date_fin: $date_fin, limit: $limit, offset: $offset, grille: $grille)
  }
`;
export const BON_STOCK = gql`query BonStock($sens: String!, $id: Int!) { bon(sens: $sens, id: $id) }`;
export const CREATE_BON_ENTREE = gql`mutation CreateBonEntree($input: JSON!) { createBonEntree(input: $input) }`;
export const CREATE_BON_SORTIE = gql`mutation CreateBonSortie($input: JSON!) { createBonSortie(input: $input) }`;
export const DELETE_BON_ENTREE = gql`mutation DeleteBonEntree($id: Int!) { deleteBonEntree(id: $id) }`;
export const DELETE_BON_SORTIE = gql`mutation DeleteBonSortie($id: Int!) { deleteBonSortie(id: $id) }`;
export const TRANSFERT_STOCK = gql`mutation TransfertStock($input: JSON!) { transfertStock(input: $input) }`;

// ─── Utilisateurs dossier & droits ──────────────────────────────────────────

export const DOSSIER_USERS = gql`query DossierUsersAdmin { dossierUsers }`;
export const DROITS_DOSSIER_USER = gql`query DroitsDossierUser($user_id: Int!) { droitsDossierUser(user_id: $user_id) }`;
export const CREATE_DOSSIER_USER = gql`mutation CreateDossierUser($input: JSON!) { createDossierUser(input: $input) }`;
export const UPDATE_DOSSIER_USER = gql`mutation UpdateDossierUser($id: Int!, $input: JSON!) { updateDossierUser(id: $id, input: $input) }`;
export const DELETE_DOSSIER_USER = gql`mutation DeleteDossierUser($id: Int!) { deleteDossierUser(id: $id) }`;

// ─── Recouvrement, État 104, péremption ─────────────────────────────────────

export const RECOUVREMENT = gql`
  query Recouvrement($nbrjour: Int, $search: String, $inactifs: Boolean, $limit: Int, $offset: Int, $grille: JSON) {
    recouvrement(nbrjour: $nbrjour, search: $search, inactifs: $inactifs, limit: $limit, offset: $offset, grille: $grille)
  }
`;
export const ETAT_104 = gql`
  query Etat104($annee: Int, $date_debut: String, $date_fin: String, $inclure_bl: Boolean) {
    etat104(annee: $annee, date_debut: $date_debut, date_fin: $date_fin, inclure_bl: $inclure_bl)
  }
`;
export const LOTS_EXPIRANT = gql`query LotsExpirant($jours: Int, $limit: Int) { lotsExpirant(jours: $jours, limit: $limit) }`;

// ─── Fiche de stock d'un article (kardex) ───────────────────────────────────
export const FICHE_STOCK = gql`
  query FicheStock($article_id: Int, $date_debut: String, $date_fin: String) {
    ficheStock(article_id: $article_id, date_debut: $date_debut, date_fin: $date_fin)
  }
`;
export const RECALCULER_STOCK_ARTICLE = gql`
  mutation RecalculerStockArticle($article_id: Int!) { recalculerStockArticle(article_id: $article_id) }
`;

// ─── Échéances clients (pièces dues à une date de règlement) ───────────────
export const ECHEANCES = gql`
  query Echeances($statut: String, $code_cli: String, $search: String, $limit: Int, $offset: Int) {
    echeances(statut: $statut, code_cli: $code_cli, search: $search, limit: $limit, offset: $offset)
  }
`;

export const MARQUER_ECHEANCE_PAYEE = gql`
  mutation MarquerEcheancePayee($input: JSON!) {
    marquerEcheancePayee(input: $input)
  }
`;
