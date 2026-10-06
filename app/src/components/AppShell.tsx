import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import { useQuery } from '@apollo/client';
import { MY_AGENTS } from '../api/auth';
import { useSession } from '../store/session';
import CommandPalette from './CommandPalette';
import DossierSwitcher from './DossierSwitcher';
import AgentSwitcher from './AgentSwitcher';
import { useSessionKeepAlive } from '../api/useSessionKeepAlive';
import { useDroitsSync } from '../api/useDroitsSync';
import { D, useDroits } from '../lib/droits';

/** Libellés « Référentiels » du module tiers (hors Clients / Fournisseurs). */
export const LIBELLES_REFERENTIELS = Object.entries(D.tiers)
  .filter(([k]) => k !== 'clients' && k !== 'fournisseurs').map(([, v]) => v as string);

type NavItem = { to: string; label: string; visible?: (d: ReturnType<typeof useDroits>) => boolean };

const NAV: { group: string | null; items: NavItem[] }[] = [
  { group: null, items: [{ to: '/', label: 'Tableau de bord' }] },
  {
    group: 'Activité',
    items: [
      { to: '/comptoir', label: 'Vente au comptoir', visible: (d) => d.peutDoc('vente', 'BCT', 'creer') || d.peutDoc('vente', 'BRT', 'creer') },
      { to: '/ventes', label: 'Ventes', visible: (d) => d.aModule('vente') },
      { to: '/achats', label: 'Achats', visible: (d) => d.aModule('achat') },
      { to: '/echeances', label: 'Échéances', visible: (d) => d.aModule('vente') },
      { to: '/stock', label: 'Stock', visible: (d) => d.peut('stock', D.stock.article) },
      { to: '/stock/mouvements', label: 'Mouvements de stock', visible: (d) => d.peutUn('stock', [D.stock.bonEntree, D.stock.bonSortie]) },
      { to: '/tiers', label: 'Tiers', visible: (d) => d.peutUn('tiers', [D.tiers.clients, D.tiers.fournisseurs]) },
      { to: '/tresorerie', label: 'Trésorerie', visible: (d) => d.peut('autre', D.autre.tresorerie) },
    ],
  },
  { group: 'Analyse', items: [{ to: '/statistiques', label: 'Statistiques', visible: (d) => d.peut('autre', D.autre.statistiques) }] },
  {
    group: 'Configuration',
    items: [
      { to: '/referentiels', label: 'Référentiels', visible: (d) => d.peutUn('tiers', LIBELLES_REFERENTIELS) },
      { to: '/parametres', label: 'Paramètres', visible: (d) => d.peut('autre', D.autre.parametres) },
      { to: '/parametres/utilisateurs', label: 'Utilisateurs & droits', visible: (d) => d.peut('autre', D.autre.droitsAcces) },
      { to: '/outils/grille', label: 'Grille (démo)', visible: (d) => d.peut('stock', D.stock.article) },
    ],
  },
];

