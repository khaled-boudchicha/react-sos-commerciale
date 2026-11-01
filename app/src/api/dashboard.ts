import { gql } from '@apollo/client';

// Retours JSON flat du proxy cloud (schéma typé côté agent : sos-agent/src/modules/*/*.schema.gql)
export const DASHBOARD = gql`
  query Dashboard($debutMois: String, $aujourdhui: String) {
    statVentes(date_debut: $debutMois, date_fin: $aujourdhui, groupement: "jour")
    statVentesParFamille(date_debut: $debutMois, date_fin: $aujourdhui)
    soldesComptes
    debiteurs(limit: 1, offset: 0)
    alertesStock
  }
`;
