import { gql } from '@apollo/client';

// Retours JSON flat du proxy cloud (schéma typé côté agent : sos-agent/src/modules/*/*.schema.gql)
export const DASHBOARD = gql`
  query Dashboard($debutMois: String, $aujourdhui: String) {
    statVentes(date_debut: $debutMois, date_fin: $aujourdhui, groupement: "jour")
    soldesCaisse
    debiteurs(limit: 1, offset: 0)
    alertesStock
  }
`;

export const STAT_VENTES_PAR_FAMILLE = gql`
  query StatVentesParFamille($date_debut: String, $date_fin: String) {
    statVentesParFamille(date_debut: $date_debut, date_fin: $date_fin)
  }
`;