export default function AppShell() {
  const { agent, dossier, dossierUser, accessError, logout } = useSession();
  const location = useLocation();
  const droits = useDroits();
  useDroitsSync();
  const [paletteOuverte, setPaletteOuverte] = useState(false);
  const [changerDossier, setChangerDossier] = useState(false);
  const [changerAgent, setChangerAgent] = useState(false);

  // Renouvellement du JWT + veille sur le blocage de compte / l'abonnement
  useSessionKeepAlive();

  // ⌘K / Ctrl+K : palette de commandes (recherche globale + navigation)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOuverte((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Statut agent temps quasi-réel : polling myAgents (pas de subscriptions côté cloud)
  const { data } = useQuery(MY_AGENTS, { pollInterval: 20_000, fetchPolicy: 'network-only' });
  // Bascule proposée seulement si le compte a plusieurs agents
  const plusieursAgents = Array.isArray(data?.myAgents) && data.myAgents.length > 1;
  const live = (data?.myAgents as { agentId: string; isOnline: boolean }[] | undefined)
    ?.find((a) => a.agentId === agent?.agentId);
  const online = live?.isOnline ?? agent?.isOnline ?? false;

  // Caisse plein écran (maquette « Vente au comptoir ») : ni barre latérale ni en-tête ;
  // le renouvellement de session et les alertes de compte restent actifs.
  if (location.pathname === '/comptoir') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        {accessError && <BandeauAcces code={accessError} onLogout={logout} />}
        <CommandPalette open={paletteOuverte} onClose={() => setPaletteOuverte(false)} />
        <div className="flex-1 min-h-0">
          <ErrorBoundary resetKey={location.pathname}><Outlet /></ErrorBoundary>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-[212px] flex-none bg-surface border-r border-line-soft flex flex-col p-2.5">
        <div className="flex items-center gap-2.5 px-2 pb-3 border-b border-line-soft mb-2">
          <div className="w-8 h-8 rounded-md text-white font-extrabold text-[13px] flex items-center justify-center"
               style={{ background: 'var(--gradient-hero)' }}>GC</div>
          <div>
            <div className="font-bold text-[13px] leading-tight">Gestion Com.</div>
            <div className="text-[9px] font-semibold tracking-widest text-ink-muted">DESKTOP</div>
          </div>
        </div>
        {NAV.map((section) => ({ ...section, items: section.items.filter((i) => !i.visible || i.visible(droits)) }))
          .filter((section) => section.items.length > 0)
          .map((section) => (
          <div key={section.group ?? 'root'}>
            {section.group && (
              <div className="text-[9.5px] font-bold tracking-widest uppercase text-ink-muted px-2.5 pt-3 pb-1">
                {section.group}
              </div>
            )}
            {section.items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/' || item.to === '/stock' || item.to === '/parametres'}
                className={({ isActive }) =>
                  `block px-2.5 py-1.5 rounded-sm text-[12px] font-semibold mb-0.5 ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-label hover:bg-line-soft'
                  }`}>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="mt-auto border-t border-line-soft pt-2.5 px-1 text-[11px]">
          <button onClick={() => setChangerDossier(true)}
                  title="Changer de dossier ou d'utilisateur"
                  className="w-full text-left border border-line rounded-md px-2.5 py-2 font-semibold text-ink-label hover:border-brand-300">
            📁 <b className="text-ink">{dossier}</b>
            <div className="text-[10px] text-ink-muted">{dossierUser?.username as string} · changer</div>
          </button>
          {plusieursAgents && (
            <button onClick={() => setChangerAgent(true)} className="mt-2 w-full text-left px-2.5 py-1.5 rounded-sm text-ink-label font-semibold hover:bg-line-soft">
              🖥 Changer d&apos;agent
            </button>
          )}
          <button onClick={logout} className="mt-1 w-full text-left px-2.5 py-1.5 rounded-sm text-ink-muted hover:bg-line-soft">
            Changer d'utilisateur
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[50px] flex-none bg-surface border-b border-line-soft flex items-center gap-4 px-4">
          <button onClick={() => setPaletteOuverte(true)}
                  className="flex-1 max-w-[380px] flex items-center gap-2 bg-bg border border-line rounded-md px-3 py-1.5 text-ink-muted text-[12px] hover:border-brand-300">
            🔍 Rechercher client, article, pièce…
            <span className="ml-auto font-mono text-[10px] border border-line rounded px-1.5 bg-surface">⌘K</span>
          </button>
          <div className="ml-auto flex items-center gap-2 text-[11.5px] font-semibold text-ink-label">
            <span className="w-2 h-2 rounded-full" style={{ background: online ? 'var(--success)' : 'var(--danger)' }} />
            {online ? 'Agent connecté' : 'Agent hors ligne'} · {agent?.label ?? agent?.agentId}
          </div>
        </header>

        {accessError && <BandeauAcces code={accessError} onLogout={logout} />}

        <CommandPalette open={paletteOuverte} onClose={() => setPaletteOuverte(false)} />
        {changerDossier && <DossierSwitcher onClose={() => setChangerDossier(false)} />}
        {changerAgent && <AgentSwitcher onClose={() => setChangerAgent(false)} />}

        <main className="flex-1 p-5 overflow-auto">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

/** Bandeau d'erreur d'accès poussé par le serveur (compte bloqué, abonnement, agent). */
function BandeauAcces({ code, onLogout }: { code: string; onLogout: () => void }) {
  return (
    <div className="px-4 py-2 text-[12px] font-semibold text-white" style={{ background: 'var(--danger)' }}>
      {code === 'SUBSCRIPTION_EXPIRED' && 'Abonnement expiré — contactez SOFTLY pour renouveler.'}
      {code === 'SUBSCRIPTION_SUSPENDED' && 'Abonnement suspendu — contactez SOFTLY.'}
      {code === 'ACCOUNT_BLOCKED' && 'Compte bloqué — contactez SOFTLY.'}
      {code === 'AGENT_NOT_ALLOWED' && (
        <>Cet agent n&apos;est plus rattaché à votre compte.{' '}
          <button onClick={onLogout} className="underline font-bold">Se reconnecter</button></>
      )}
    </div>
  );
}
