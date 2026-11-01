import { lazy, Suspense } from 'react';
import { Outlet, Route, RouterProvider, createHashRouter, createRoutesFromElements } from 'react-router-dom';
import { Skeleton } from './components/ui/States';
import { useSession } from './store/session';
import Login from './screens/Login';
import AppShell from './components/AppShell';
import Dashboard from './screens/Dashboard';
import Ventes from './screens/Ventes';
const VenteDetail = lazy(() => import('./screens/VenteDetail'));
import VenteEditor from './screens/VenteEditor';
import Comptoir from './screens/comptoir/Comptoir';
import Achats from './screens/Achats';
const AchatDetail = lazy(() => import('./screens/AchatDetail'));
import AchatEditor from './screens/AchatEditor';
import Stock from './screens/Stock';
const ArticleDetail = lazy(() => import('./screens/ArticleDetail'));
const Inventaires = lazy(() => import('./screens/Inventaires'));
const InventaireDetail = lazy(() => import('./screens/InventaireDetail'));
import Tiers from './screens/Tiers';
const Echeances = lazy(() => import('./screens/Echeances'));
const ClientDetail = lazy(() => import('./screens/ClientDetail'));
const FournisseurDetail = lazy(() => import('./screens/FournisseurDetail'));
const Tresorerie = lazy(() => import('./screens/Tresorerie'));
const Statistiques = lazy(() => import('./screens/Statistiques'));
const Referentiels = lazy(() => import('./screens/Referentiels'));
import Parametres from './screens/Parametres';
const ModelesPage = lazy(() => import('@softly/report').then((m) => ({ default: m.ModelesPage })));
const Diagnostic = lazy(() => import('./screens/Diagnostic'));
import NotFound from './screens/NotFound';
const DemoGrille = lazy(() => import('./screens/DemoGrille'));
const DemoUI = lazy(() => import('./screens/DemoUI'));
const MouvementsStock = lazy(() => import('./screens/MouvementsStock'));
const Utilisateurs = lazy(() => import('./screens/Utilisateurs'));
import RequireDroit from './components/RequireDroit';
import { LIBELLES_REFERENTIELS } from './components/AppShell';
import { D, useDroits } from './lib/droits';

/** Élément de route protégé par un droit (prédicat évalué sur les droits de session). */
function G({ si, children }: { si: (d: ReturnType<typeof useDroits>) => boolean; children: React.ReactNode }) {
  const d = useDroits();
  return <RequireDroit si={si(d)}><Differe>{children}</Differe></RequireDroit>;
}

/**
 * Écrans secondaires chargés à la demande (code découpé) : le démarrage ne charge que la coquille,
 * le tableau de bord, les ventes, les achats, le stock, les tiers et la caisse.
 */
function Differe({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="p-2" aria-busy="true"><Skeleton lines={6} /></div>}>{children}</Suspense>;
}
import ErrorBoundary from './components/ErrorBoundary';
import RaccourcisGlobaux from './components/RaccourcisGlobaux';

/**
 * Routeur « data » (createHashRouter) : mêmes routes qu'avec HashRouter, mais il permet useBlocker
 * (garde « modifications non enregistrées » des éditeurs de pièces). Créé une seule fois.
 */
function Racine() {
  return (
    <>
      <RaccourcisGlobaux />
      <Outlet />
    </>
  );
}

const router = createHashRouter(createRoutesFromElements(
  <Route element={<Racine />}>
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
      <Route path="diagnostic" element={<Differe><Diagnostic /></Differe>} />
      <Route path="outils/ui" element={<Differe><DemoUI /></Differe>} />
      <Route path="outils/grille" element={<G si={(d) => d.peut('stock', D.stock.article)}><DemoGrille /></G>} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Route>,
));

export default function App() {
  const { hydrated, token, dossier, dossierUser } = useSession();

  if (!hydrated) return null;
  // Session complète = token cloud + dossier choisi + utilisateur dossier (requis pour créer des pièces)
  if (!token || !dossier || !dossierUser) return <ErrorBoundary><Login /></ErrorBoundary>;

  return <RouterProvider router={router} />;
}
