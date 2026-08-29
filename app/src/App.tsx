import { HashRouter, Routes, Route } from 'react-router-dom';
import { useSession } from './store/session';
import Login from './screens/Login';
import AppShell from './components/AppShell';
import Dashboard from './screens/Dashboard';
import Ventes from './screens/Ventes';
import VenteDetail from './screens/VenteDetail';
import VenteEditor from './screens/VenteEditor';
import Achats from './screens/Achats';
import AchatDetail from './screens/AchatDetail';
import AchatEditor from './screens/AchatEditor';
import Stock from './screens/Stock';
import ArticleDetail from './screens/ArticleDetail';
import Inventaires from './screens/Inventaires';
import InventaireDetail from './screens/InventaireDetail';
import Tiers from './screens/Tiers';
import ClientDetail from './screens/ClientDetail';
import FournisseurDetail from './screens/FournisseurDetail';
import Tresorerie from './screens/Tresorerie';
import Statistiques from './screens/Statistiques';
import Referentiels from './screens/Referentiels';
import Parametres from './screens/Parametres';
import Diagnostic from './screens/Diagnostic';

export default function App() {
  const { hydrated, token, dossier, dossierUser } = useSession();

  if (!hydrated) return null;
  // Session complète = token cloud + dossier choisi + utilisateur dossier (requis pour créer des pièces)
  if (!token || !dossier || !dossierUser) return <Login />;

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="ventes" element={<Ventes />} />
          <Route path="ventes/nouvelle" element={<VenteEditor />} />
          <Route path="ventes/:id" element={<VenteDetail />} />
          <Route path="achats" element={<Achats />} />
          <Route path="achats/nouvelle" element={<AchatEditor />} />
          <Route path="achats/:id" element={<AchatDetail />} />
          <Route path="stock" element={<Stock />} />
          <Route path="stock/article/:id" element={<ArticleDetail />} />
          <Route path="stock/inventaires" element={<Inventaires />} />
          <Route path="stock/inventaires/:id" element={<InventaireDetail />} />
          <Route path="tiers" element={<Tiers />} />
          <Route path="tiers/client/:code" element={<ClientDetail />} />
          <Route path="tiers/fournisseur/:code" element={<FournisseurDetail />} />
          <Route path="tresorerie" element={<Tresorerie />} />
          <Route path="statistiques" element={<Statistiques />} />
          <Route path="referentiels" element={<Referentiels />} />
          <Route path="parametres" element={<Parametres />} />
          <Route path="diagnostic" element={<Diagnostic />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
