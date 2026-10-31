import { HashRouter, Routes, Route } from 'react-router-dom';
import { useSession } from './store/session';
import Login from './screens/Login';
import AppShell from './components/AppShell';
import Dashboard from './screens/Dashboard';
import Ventes from './screens/Ventes';
import VenteDetail from './screens/VenteDetail';
import VenteEditor from './screens/VenteEditor';
import Comptoir from './screens/comptoir/Comptoir';
import Achats from './screens/Achats';
import AchatDetail from './screens/AchatDetail';
import AchatEditor from './screens/AchatEditor';
import Stock from './screens/Stock';
import ArticleDetail from './screens/ArticleDetail';
import Inventaires from './screens/Inventaires';
import InventaireDetail from './screens/InventaireDetail';
import Tiers from './screens/Tiers';
import Echeances from './screens/Echeances';
import ClientDetail from './screens/ClientDetail';
import FournisseurDetail from './screens/FournisseurDetail';
import Tresorerie from './screens/Tresorerie';
import Statistiques from './screens/Statistiques';
import Referentiels from './screens/Referentiels';
import Parametres from './screens/Parametres';
import { ModelesPage } from '@softly/report';
import Diagnostic from './screens/Diagnostic';
import NotFound from './screens/NotFound';
import DemoGrille from './screens/DemoGrille';
import DemoUI from './screens/DemoUI';
import MouvementsStock from './screens/MouvementsStock';
import Utilisateurs from './screens/Utilisateurs';
import RequireDroit from './components/RequireDroit';
import { LIBELLES_REFERENTIELS } from './components/AppShell';
import { D, useDroits } from './lib/droits';

/** Élément de route protégé par un droit (prédicat évalué sur les droits de session). */
function G({ si, children }: { si: (d: ReturnType<typeof useDroits>) => boolean; children: React.ReactNode }) {
  const d = useDroits();
  return <RequireDroit si={si(d)}>{children}</RequireDroit>;
}
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const { hydrated, token, dossier, dossierUser } = useSession();

  if (!hydrated) return null;
  // Session complète = token cloud + dossier choisi + utilisateur dossier (requis pour créer des pièces)
  if (!token || !dossier || !dossierUser) return <ErrorBoundary><Login /></ErrorBoundary>;

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="ventes" element={<G si={(d) => d.aModule('vente')}><Ventes /></G>} />
          <Route path="ventes/nouvelle" element={<G si={(d) => d.aModule('vente')}><VenteEditor /></G>} />
          <Route path="comptoir" element={<G si={(d) => d.peutDoc('vente', 'BCT', 'creer') || d.peutDoc('vente', 'BRT', 'creer')}><Comptoir /></G>} />
          <Route path="ventes/:id" element={<G si={(d) => d.aModule('vente')}><VenteDetail /></G>} />
          <Route path="achats" element={<G si={(d) => d.aModule('achat')}><Achats /></G>} />
          <Route path="achats/nouvelle" element={<G si={(d) => d.aModule('achat')}><AchatEditor /></G>} />
          <Route path="achats/:id" element={<G si={(d) => d.aModule('achat')}><AchatDetail /></G>} />
          <Route path="stock" element={<G si={(d) => d.peut('stock', D.stock.article)}><Stock /></G>} />
          <Route path="stock/article/:id" element={<G si={(d) => d.peut('stock', D.stock.article)}><ArticleDetail /></G>} />
          <Route path="stock/inventaires" element={<G si={(d) => d.peut('stock', D.stock.inventaire)}><Inventaires /></G>} />
          <Route path="stock/mouvements" element={<G si={(d) => d.peutUn('stock', [D.stock.bonEntree, D.stock.bonSortie])}><MouvementsStock /></G>} />
          <Route path="stock/inventaires/:id" element={<G si={(d) => d.peut('stock', D.stock.inventaire)}><InventaireDetail /></G>} />
          <Route path="echeances" element={<G si={(d) => d.aModule('vente')}><Echeances /></G>} />
          <Route path="tiers" element={<G si={(d) => d.peutUn('tiers', [D.tiers.clients, D.tiers.fournisseurs])}><Tiers /></G>} />
          <Route path="tiers/client/:code" element={<G si={(d) => d.peut('tiers', D.tiers.clients)}><ClientDetail /></G>} />
          <Route path="tiers/fournisseur/:code" element={<G si={(d) => d.peut('tiers', D.tiers.fournisseurs)}><FournisseurDetail /></G>} />
          <Route path="tresorerie" element={<G si={(d) => d.peut('autre', D.autre.tresorerie)}><Tresorerie /></G>} />
          <Route path="statistiques" element={<G si={(d) => d.peut('autre', D.autre.statistiques)}><Statistiques /></G>} />
          <Route path="referentiels" element={<G si={(d) => d.peutUn('tiers', LIBELLES_REFERENTIELS)}><Referentiels /></G>} />
          <Route path="modeles" element={<G si={(d) => d.peut('autre', D.autre.parametres)}><ModelesPage /></G>} />
          <Route path="parametres" element={<G si={(d) => d.peut('autre', D.autre.parametres)}><Parametres /></G>} />
          <Route path="parametres/utilisateurs" element={<G si={(d) => d.peut('autre', D.autre.droitsAcces)}><Utilisateurs /></G>} />
          <Route path="diagnostic" element={<Diagnostic />} />
          <Route path="outils/ui" element={<DemoUI />} />
          <Route path="outils/grille" element={<G si={(d) => d.peut('stock', D.stock.article)}><DemoGrille /></G>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
